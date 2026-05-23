import React from 'react';
import { ProductId, SUPPORTED_PRODUCTS, SubscriptionMap } from '../types';
import { STRINGS } from '../constants/strings';
import { SUBSCRIPTION_STYLES } from '../constants/styles';

interface SubscribePanelProps {
  subscriptions: SubscriptionMap;
  onSubscribe: (productId: ProductId) => void;
  onUnsubscribe: (productId: ProductId) => void;
  disabled?: boolean;
}

export const SubscribePanel: React.FC<SubscribePanelProps> = ({
  subscriptions,
  onSubscribe,
  onUnsubscribe,
  disabled = false,
}) => {
  const handleClick = (productId: ProductId) => {
    if (disabled) return;
    subscriptions[productId] ? onUnsubscribe(productId) : onSubscribe(productId);
  };

  return (
    <section className="panel">
      <div className="panel-title">{STRINGS.panels.subscribe}</div>
      <div className="grid grid-cols-2 gap-2">
        {SUPPORTED_PRODUCTS.map((productId) => {
          const subscribed = Boolean(subscriptions[productId]);
          const s = subscribed ? SUBSCRIPTION_STYLES.active : SUBSCRIPTION_STYLES.inactive;
          return (
            <button
              key={productId}
              onClick={() => handleClick(productId)}
              disabled={disabled}
              aria-pressed={subscribed}
              aria-label={`${subscribed ? STRINGS.subscribePanel.ariaUnsubscribe : STRINGS.subscribePanel.ariaSubscribe} ${productId}`}
              className={[
                'flex items-center justify-between px-3 py-2.5 rounded-md border text-xs font-semibold tracking-wide transition-colors duration-150 w-full text-left',
                s.button,
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span>{productId}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {subscribed ? STRINGS.subscribePanel.subscribedLabel : STRINGS.subscribePanel.unsubscribedLabel}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
