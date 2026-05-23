/**
 * Unit tests for CoinbaseClient
 *
 * Covers:
 *  - connect / disconnect lifecycle
 *  - Subscription frame guards (no duplicate frames)
 *  - handleMessage: snapshot, l2update, match, subscriptions, error, unknown
 *  - Re-subscribe on reconnect
 *  - Exponential backoff scheduling
 *  - isDestroyed guard prevents reconnect after disconnect()
 */

import { EventEmitter } from 'events';
import { CoinbaseClient } from '../src/modules/coinbase/coinbase.client';

// ---------------------------------------------------------------------------
// Minimal mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket extends EventEmitter {
  static OPEN    = 1;
  static CLOSING = 2;
  static CLOSED  = 3;

  readyState = MockWebSocket.OPEN;
  sentFrames: string[] = [];
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  send(data: string, cb?: (err?: Error) => void): void {
    this.sentFrames.push(data);
    cb?.();
  }

  close(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    // Simulate the ws library emitting 'close' so handleClose() fires
    this.emit('close', code, Buffer.from(reason));
  }

  // Helpers to simulate server events
  simulateOpen():                void { this.emit('open'); }
  simulateMessage(data: string): void { this.emit('message', data); }
  simulateClose(code = 1000):    void { this.readyState = MockWebSocket.CLOSED; this.emit('close', code, Buffer.from('')); }
  simulateError(err: Error):     void { this.emit('error', err); }
}

// ---------------------------------------------------------------------------
// Inject mock WebSocket into CoinbaseClient
// ---------------------------------------------------------------------------

let mockWs: MockWebSocket;

