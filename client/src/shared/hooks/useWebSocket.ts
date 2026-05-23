import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CoinbaseChannelInfo,
  ConnectionStatus,
  MatchUpdateMessage,
  OrderBooks,
  ProductId,
  ServerMessage,
  SubscriptionMap,
} from '../types';
import { env } from '../../config';
import { MAX_MATCHES, ORDER_BOOK_FLUSH_MS, MATCH_FLUSH_MS, RECONNECT_MS } from '../constants/limits';

const WS_URL    = env.wsUrl;
const DEDUP_MAX = MAX_MATCHES * 2;

export interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  subscriptions: SubscriptionMap;
  orderBooks: OrderBooks;
  matches: MatchUpdateMessage[];
  systemChannels: CoinbaseChannelInfo[];
  /** Messages received from the server in the last second */
  feedRate: number;
  subscribe: (productId: ProductId) => void;
  unsubscribe: (productId: ProductId) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef              = useRef<WebSocket | null>(null);
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef       = useRef(true);
  const pendingSubsRef     = useRef<Set<ProductId>>(new Set());

  // Order book data is written here on every message and flushed to React state
  // on a fixed interval — calling setState inside the handler doesn't guarantee
  // the desired render cadence due to React 18 async batching.
  const orderBooksRef      = useRef<OrderBooks>({});
  const orderBooksDirtyRef = useRef(false);

  // Matches are pushed (O(1)) into the buffer and prepended to state on flush.
  const matchBufferRef     = useRef<MatchUpdateMessage[]>([]);
  const seenTradeKeysRef   = useRef<Set<string>>(new Set());
  const seenTradeQueueRef  = useRef<string[]>([]);

  // Rolling message counter — reset every second to compute feed rate.
  const msgCountRef = useRef(0);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.Connecting);
  const [subscriptions,    setSubscriptions]    = useState<SubscriptionMap>({});
  const [orderBooks,       setOrderBooks]       = useState<OrderBooks>({});
  const [matches,          setMatches]          = useState<MatchUpdateMessage[]>([]);
  const [systemChannels,   setSystemChannels]   = useState<CoinbaseChannelInfo[]>([]);
  const [feedRate,         setFeedRate]         = useState(0);

  const isSeenTrade = useCallback((productId: ProductId, tradeId: number): boolean => {
    const key = `${productId}:${tradeId}`;
    if (seenTradeKeysRef.current.has(key)) return true;
    seenTradeKeysRef.current.add(key);
    seenTradeQueueRef.current.push(key);
    if (seenTradeQueueRef.current.length > DEDUP_MAX) {
      const evicted = seenTradeQueueRef.current.shift();
      if (evicted) seenTradeKeysRef.current.delete(evicted);
    }
    return false;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!orderBooksDirtyRef.current) return;
      orderBooksDirtyRef.current = false;
      setOrderBooks(orderBooksRef.current);
    }, ORDER_BOOK_FLUSH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (matchBufferRef.current.length === 0) return;
      // Buffer was filled with push() (newest last); reverse so newest is first.
      const incoming = matchBufferRef.current.splice(0).reverse();
      setMatches((prev) => {
        const next = [...incoming, ...prev];
        return next.length > MAX_MATCHES ? next.slice(0, MAX_MATCHES) : next;
      });
    }, MATCH_FLUSH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFeedRate(msgCountRef.current);
      msgCountRef.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      console.error('[useWebSocket] Failed to parse message');
      return;
    }

    msgCountRef.current++;

    switch (msg.type) {
      case 'orderbook_update':
        orderBooksRef.current = {
          ...orderBooksRef.current,
          [msg.product_id]: { bids: msg.bids, asks: msg.asks, timestamp: msg.timestamp },
        };
        orderBooksDirtyRef.current = true;
        break;

      case 'match':
        if (isSeenTrade(msg.product_id, msg.trade_id)) break;
        matchBufferRef.current.push(msg);
        break;

      case 'subscription_confirm':
        setSubscriptions((prev) => ({ ...prev, [msg.product_id]: msg.subscribed }));
        if (msg.subscribed) {
          pendingSubsRef.current.add(msg.product_id);
        } else {
          pendingSubsRef.current.delete(msg.product_id);
          const next = { ...orderBooksRef.current };
          delete next[msg.product_id];
          orderBooksRef.current = next;
          orderBooksDirtyRef.current = true;
        }
        break;

      case 'system_status':
        setSystemChannels(msg.channels);
        break;

      case 'server_error':
        console.error('[useWebSocket] Server error:', msg.message);
        break;

      default:
        console.warn('[useWebSocket] Unknown message type:', (msg as { type: string }).type);
    }
  }, [isSeenTrade]);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    setConnectionStatus(ConnectionStatus.Connecting);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) { ws.close(); return; }
      setConnectionStatus(ConnectionStatus.Connected);
      for (const productId of pendingSubsRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe', product_id: productId }));
      }
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      if (!isMountedRef.current) return;
      console.warn(`[useWebSocket] Disconnected (${event.code})`);
      setConnectionStatus(ConnectionStatus.Reconnecting);
      setSubscriptions({});
      orderBooksRef.current = {};
      orderBooksDirtyRef.current = false;
      setOrderBooks({});
      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connect();
      }, RECONNECT_MS);
    };

    ws.onerror = () => setConnectionStatus(ConnectionStatus.Disconnected);
  }, [handleMessage]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();
    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [connect]);

  const subscribe = useCallback((productId: ProductId) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'subscribe', product_id: productId }));
  }, []);

  const unsubscribe = useCallback((productId: ProductId) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'unsubscribe', product_id: productId }));
  }, []);

  return { connectionStatus, subscriptions, orderBooks, matches, systemChannels, feedRate, subscribe, unsubscribe };
}
