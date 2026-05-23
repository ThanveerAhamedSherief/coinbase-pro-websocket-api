import crypto from 'crypto';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../../logger';
import type { ProductId } from '../../shared/types';
import type {
  CoinbaseChannel,
  CoinbaseInboundMessage,
  CoinbaseL2UpdateMessage,
  CoinbaseMatchMessage,
  CoinbaseSnapshotMessage,
  CoinbaseSubscriptionsMessage,
} from './coinbase.types';
import { SUBSCRIBE_CHANNELS } from './coinbase.types';

export interface CoinbaseClientConfig {
  wsUrl: string;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  debugMessages?: boolean;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
}

export declare interface CoinbaseClient {
  on(event: 'snapshot',      listener: (msg: CoinbaseSnapshotMessage) => void): this;
  on(event: 'l2update',      listener: (msg: CoinbaseL2UpdateMessage) => void): this;
  on(event: 'match',         listener: (msg: CoinbaseMatchMessage) => void): this;
  on(event: 'subscriptions', listener: (msg: CoinbaseSubscriptionsMessage) => void): this;
  on(event: 'connected',     listener: () => void): this;
  on(event: 'disconnected',  listener: () => void): this;
  on(event: 'error',         listener: (err: Error) => void): this;
}

export class CoinbaseClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly config: CoinbaseClientConfig;
  private activeSubscriptions: Map<ProductId, Set<CoinbaseChannel>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  private _isConnected = false;

  constructor(config: CoinbaseClientConfig) {
    super();
    this.config = config;
  }

  connect(): void {
    if (this.isDestroyed || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    logger.info({ url: this.config.wsUrl }, 'CoinbaseClient connecting');
    this.ws = new WebSocket(this.config.wsUrl);
    this.ws.on('open',    () => this.handleOpen());
    this.ws.on('message', (data) => this.handleMessage(data.toString()));
    this.ws.on('close',   (code, reason) => this.handleClose(code, reason.toString()));
    this.ws.on('error',   (err) => this.handleError(err));
  }

  disconnect(): void {
    this.isDestroyed = true;
    this.clearReconnectTimer();
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
  }

  // Guard against duplicate frames — Coinbase is idempotent but wastes bandwidth.
  subscribeProduct(productId: ProductId): void {
    if (this.activeSubscriptions.has(productId)) return;
    this.activeSubscriptions.set(productId, new Set(SUBSCRIBE_CHANNELS));
    for (const channel of SUBSCRIBE_CHANNELS) {
      this.sendFrame('subscribe', [productId], [channel]);
    }
  }

  unsubscribeProduct(productId: ProductId): void {
    if (!this.activeSubscriptions.has(productId)) return;
    this.activeSubscriptions.delete(productId);
    for (const channel of SUBSCRIBE_CHANNELS) {
      this.sendFrame('unsubscribe', [productId], [channel]);
    }
  }

  get connected(): boolean          { return this._isConnected; }
  get subscribedProducts(): ProductId[] { return Array.from(this.activeSubscriptions.keys()); }
  get hasCredentials(): boolean {
    const { apiKey, apiSecret, apiPassphrase } = this.config;
    return !!(apiKey && apiSecret && apiPassphrase);
  }

  private handleOpen(): void {
    this._isConnected = true;
    this.reconnectAttempts = 0;
    logger.info('CoinbaseClient connected');
    this.emit('connected');

    if (this.activeSubscriptions.size > 0) {
      const products = Array.from(this.activeSubscriptions.keys());
      logger.info({ products }, 'CoinbaseClient re-subscribing');
      for (const channel of SUBSCRIBE_CHANNELS) {
        this.sendFrame('subscribe', products, [channel]);
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    this._isConnected = false;
    logger.warn({ code, reason }, 'CoinbaseClient disconnected');
    this.emit('disconnected');
    if (!this.isDestroyed) this.scheduleReconnect();
  }

  private handleError(err: Error): void {
    logger.error({ err: err.message }, 'CoinbaseClient WebSocket error');
    this.emit('error', err);
  }

  private handleMessage(raw: string): void {
    if (this.config.debugMessages) {
      logger.debug({ raw: raw.slice(0, 300) }, 'CoinbaseClient <<<');
    }

    let msg: CoinbaseInboundMessage;
    try {
      msg = JSON.parse(raw) as CoinbaseInboundMessage;
    } catch {
      logger.error({ raw: raw.slice(0, 200) }, 'CoinbaseClient failed to parse message');
      return;
    }

    switch (msg.type) {
      case 'snapshot':
        logger.info({ product_id: msg.product_id, bids: msg.bids.length, asks: msg.asks.length }, 'CoinbaseClient snapshot');
        this.emit('snapshot', msg as CoinbaseSnapshotMessage);
        break;
      case 'l2update':
        this.emit('l2update', msg as CoinbaseL2UpdateMessage);
        break;
      case 'match':
      case 'last_match':
        this.emit('match', msg as CoinbaseMatchMessage);
        break;
      case 'subscriptions':
        logger.info({ channels: (msg as CoinbaseSubscriptionsMessage).channels }, 'CoinbaseClient subscriptions updated');
        this.emit('subscriptions', msg as CoinbaseSubscriptionsMessage);
        break;
      case 'error':
        logger.error({ message: msg.message, reason: msg.reason }, 'CoinbaseClient API error');
        this.emit('error', new Error(`${msg.message}: ${msg.reason ?? ''}`));
        break;
      case 'heartbeat':
        break;
      default:
        logger.debug({ type: (msg as { type: string }).type }, 'CoinbaseClient unknown message type');
    }
  }

  // Signature format: HMAC-SHA256(base64decode(secret), timestamp + 'GET' + '/users/self/verify')
  private buildAuthFields(): Record<string, string> {
    const { apiKey, apiSecret, apiPassphrase } = this.config;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', Buffer.from(apiSecret!, 'base64'))
      .update(`${timestamp}GET/users/self/verify`)
      .digest('base64');
    return { key: apiKey!, passphrase: apiPassphrase!, timestamp, signature };
  }

  private sendFrame(type: 'subscribe' | 'unsubscribe', productIds: ProductId[], channels: CoinbaseChannel[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const auth = this.hasCredentials ? this.buildAuthFields() : {};
    const frame = JSON.stringify({
      type,
      channels: channels.map((name) => ({ name, product_ids: productIds })),
      ...auth,
    });
    logger.debug({ type, frame: frame.slice(0, 200) }, 'CoinbaseClient >>>');
    this.ws.send(frame, (err) => {
      if (err) logger.error({ err: err.message, type }, 'CoinbaseClient failed to send frame');
    });
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(
      this.config.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts),
      this.config.reconnectMaxDelayMs,
    );
    this.reconnectAttempts++;
    logger.info({ delay, attempt: this.reconnectAttempts }, 'CoinbaseClient reconnecting');
    this.reconnectTimer = setTimeout(() => { if (!this.isDestroyed) this.connect(); }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
