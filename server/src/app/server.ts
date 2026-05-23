import http from 'http';
import { WebSocketServer } from 'ws';
import { logger } from '../logger';
import { env, RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS, BROADCAST_INTERVAL_MS, ORDER_BOOK_DEPTH } from '../config';
import { CoinbaseClient } from '../modules/coinbase/coinbase.client';
import { UserManager } from '../modules/users/user.manager';
import { createOrderBooks, setupCoinbaseHandlers, startBroadcastInterval } from '../modules/orderbook/orderbook.service';
import { createApp } from './app';
import { setupWebSocketServer } from './websocket';

export function startServer(): void {
  const userManager  = new UserManager();
  const coinbase     = new CoinbaseClient({
    wsUrl:                env.coinbaseWsUrl,
    reconnectBaseDelayMs: RECONNECT_BASE_DELAY_MS,
    reconnectMaxDelayMs:  RECONNECT_MAX_DELAY_MS,
    debugMessages:        env.debugWs,
    apiKey:               env.apiKey,
    apiSecret:            env.apiSecret,
    apiPassphrase:        env.apiPassphrase,
  });
  const orderBooks       = createOrderBooks(env.allowedProducts);
  const latestChannelsRef = { value: [] as { name: string; product_ids: string[] }[] };

  logger.info({ products: env.allowedProducts }, 'configured products');

  if (coinbase.hasCredentials) {
    logger.info('Coinbase API credentials configured');
  }

  setupCoinbaseHandlers(coinbase, userManager, orderBooks, latestChannelsRef);
  startBroadcastInterval(orderBooks, userManager, BROADCAST_INTERVAL_MS, ORDER_BOOK_DEPTH);

  const app        = createApp(coinbase, userManager);
  const httpServer = http.createServer(app);
  const wss        = new WebSocketServer({
    server:     httpServer,
    path:       '/ws',
    maxPayload: 16 * 1024,
    verifyClient: (info: { origin: string }) => {
      const origin = info.origin ?? '';
      if (env.clientOrigin === '*') return true;
      const allowed = origin === env.clientOrigin;
      if (!allowed) logger.warn({ origin }, 'CORS rejected origin');
      return allowed;
    },
  });

  setupWebSocketServer(wss, { coinbase, userManager, orderBooks, latestChannelsRef });

  coinbase.connect();

  httpServer.listen(env.serverPort, () => {
    logger.info({
      port:           env.serverPort,
      origin:         env.clientOrigin,
      orderBookDepth: ORDER_BOOK_DEPTH,
      broadcastMs:    BROADCAST_INTERVAL_MS,
    }, 'server listening');
  });

  function shutdown(): void {
    logger.info('shutting down');
    coinbase.disconnect();
    httpServer.close(() => process.exit(0));
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
