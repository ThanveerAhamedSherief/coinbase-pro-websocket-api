/**
 * Unit tests for OrderBook
 *
 * Covers:
 *  - Snapshot application
 *  - Incremental l2update application (add, update, remove)
 *  - Best bid / ask calculation
 *  - Top-N slicing and sorting
 *  - Discard of updates received before snapshot
 *  - clear() reset
 */

import { OrderBook } from '../src/modules/orderbook/orderbook.manager';

describe('OrderBook', () => {
  let book: OrderBook;

  beforeEach(() => {
    book = new OrderBook('BTC-USD');
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('should have no bids or asks', () => {
      expect(book.getTopBids()).toHaveLength(0);
      expect(book.getTopAsks()).toHaveLength(0);
    });

    it('should not have a snapshot', () => {
      expect(book.hasSnapshot).toBe(false);
    });

    it('should have zero bid/ask levels', () => {
      expect(book.bidLevels).toBe(0);
      expect(book.askLevels).toBe(0);
    });

    it('should return null for best bid and ask', () => {
      expect(book.getBestBid()).toBeNull();
      expect(book.getBestAsk()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // applySnapshot
  // -------------------------------------------------------------------------

  describe('applySnapshot', () => {
    const snapshotBids: [string, string][] = [
      ['50000.00', '1.5'],
      ['49999.00', '2.0'],
      ['49998.00', '0.75'],
    ];
    const snapshotAsks: [string, string][] = [
      ['50001.00', '1.0'],
      ['50002.00', '3.0'],
      ['50003.00', '0.5'],
    ];

    beforeEach(() => {
      book.applySnapshot(snapshotBids, snapshotAsks);
    });

    it('should set hasSnapshot to true', () => {
      expect(book.hasSnapshot).toBe(true);
    });

    it('should store correct number of bids and asks', () => {
      expect(book.bidLevels).toBe(3);
      expect(book.askLevels).toBe(3);
    });

    it('should sort bids descending (best bid first)', () => {
      const bids = book.getTopBids();
      expect(bids[0].price).toBe('50000.00');
      expect(bids[1].price).toBe('49999.00');
      expect(bids[2].price).toBe('49998.00');
    });

    it('should sort asks ascending (best ask first)', () => {
      const asks = book.getTopAsks();
      expect(asks[0].price).toBe('50001.00');
      expect(asks[1].price).toBe('50002.00');
      expect(asks[2].price).toBe('50003.00');
    });

    it('should return correct sizes', () => {
      const bids = book.getTopBids();
      expect(bids[0].size).toBe('1.5');
    });

    it('should replace old data on a second snapshot', () => {
      book.applySnapshot([['60000.00', '5.0']], [['60001.00', '5.0']]);
      expect(book.bidLevels).toBe(1);
      expect(book.askLevels).toBe(1);
      expect(book.getTopBids()[0].price).toBe('60000.00');
    });

    it('should filter out zero-size levels in snapshot', () => {
      book.applySnapshot(
        [['50000.00', '1.0'], ['49999.00', '0']],
        [['50001.00', '0'], ['50002.00', '2.0']],
      );
      expect(book.bidLevels).toBe(1);
      expect(book.askLevels).toBe(1);
    });

    it('should correctly report best bid', () => {
      expect(book.getBestBid()).toBe('50000.00');
    });

    it('should correctly report best ask', () => {
      expect(book.getBestAsk()).toBe('50001.00');
    });
  });

  // -------------------------------------------------------------------------
  // applyUpdate
  // -------------------------------------------------------------------------

  describe('applyUpdate', () => {
    beforeEach(() => {
      book.applySnapshot(
        [['50000.00', '1.5'], ['49999.00', '2.0']],
        [['50001.00', '1.0'], ['50002.00', '3.0']],
      );
    });

    it('should add a new bid level', () => {
      book.applyUpdate([['buy', '49997.00', '0.5']]);
      expect(book.bidLevels).toBe(3);
    });

    it('should add a new ask level', () => {
      book.applyUpdate([['sell', '50003.00', '2.0']]);
      expect(book.askLevels).toBe(3);
    });

    it('should update an existing bid size', () => {
      book.applyUpdate([['buy', '50000.00', '9.99']]);
      const bid = book.getTopBids().find((b) => b.price === '50000.00');
      expect(bid?.size).toBe('9.99');
    });

    it('should remove a bid level when size is 0', () => {
      book.applyUpdate([['buy', '50000.00', '0']]);
      expect(book.bidLevels).toBe(1);
      expect(book.getTopBids().find((b) => b.price === '50000.00')).toBeUndefined();
    });

    it('should remove an ask level when size is 0', () => {
      book.applyUpdate([['sell', '50001.00', '0']]);
      expect(book.askLevels).toBe(1);
    });

    it('should handle multiple changes in one update', () => {
      book.applyUpdate([
        ['buy', '50000.00', '0'],    // remove best bid
        ['buy', '49998.00', '1.0'],  // add new bid
        ['sell', '50004.00', '2.0'], // add new ask
      ]);
      expect(book.bidLevels).toBe(2);
      expect(book.askLevels).toBe(3);
    });

    it('should discard updates that arrive before snapshot', () => {
      const freshBook = new OrderBook('ETH-USD');
      freshBook.applyUpdate([['buy', '3000.00', '1.0']]);
      expect(freshBook.bidLevels).toBe(0);
    });

    it('should update the lastUpdate timestamp', () => {
      const before = book.lastUpdate;
      book.applyUpdate([['buy', '50000.00', '2.0']], '2024-01-01T00:00:00Z');
      expect(book.lastUpdate).toBe('2024-01-01T00:00:00Z');
      expect(book.lastUpdate).not.toBe(before);
    });
  });

  // -------------------------------------------------------------------------
  // getTopBids / getTopAsks with depth
  // -------------------------------------------------------------------------

  describe('depth limiting', () => {
    beforeEach(() => {
      book.applySnapshot(
        [
          ['50000.00', '1.0'],
          ['49999.00', '2.0'],
          ['49998.00', '3.0'],
          ['49997.00', '4.0'],
          ['49996.00', '5.0'],
        ],
        [
          ['50001.00', '1.0'],
          ['50002.00', '2.0'],
          ['50003.00', '3.0'],
          ['50004.00', '4.0'],
          ['50005.00', '5.0'],
        ],
      );
    });

    it('should return only top N bids', () => {
      expect(book.getTopBids(3)).toHaveLength(3);
    });

    it('should return only top N asks', () => {
      expect(book.getTopAsks(2)).toHaveLength(2);
    });

    it('getTopBids(3) should return best 3 bids', () => {
      const bids = book.getTopBids(3);
      expect(bids[0].price).toBe('50000.00');
      expect(bids[2].price).toBe('49998.00');
    });

    it('getTopAsks(3) should return best 3 asks', () => {
      const asks = book.getTopAsks(3);
      expect(asks[0].price).toBe('50001.00');
      expect(asks[2].price).toBe('50003.00');
    });

    it('should return all levels when depth exceeds book size', () => {
      expect(book.getTopBids(100)).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // clear()
  // -------------------------------------------------------------------------

  describe('clear', () => {
    it('should reset all state', () => {
      book.applySnapshot(
        [['50000.00', '1.0']],
        [['50001.00', '1.0']],
      );
      book.clear();

      expect(book.hasSnapshot).toBe(false);
      expect(book.bidLevels).toBe(0);
      expect(book.askLevels).toBe(0);
      expect(book.getBestBid()).toBeNull();
      expect(book.getBestAsk()).toBeNull();
      expect(book.lastUpdate).toBeNull();
    });

    it('should discard updates after clear until new snapshot', () => {
      book.applySnapshot([['50000.00', '1.0']], [['50001.00', '1.0']]);
      book.clear();
      book.applyUpdate([['buy', '50000.00', '5.0']]);
      expect(book.bidLevels).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // product accessor
  // -------------------------------------------------------------------------

  describe('product accessor', () => {
    it('should return the product id', () => {
      expect(book.product).toBe('BTC-USD');
    });
  });
});
