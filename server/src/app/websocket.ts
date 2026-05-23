import { v4 as uuidv4 } from 'uuid';
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../logger';
import { env, HEARTBEAT_INTERVAL_MS } from '../config';
import type { ProductId, ClientToServerMessage, SubscriptionConfirmMessage, OrderBookUpdateMessage } from '../shared/types';
import type { CoinbaseClient } from '../modules/coinbase/coinbase.client';
import type { UserManager } from '../modules/users/user.manager';
import type { OrderBook } from '../modules/orderbook/orderbook.manager';
import { SUBSCRIBE_CHANNELS } from '../modules/coinbase/coinbase.types';

interface AliveWebSocket extends WebSocket {
  isAlive: boolean;
}

interface WebSocketDeps {
  coinbase:      CoinbaseClient;
  userManager:   UserManager;
  orderBooks:    Map<ProductId, OrderBook>;
  latestChannelsRef: { value: { name: string; product_ids: string[] }[] };
}

export function setupWebSocketServer(wss: WebSocketServer, deps: WebSocketDeps): void {
  const { coinbase, userManager, orderBooks, latestChannelsRef } = deps;

  function broadcastSystemStatus(): void {
    const products = coinbase.subscribedProducts;
    const channels = products.length > 0
      ? SUBSCRIBE_CHANNELS.map((name) => ({ name, product_ids: products }))
      : [];
    latestChannelsRef.value = channels;
    userManager.broadcastToAll({ type: 'system_status', channels, server_time: new Date().toISOString() });
  }

  setInterval(() => {
    wss.clients.forEach((raw) => {
      const ws = raw as AliveWebSocket;
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('connection', (raw: WebSocket) => {
    const ws = raw as AliveWebSocket;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const userId = uuidv4();
    userManager.addUser(userId, ws);

    if (latestChannelsRef.value.length > 0) {
      userManager.sendToUser(userId, {
        type:        'system_status',
        channels:    latestChannelsRef.value,
        server_time: new Date().toISOString(),
      });
    }

    ws.on('message', (rawData) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(rawData.toString()) as ClientToServerMessage;
      } catch {
        logger.warn({ userId }, 'malformed message received');
        userManager.sendToUser(userId, { type: 'server_error', message: 'Invalid JSON' });
        return;
      }
      handleClientMessage(userId, msg);
    });

    ws.on('close', () => cleanupUser(userId));

    ws.on('error', (err) => {
      logger.error({ userId, err: err.message }, 'WebSocket error');
      cleanupUser(userId);
    });
  });

  function cleanupUser(userId: string): void {
    const abandonedProducts = userManager.removeUser(userId);
    for (const productId of abandonedProducts) {
      logger.info({ productId }, 'no more subscribers — unsubscribing');
      coinbase.unsubscribeProduct(productId);
      orderBooks.get(productId)?.clear();
    }
    if (abandonedProducts.size > 0) broadcastSystemStatus();
  }

  function handleClientMessage(userId: string, msg: ClientToServerMessage): void {
    if (!env.allowedProducts.includes(msg.product_id)) {
      userManager.sendToUser(userId, {
        type:    'server_error',
        message: `Unsupported product: ${msg.product_id}`,
      });
      return;
    }

    if (msg.type === 'subscribe') {
      const isFirst = userManager.subscribeUser(userId, msg.product_id);

      if (isFirst) {
        coinbase.subscribeProduct(msg.product_id);
        broadcastSystemStatus();
      } else {
        const book = orderBooks.get(msg.product_id);
        if (book?.hasSnapshot) {
          const snapshot: OrderBookUpdateMessage = {
            type:       'orderbook_update',
            product_id: msg.product_id,
            bids:       book.getTopBids(25),
            asks:       book.getTopAsks(25),
            timestamp:  new Date().toISOString(),
          };
          userManager.sendToUser(userId, snapshot);
        }
      }

      userManager.sendToUser(userId, {
        type:       'subscription_confirm',
        product_id: msg.product_id,
        subscribed: true,
      } as SubscriptionConfirmMessage);

    } else if (msg.type === 'unsubscribe') {
      const isEmpty = userManager.unsubscribeUser(userId, msg.product_id);

      if (isEmpty) {
        coinbase.unsubscribeProduct(msg.product_id);
        orderBooks.get(msg.product_id)?.clear();
        broadcastSystemStatus();
      }

      userManager.sendToUser(userId, {
        type:       'subscription_confirm',
        product_id: msg.product_id,
        subscribed: false,
      } as SubscriptionConfirmMessage);

    } else {
      userManager.sendToUser(userId, {
        type:    'server_error',
        message: `Unknown message type: ${(msg as { type: string }).type}`,
      });
    }
  }
}
