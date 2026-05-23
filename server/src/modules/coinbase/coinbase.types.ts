import type { ProductId, ChannelInfo } from '../../shared/types';

export type CoinbaseChannel = 'level2_batch' | 'matches';

export const SUBSCRIBE_CHANNELS: readonly CoinbaseChannel[] = ['level2_batch', 'matches'] as const;

export interface CoinbaseSnapshotMessage {
  type: 'snapshot';
  product_id: ProductId;
  bids: [string, string][];
  asks: [string, string][];
}

export interface CoinbaseL2UpdateMessage {
  type: 'l2update';
  product_id: ProductId;
  changes: [string, string, string][];
  time: string;
}

export interface CoinbaseMatchMessage {
  type: 'match' | 'last_match';
  trade_id: number;
  sequence: number;
  maker_order_id: string;
  taker_order_id: string;
  time: string;
  product_id: ProductId;
  size: string;
  price: string;
  side: 'buy' | 'sell';
}

export interface CoinbaseSubscriptionsMessage {
  type: 'subscriptions';
  channels: ChannelInfo[];
}

export interface CoinbaseErrorMessage {
  type: 'error';
  message: string;
  reason?: string;
}

export interface CoinbaseHeartbeatMessage {
  type: 'heartbeat';
  sequence: number;
  last_trade_id: number;
  product_id: string;
  time: string;
}

export type CoinbaseInboundMessage =
  | CoinbaseSnapshotMessage
  | CoinbaseL2UpdateMessage
  | CoinbaseMatchMessage
  | CoinbaseSubscriptionsMessage
  | CoinbaseErrorMessage
  | CoinbaseHeartbeatMessage;
