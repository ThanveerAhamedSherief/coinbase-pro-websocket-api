import { logger } from '../../logger';
import type { ProductId, OrderBookUpdateMessage } from '../../shared/types';
import type { CoinbaseClient } from '../coinbase/coinbase.client';
import { MatchDeduplicator, mapMatch } from '../coinbase/coinbase.mapper';
import { SUBSCRIBE_CHANNELS } from '../coinbase/coinbase.types';
import type { UserManager } from '../users/user.manager';
import { OrderBook } from './orderbook.manager';

export function createOrderBooks(products: ProductId[]): Map<ProductId, OrderBook> {
  return new Map(products.map((p) => [p, new OrderBook(p)]));
}

export function setupCoinbaseHandlers(
  coinbase: CoinbaseClient,
  userManager: UserManager,
  orderBooks: Map<ProductId, OrderBook>,
  latestChannelsRef: { value: { name: string; product_ids: string[] }[] },
): void {
  const deduplicator = new MatchDeduplicator(2000);

  coinbase.on('snapshot', (msg) => {
    orderBooks.get(msg.product_id)?.applySnapshot(msg.bids, msg.asks);
  });

  coinbase.on('l2update', (msg) => {
    orderBooks.get(msg.product_id)?.applyUpdate(msg.changes, msg.time);
  });

  coinbase.on('match', (msg) => {
    if (deduplicator.isDuplicate(msg.product_id, msg.trade_id)) return;
    userManager.broadcastToProduct(msg.product_id, mapMatch(msg));
  });

  coinbase.on('subscriptions', () => {
    const products = coinbase.subscribedProducts;
    const channels = products.length > 0
      ? SUBSCRIBE_CHANNELS.map((name) => ({ name, product_ids: products }))
      : [];
    latestChannelsRef.value = channels;
    userManager.broadcastToAll({ type: 'system_status', channels, server_time: new Date().toISOString() });
  });

  coinbase.on('error', (err) => {
    logger.error({ err: err.message }, 'Coinbase client error');
  });

  coinbase.on('disconnected', () => {
    for (const book of orderBooks.values()) book.clear();
  });
}

export function startBroadcastInterval(
  orderBooks: Map<ProductId, OrderBook>,
  userManager: UserManager,
  intervalMs: number,
  depth: number,
): void {
  setInterval(() => {
    for (const [productId, book] of orderBooks) {
      if (!book.hasSnapshot) continue;
      if (userManager.getProductSubscriberCount(productId) === 0) continue;

      const msg: OrderBookUpdateMessage = {
        type:       'orderbook_update',
        product_id: productId,
        bids:       book.getTopBids(depth),
        asks:       book.getTopAsks(depth),
        timestamp:  new Date().toISOString(),
      };
      userManager.broadcastToProduct(productId, msg);
    }
  }, intervalMs);
}