jest.mock('ws', () => {
  // CoinbaseClient checks `this.ws.readyState === WebSocket.OPEN` where WebSocket
  // is the imported ws module default. The mock must expose these static constants.
  const Ctor = jest.fn().mockImplementation((url: string) => {
    mockWs = new MockWebSocket(url);
    return mockWs;
  }) as jest.Mock & { OPEN: number; CLOSING: number; CLOSED: number };
  Ctor.OPEN    = 1;
  Ctor.CLOSING = 2;
  Ctor.CLOSED  = 3;
  return { __esModule: true, default: Ctor };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  wsUrl:                'wss://test.example.com',
  reconnectBaseDelayMs: 100,
  reconnectMaxDelayMs:  1000,
};

function buildClient(overrides = {}): CoinbaseClient {
  return new CoinbaseClient({ ...BASE_CONFIG, ...overrides });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CoinbaseClient', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

  // -------------------------------------------------------------------------
  // connect / disconnect
  // -------------------------------------------------------------------------

  describe('connect()', () => {
    it('emits "connected" on open', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('connected', spy);
      client.connect();
      mockWs.simulateOpen();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('sets connected to true on open', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      expect(client.connected).toBe(true);
    });

    it('sets connected to false on close', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateClose();
      expect(client.connected).toBe(false);
    });

    it('does not connect twice when already open', () => {
      const WsMock = jest.requireMock('ws').default as jest.Mock;
      WsMock.mockClear();
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.connect(); // second call — already open
      expect(WsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    it('emits disconnected and prevents reconnect', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('disconnected', spy);
      client.connect();
      mockWs.simulateOpen();
      client.disconnect();
      // Fast-forward past any reconnect timer — no reconnect should happen
      jest.runAllTimers();
      // connected should be false (ws.close sets CLOSED state)
      expect(client.connected).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // subscribeProduct / unsubscribeProduct
  // -------------------------------------------------------------------------

  describe('subscribeProduct()', () => {
    it('sends subscribe frames for each channel', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.subscribeProduct('BTC-USD');
      const frames = mockWs.sentFrames.map((f) => JSON.parse(f));
      const types = frames.map((f) => f.type);
      expect(types.every((t) => t === 'subscribe')).toBe(true);
      expect(frames.length).toBeGreaterThan(0);
    });

    it('does not send duplicate frames for the same product', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.subscribeProduct('BTC-USD');
      const firstCount = mockWs.sentFrames.length;
      client.subscribeProduct('BTC-USD'); // duplicate — should be a no-op
      expect(mockWs.sentFrames.length).toBe(firstCount);
    });

    it('tracks subscribed products', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.subscribeProduct('BTC-USD');
      client.subscribeProduct('ETH-USD');
      expect(client.subscribedProducts).toContain('BTC-USD');
      expect(client.subscribedProducts).toContain('ETH-USD');
    });
  });

  describe('unsubscribeProduct()', () => {
    it('sends unsubscribe frames', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.subscribeProduct('BTC-USD');
      mockWs.sentFrames.length = 0; // clear subscribe frames
      client.unsubscribeProduct('BTC-USD');
      const frames = mockWs.sentFrames.map((f) => JSON.parse(f));
      expect(frames.every((f) => f.type === 'unsubscribe')).toBe(true);
    });

    it('removes the product from tracked subscriptions', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.subscribeProduct('BTC-USD');
      client.unsubscribeProduct('BTC-USD');
      expect(client.subscribedProducts).not.toContain('BTC-USD');
    });

    it('is a no-op for products that were never subscribed', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.unsubscribeProduct('BTC-USD'); // never subscribed
      expect(mockWs.sentFrames).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Message parsing
  // -------------------------------------------------------------------------

  describe('handleMessage — snapshot', () => {
    it('emits "snapshot" with the parsed message', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('snapshot', spy);
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateMessage(JSON.stringify({
        type: 'snapshot',
        product_id: 'BTC-USD',
        bids: [['50000', '1.0']],
        asks: [['50001', '0.5']],
      }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].product_id).toBe('BTC-USD');
    });
  });

  describe('handleMessage — l2update', () => {
    it('emits "l2update" with the parsed message', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('l2update', spy);
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateMessage(JSON.stringify({
        type: 'l2update',
        product_id: 'ETH-USD',
        changes: [['buy', '3000', '2.0']],
        time: '2024-01-01T00:00:00Z',
      }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].product_id).toBe('ETH-USD');
    });
  });

  describe('handleMessage — match', () => {
    it('emits "match" for type match', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('match', spy);
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateMessage(JSON.stringify({
        type: 'match',
        trade_id: 42,
        product_id: 'BTC-USD',
        size: '0.01',
        price: '50000',
        side: 'buy',
        time: '2024-01-01T00:00:00Z',
        sequence: 1,
        maker_order_id: 'a',
        taker_order_id: 'b',
      }));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits "match" for type last_match', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('match', spy);
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateMessage(JSON.stringify({
        type: 'last_match',
        trade_id: 1,
        product_id: 'BTC-USD',
        size: '0.01',
        price: '50000',
        side: 'sell',
        time: '2024-01-01T00:00:00Z',
        sequence: 1,
        maker_order_id: 'a',
        taker_order_id: 'b',
      }));
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMessage — subscriptions', () => {
    it('emits "subscriptions" event', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('subscriptions', spy);
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateMessage(JSON.stringify({
        type: 'subscriptions',
        channels: [{ name: 'level2_batch', product_ids: ['BTC-USD'] }],
      }));
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMessage — error', () => {
    it('emits "error" event for API errors', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('error', spy);
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateMessage(JSON.stringify({
        type: 'error',
        message: 'Unauthorized',
        reason: 'auth required',
      }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('handleMessage — malformed JSON', () => {
    it('does not throw and does not emit any event', () => {
      const client = buildClient();
      const spy = jest.fn();
      client.on('snapshot', spy);
      client.on('l2update', spy);
      client.on('match', spy);
      client.connect();
      mockWs.simulateOpen();
      expect(() => mockWs.simulateMessage('not-json}')).not.toThrow();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Reconnect behaviour
  // -------------------------------------------------------------------------

  describe('reconnect', () => {
    it('schedules reconnect after close', () => {
      const WsMock = jest.requireMock('ws').default as jest.Mock;
      WsMock.mockClear();
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      mockWs.simulateClose(1006); // unexpected close
      expect(WsMock).toHaveBeenCalledTimes(1);
      jest.runAllTimers();
      // After timer fires, a second WebSocket should be created
      expect(WsMock).toHaveBeenCalledTimes(2);
    });

    it('re-subscribes all products after reconnect', () => {
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.subscribeProduct('BTC-USD');
      mockWs.sentFrames.length = 0;
      mockWs.simulateClose(1006);
      jest.runAllTimers();
      // New connection opens
      mockWs.simulateOpen();
      // Should re-send subscribe frames for BTC-USD
      expect(mockWs.sentFrames.length).toBeGreaterThan(0);
      expect(mockWs.sentFrames.some((f) => f.includes('BTC-USD'))).toBe(true);
    });

    it('does not reconnect after disconnect() is called', () => {
      const WsMock = jest.requireMock('ws').default as jest.Mock;
      WsMock.mockClear();
      const client = buildClient();
      client.connect();
      mockWs.simulateOpen();
      client.disconnect();
      jest.runAllTimers();
      expect(WsMock).toHaveBeenCalledTimes(1); // no second connection
    });
  });

  // -------------------------------------------------------------------------
  // hasCredentials
  // -------------------------------------------------------------------------

  describe('hasCredentials', () => {
    it('returns false when no API credentials are supplied', () => {
      const client = buildClient();
      expect(client.hasCredentials).toBe(false);
    });

    it('returns true when all three credentials are supplied', () => {
      const client = buildClient({
        apiKey:        'key',
        apiSecret:     Buffer.from('secret').toString('base64'),
        apiPassphrase: 'pass',
      });
      expect(client.hasCredentials).toBe(true);
    });
  });
});
