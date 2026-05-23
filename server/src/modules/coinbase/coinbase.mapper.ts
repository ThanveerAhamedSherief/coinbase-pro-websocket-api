import type { ProductId, MatchUpdateMessage } from '../../shared/types';
import type { CoinbaseMatchMessage } from './coinbase.types';

export class MatchDeduplicator {
  private readonly seen = new Set<string>();
  private readonly queue: string[] = [];

  constructor(private readonly maxSize: number) {}

  isDuplicate(productId: ProductId, tradeId: number): boolean {
    const key = `${productId}:${tradeId}`;
    if (this.seen.has(key)) return true;
    this.seen.add(key);
    this.queue.push(key);
    if (this.queue.length > this.maxSize) {
      const evicted = this.queue.shift();
      if (evicted) this.seen.delete(evicted);
    }
    return false;
  }
}

export function mapMatch(msg: CoinbaseMatchMessage): MatchUpdateMessage {
  return {
    type:       'match',
    trade_id:   msg.trade_id,
    time:       msg.time,
    product_id: msg.product_id,
    size:       msg.size,
    price:      msg.price,
    side:       msg.side,
  };
}
