import 'dotenv/config';
import { logger } from '../logger';

const PRODUCT_FORMAT = /^[A-Z0-9]+-[A-Z0-9]+$/;

function parseProducts(raw: string | undefined): string[] {
  const products = (raw ?? 'BTC-USD,ETH-USD,XRP-USD,LTC-USD')
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter((p) => {
      if (PRODUCT_FORMAT.test(p)) return true;
      logger.warn({ product: p }, 'Skipping invalid product in ALLOWED_PRODUCTS');
      return false;
    });

  if (products.length === 0) {
    logger.error('ALLOWED_PRODUCTS produced no valid products — exiting');
    process.exit(1);
  }

  return products;
}

export const env = {
  serverPort:      parseInt(process.env.SERVER_PORT      ?? '3001', 10),
  clientOrigin:    process.env.CLIENT_ORIGIN             ?? 'http://localhost:3000',
  coinbaseWsUrl:   process.env.COINBASE_WS_URL           ?? 'wss://ws-feed.exchange.coinbase.com',
  debugWs:         process.env.DEBUG_WS                  === 'true',
  allowedProducts: parseProducts(process.env.ALLOWED_PRODUCTS),
  apiKey:          process.env.COINBASE_API_KEY,
  apiSecret:       process.env.COINBASE_API_SECRET,
  apiPassphrase:   process.env.COINBASE_API_PASSPHRASE,
} as const;
