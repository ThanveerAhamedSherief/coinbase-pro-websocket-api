import type { ProductId, OrderBookEntry } from '../../shared/types';

export class OrderBook {
  private readonly productId: ProductId;
  private bids: Map<string, string> = new Map();
  private asks: Map<string, string> = new Map();
  private lastUpdateTime: string | null = null;
  private snapshotReceived = false;
  private sortedBids: OrderBookEntry[] = [];
  private sortedAsks: OrderBookEntry[] = [];
  private bidsDirty = false;
  private asksDirty = false;

  constructor(productId: ProductId) {
    this.productId = productId;
  }

  applySnapshot(bids: [string, string][], asks: [string, string][]): void {
    this.bids.clear();
    this.asks.clear();
    for (const [price, size] of bids) {
      if (parseFloat(size) > 0) this.bids.set(price, size);
    }
    for (const [price, size] of asks) {
      if (parseFloat(size) > 0) this.asks.set(price, size);
    }
    this.snapshotReceived = true;
    this.lastUpdateTime = new Date().toISOString();
    this.bidsDirty = true;
    this.asksDirty = true;
  }

  applyUpdate(changes: [string, string, string][], time?: string): void {
    if (!this.snapshotReceived) return;
    for (const [side, price, size] of changes) {
      const book = side === 'buy' ? this.bids : this.asks;
      if (parseFloat(size) === 0) {
        book.delete(price);
      } else {
        book.set(price, size);
      }
    }
    this.lastUpdateTime = time ?? new Date().toISOString();
    this.bidsDirty = true;
    this.asksDirty = true;
  }

  getTopBids(depth?: number): OrderBookEntry[] {
    if (this.bidsDirty) {
      this.sortedBids = Array.from(this.bids.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      this.bidsDirty = false;
    }
    return depth !== undefined ? this.sortedBids.slice(0, depth) : this.sortedBids;
  }

  getTopAsks(depth?: number): OrderBookEntry[] {
    if (this.asksDirty) {
      this.sortedAsks = Array.from(this.asks.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      this.asksDirty = false;
    }
    return depth !== undefined ? this.sortedAsks.slice(0, depth) : this.sortedAsks;
  }

  getBestBid(): string | null {
    const top = this.getTopBids(1);
    return top.length > 0 ? top[0].price : null;
  }

  getBestAsk(): string | null {
    const top = this.getTopAsks(1);
    return top.length > 0 ? top[0].price : null;
  }

  clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.sortedBids = [];
    this.sortedAsks = [];
    this.bidsDirty = false;
    this.asksDirty = false;
    this.snapshotReceived = false;
    this.lastUpdateTime = null;
  }

  get product(): ProductId        { return this.productId; }
  get hasSnapshot(): boolean      { return this.snapshotReceived; }
  get lastUpdate(): string | null { return this.lastUpdateTime; }
  get bidLevels(): number         { return this.bids.size; }
  get askLevels(): number         { return this.asks.size; }
}
