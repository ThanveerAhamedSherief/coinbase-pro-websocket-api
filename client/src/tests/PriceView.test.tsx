import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PriceView } from '../shared/components/PriceView';
import { OrderBooks } from '../shared/types';

const emptyBooks: OrderBooks = {};

describe('PriceView', () => {
  it('shows subscribe prompt when no subscriptions are active', () => {
    render(<PriceView orderBooks={emptyBooks} subscriptions={{}} />);
    expect(screen.getByText(/No subscriptions active/)).toBeInTheDocument();
  });

  it('renders the product heading for a subscribed product', () => {
    render(
      <PriceView
        orderBooks={emptyBooks}
        subscriptions={{ 'BTC-USD': true }}
      />,
    );
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
  });

  it('shows "Waiting…" for bids and asks when no order book data yet', () => {
    render(
      <PriceView
        orderBooks={emptyBooks}
        subscriptions={{ 'BTC-USD': true }}
      />,
    );
    const waiting = screen.getAllByText('Waiting…');
    expect(waiting).toHaveLength(2);
  });

  it('renders bid and ask prices from order book data', () => {
    const books: OrderBooks = {
      'BTC-USD': {
        bids: [{ price: '50000.00', size: '1.5' }],
        asks: [{ price: '50001.00', size: '0.8' }],
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    };
    render(<PriceView orderBooks={books} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText('50,000.00')).toBeInTheDocument();
    expect(screen.getByText('50,001.00')).toBeInTheDocument();
  });

  it('renders bid and ask sizes', () => {
    const books: OrderBooks = {
      'BTC-USD': {
        bids: [{ price: '50000.00', size: '1.500000' }],
        asks: [{ price: '50001.00', size: '0.800000' }],
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    };
    render(<PriceView orderBooks={books} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText('1.500000')).toBeInTheDocument();
    expect(screen.getByText('0.800000')).toBeInTheDocument();
  });

  it('renders multiple subscribed products', () => {
    render(
      <PriceView
        orderBooks={emptyBooks}
        subscriptions={{ 'BTC-USD': true, 'ETH-USD': true }}
      />,
    );
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
    expect(screen.getByText('ETH-USD')).toBeInTheDocument();
  });

  it('does not render unsubscribed products', () => {
    render(
      <PriceView
        orderBooks={emptyBooks}
        subscriptions={{ 'BTC-USD': true }}
      />,
    );
    expect(screen.queryByText('ETH-USD')).toBeNull();
  });

  it('formats small prices with 4 decimal places', () => {
    const books: OrderBooks = {
      'XRP-USD': {
        bids: [{ price: '0.5432', size: '100' }],
        asks: [{ price: '0.5433', size: '200' }],
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    };
    render(<PriceView orderBooks={books} subscriptions={{ 'XRP-USD': true }} />);
    expect(screen.getByText('0.5432')).toBeInTheDocument();
  });
});
