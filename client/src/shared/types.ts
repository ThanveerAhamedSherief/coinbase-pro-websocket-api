import { env } from '../config';

export type ProductId = string;

export const SUPPORTED_PRODUCTS: readonly ProductId[] = env.products;

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface OrderBookUpdateMessage {
  type: 'orderbook_update';
  product_id: ProductId;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string;
}

export interface MatchUpdateMessage {
  type: 'match';
  trade_id: number;
  time: string;
  product_id: ProductId;
  size: string;
  price: string;
  side: 'buy' | 'sell';
}

export interface SubscriptionConfirmMessage {
  type: 'subscription_confirm';
  product_id: ProductId;
  subscribed: boolean;
}

export interface CoinbaseChannelInfo {
  name: string;
  product_ids: string[];
}

export interface SystemStatusMessage {
  type: 'system_status';
  channels: CoinbaseChannelInfo[];
  server_time: string;
}

export interface ServerErrorMessage {
  type: 'server_error';
  message: string;
}

export type ServerMessage =
  | OrderBookUpdateMessage
  | MatchUpdateMessage
  | SubscriptionConfirmMessage
  | SystemStatusMessage
  | ServerErrorMessage;

export interface ClientSubscribeMessage {
  type: 'subscribe';
  product_id: ProductId;
}

export interface ClientUnsubscribeMessage {
  type: 'unsubscribe';
  product_id: ProductId;
}

export interface OrderBookState {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string | null;
}

export type OrderBooks = Partial<Record<ProductId, OrderBookState>>;

export type SubscriptionMap = Partial<Record<ProductId, boolean>>;

export enum ConnectionStatus {
  Connecting = 'CONNECTING',
  Connected = 'CONNECTED',
  Disconnected = 'DISCONNECTED',
  Reconnecting = 'RECONNECTING',
}
