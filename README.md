# Coinbase Live Feed

## Overview

A real-time crypto market data dashboard built with **Node.js** and **React.js**. The app connects to the **Coinbase Exchange WebSocket API** and lets users subscribe to live `level2` order book and `matches` trade updates for `BTC-USD`, `ETH-USD`, `XRP-USD`, and `LTC-USD`.

The backend manages Coinbase WebSocket subscriptions, supports multiple users, and routes market updates only to users subscribed to each product. The frontend displays subscription controls, live bid/ask prices, recent trades, and current system subscription status.


## Prerequisites

- Node.js 18+
- npm 9+

## Getting Started

```bash
# Server
cd server
npm install
cp .env.example .env
npm run dev                # http://localhost:3001

# Client (separate terminal)
cd client
npm install
cp .env.example .env
npm run dev                # http://localhost:3000
```

Open http://localhost:3000, toggle a product, data streams immediately.

## Project Structure

```
client/
├── src/
│   ├── index.tsx                       React mount
│   ├── index.css                       Tailwind entry
│   ├── app/
│   │   └── App.tsx                     Root layout
│   ├── config/
│   │   ├── index.ts                    Barrel export
│   │   └── env.ts                      Vite env parsing
│   └── shared/
│       ├── types.ts                    Shared client types
│       ├── components/
│       │   ├── SubscribePanel.tsx       Product subscription toggles
│       │   ├── PriceView.tsx           L2 order book (bids/asks)
│       │   ├── MatchView.tsx           Trade blotter (recent fills)
│       │   ├── SystemStatus.tsx        Connection health + feed rate
│       │   └── ErrorBoundary.tsx       Per-panel crash isolation
│       ├── hooks/
│       │   ├── useWebSocket.ts         WS lifecycle, message dispatch
│       │   └── useTheme.ts            Dark/light toggle
│       ├── constants/
│       │   ├── limits.ts              Buffer sizes, row counts
│       │   ├── strings.ts            UI labels
│       │   └── styles.ts             Tailwind class maps
│       └── utils/
│           └── formats.ts             Number/time formatters
└── tests/

server/
├── src/
│   ├── index.ts                        Entry point
│   ├── logger.ts                       Pino logger (pretty dev, JSON prod)
│   ├── app/
│   │   ├── app.ts                      Express app (helmet, rate-limit, /health)
│   │   ├── server.ts                   HTTP + WS server bootstrap, shutdown
│   │   └── websocket.ts               WS connection handler
│   ├── config/
│   │   ├── index.ts                    Barrel export
│   │   ├── env.ts                      Environment variable parsing
│   │   └── constants.ts               Numeric defaults (depth, intervals)
│   ├── modules/
│   │   ├── coinbase/
│   │   │   ├── coinbase.client.ts      Upstream WS connection, reconnect logic
│   │   │   ├── coinbase.mapper.ts      Raw → typed message mapping
│   │   │   └── coinbase.types.ts       Coinbase feed type definitions
│   │   ├── orderbook/
│   │   │   ├── orderbook.manager.ts    In-memory L2 book, dirty-flag sort cache
│   │   │   └── orderbook.service.ts    Broadcast loop, Coinbase event wiring
│   │   └── users/
│   │       ├── user.manager.ts         Session map, subscription routing
│   │       └── user.types.ts           User type definitions
│   └── shared/
│       └── types.ts                    Shared server types
└── tests/
```

## Architecture

```
┌──────────┐     ┌──────────┐
│ Browser A │     │ Browser B │    N independent WebSocket sessions
└─────┬─────┘     └─────┬─────┘
      │                  │
      └────────┬─────────┘
               │ ws://host/ws
               ▼
┌──────────────────────────────────────────────┐
│               Node.js Server                  │
│                                              │
│  ┌────────────┐  ┌─────────────────────────┐ │
│  │ UserManager│  │ OrderBookManager × N     │ │
│  │            │  │  • dirty-flag sort cache │ │
│  │ session map│  │  • top-N bid/ask slicing │ │
│  │ sub routing│  │  • WS snapshot seeding   │ │
│  └────────────┘  └─────────────────────────┘ │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         CoinbaseClient               │    │
│  │  • single upstream WS connection     │    │
│  │  • exponential backoff reconnect     │    │
│  │  • ref-counted channel subscriptions │    │
│  └──────────────────┬───────────────────┘    │
│                     │                        │
│  50 ms broadcast ───┤── orderbook_update ──▶ subscribers
│  match forwarding ──┤── match ─────────────▶ subscribers
│  system events ─────┘── system_status ─────▶ all clients
└──────────────────────────────────────────────┘
               │
               │ wss://ws-feed.exchange.coinbase.com
               ▼
     Coinbase Exchange WS Feed
     channels: level2_batch · matches
```

### Data Flow

1. Client sends `subscribe` with a product ID.
2. Server subscribes upstream to `level2_batch` + `matches` — Coinbase sends a full snapshot, then incremental updates.
3. Every 50 ms the broadcast loop pushes top-of-book to each subscribed client.
4. Trade executions are forwarded in real-time with server-side deduplication.
5. Channel acknowledgements from Coinbase are broadcast as `system_status`.

## Testing

```bash
cd server && npm test       # Jest + coverage
cd client && npm test       # Vitest
```
