export type ProductId = string;

export interface ChannelInfo {
  name: string;
  product_ids: string[];
}

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

export interface SystemStatusMessage {
  type: 'system_status';
  channels: ChannelInfo[];
  server_time: string;
}

export interface ServerErrorMessage {
  type: 'server_error';
  message: string;
}

export type ServerToClientMessage =
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

export type ClientToServerMessage = ClientSubscribeMessage | ClientUnsubscribeMessage;
