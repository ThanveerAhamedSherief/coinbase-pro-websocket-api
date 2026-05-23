export const LOCALE = 'en-US';

export const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour12:  false,
  hour:    '2-digit',
  minute:  '2-digit',
  second:  '2-digit',
};

export const PRICE_FORMAT_LARGE: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export const PRICE_DECIMALS_SMALL  = 4;
export const SIZE_DECIMALS         = 6;
export const LARGE_PRICE_THRESHOLD = 100;

export const TRADE_SIDE_TO_BOOK_SIDE: Record<'buy' | 'sell', 'bid' | 'ask'> = {
  buy:  'bid',
  sell: 'ask',
};

export function formatPrice(price: string): string {
  const num = parseFloat(price);
  return num >= LARGE_PRICE_THRESHOLD
    ? num.toLocaleString(LOCALE, PRICE_FORMAT_LARGE)
    : num.toFixed(PRICE_DECIMALS_SMALL);
}

export function formatSize(size: string): string {
  return parseFloat(size).toFixed(SIZE_DECIMALS);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, TIME_FORMAT);
}
