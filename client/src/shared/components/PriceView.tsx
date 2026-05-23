import React from 'react';
import { OrderBookEntry, OrderBooks, ProductId, SUPPORTED_PRODUCTS } from '../types';
import { ORDER_BOOK_LEVELS } from '../constants/limits';
import { formatPrice, formatSize } from '../utils/formats';
import { STRINGS } from '../constants/strings';
import { SIDE_STYLES } from '../constants/styles';

interface PriceViewProps {
  orderBooks: OrderBooks;
  subscriptions: Partial<Record<ProductId, boolean>>;
}

interface OrderBookSideProps {
  label: string;
  entries: OrderBookEntry[];
  side: 'bid' | 'ask';
}

const OrderBookSide: React.FC<OrderBookSideProps> = ({ label, entries, side }) => {
  const { text } = SIDE_STYLES[side];
  return (
    <div className="bg-deep rounded p-2 min-h-[60px]">
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${text}`}>{label}</div>
      {entries.length === 0 ? (
        <div className="text-dim text-[11px] italic py-1">{STRINGS.priceView.waiting}</div>
      ) : (
        entries.slice(0, ORDER_BOOK_LEVELS).map((entry) => (
          <div key={entry.price} className="flex justify-between text-xs leading-[18px] tabular-nums">
            <span className={text}>{formatPrice(entry.price)}</span>
            <span className="text-muted">{formatSize(entry.size)}</span>
          </div>
        ))
      )}
    </div>
  );
};

export const PriceView: React.FC<PriceViewProps> = ({ orderBooks, subscriptions }) => {
  const subscribedProducts = SUPPORTED_PRODUCTS.filter((p) => subscriptions[p]);

  return (
    <section className="panel">
      <div className="panel-title">{STRINGS.panels.priceView}</div>

      {subscribedProducts.length === 0 ? (
        <div className="text-dim text-sm italic py-3">{STRINGS.priceView.noSubs}</div>
      ) : (
        <div className="space-y-5">
          {subscribedProducts.map((productId) => {
            const book = orderBooks[productId];
            return (
              <div key={productId}>
                <div className="flex items-center gap-2 text-sm font-bold text-text mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${SIDE_STYLES.bid.dot}`} />
                  {productId}
                  {book?.timestamp && (
                    <span className="text-[10px] text-dim font-normal">
                      {new Date(book.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <OrderBookSide label={STRINGS.priceView.bids} entries={book?.bids ?? []} side="bid" />
                  <OrderBookSide label={STRINGS.priceView.asks} entries={book?.asks ?? []} side="ask" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
