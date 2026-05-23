function parseProducts(raw: string): string[] {
  return raw.split(',').map((p: string) => p.trim().toUpperCase()).filter(Boolean);
}

export const env = {
  wsUrl:    import.meta.env.VITE_WS_URL      ?? 'ws://localhost:3001/ws',
  products: parseProducts(import.meta.env.VITE_PRODUCTS ?? 'BTC-USD,ETH-USD,XRP-USD,LTC-USD'),
} as const;
