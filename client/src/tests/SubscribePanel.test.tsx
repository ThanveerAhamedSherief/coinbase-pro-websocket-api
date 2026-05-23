import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscribePanel } from '../shared/components/SubscribePanel';
import { ProductId, SUPPORTED_PRODUCTS } from '../shared/types';

describe('SubscribePanel', () => {
  const onSubscribe   = vi.fn();
  const onUnsubscribe = vi.fn();

  beforeEach(() => {
    onSubscribe.mockClear();
    onUnsubscribe.mockClear();
  });

  it('renders a button for every supported product', () => {
    render(
      <SubscribePanel
        subscriptions={{}}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
      />,
    );
    for (const pid of SUPPORTED_PRODUCTS) {
      expect(screen.getByRole('button', { name: new RegExp(pid) })).toBeInTheDocument();
    }
  });

  it('shows UNSUBSCRIBED badge when not subscribed', () => {
    render(
      <SubscribePanel
        subscriptions={{}}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
      />,
    );
    const btcBtn = screen.getByRole('button', { name: /BTC-USD/ });
    expect(btcBtn).toHaveAttribute('aria-pressed', 'false');
    // Badge text lives in a nested span — query within the button
    expect(within(btcBtn).getByText('UNSUBSCRIBED')).toBeInTheDocument();
  });

  it('shows SUBSCRIBED badge when subscribed', () => {
    render(
      <SubscribePanel
        subscriptions={{ 'BTC-USD': true }}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
      />,
    );
    const btcBtn = screen.getByRole('button', { name: /BTC-USD/ });
    expect(btcBtn).toHaveAttribute('aria-pressed', 'true');
    expect(within(btcBtn).getByText('SUBSCRIBED')).toBeInTheDocument();
  });

  it('calls onSubscribe when clicking an unsubscribed product', () => {
    render(
      <SubscribePanel
        subscriptions={{}}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /BTC-USD/ }));
    expect(onSubscribe).toHaveBeenCalledWith('BTC-USD' as ProductId);
    expect(onUnsubscribe).not.toHaveBeenCalled();
  });

  it('calls onUnsubscribe when clicking a subscribed product', () => {
    render(
      <SubscribePanel
        subscriptions={{ 'ETH-USD': true }}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /ETH-USD/ }));
    expect(onUnsubscribe).toHaveBeenCalledWith('ETH-USD' as ProductId);
    expect(onSubscribe).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when disabled', () => {
    render(
      <SubscribePanel
        subscriptions={{}}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
        disabled
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /BTC-USD/ }));
    expect(onSubscribe).not.toHaveBeenCalled();
    expect(onUnsubscribe).not.toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <SubscribePanel
        subscriptions={{}}
        onSubscribe={onSubscribe}
        onUnsubscribe={onUnsubscribe}
        disabled
      />,
    );
    for (const pid of SUPPORTED_PRODUCTS) {
      expect(screen.getByRole('button', { name: new RegExp(pid) })).toBeDisabled();
    }
  });
});
