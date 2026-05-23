import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MatchView } from '../shared/components/MatchView';
import { MatchUpdateMessage } from '../shared/types';

function makeMatch(overrides: Partial<MatchUpdateMessage> = {}): MatchUpdateMessage {
  return {
    type: 'match',
    trade_id: 1,
    time: '2024-01-01T12:00:00.000Z',
    product_id: 'BTC-USD',
    size: '0.001000',
    price: '50000.00',
    side: 'buy',
    ...overrides,
  };
}

describe('MatchView', () => {
  it('shows subscribe prompt when nothing is subscribed', () => {
    render(<MatchView matches={[]} subscriptions={{}} />);
    expect(screen.getByText(/Subscribe to a product/)).toBeInTheDocument();
  });

  it('shows waiting message when subscribed but no trades yet', () => {
    render(<MatchView matches={[]} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText(/Waiting for trades/)).toBeInTheDocument();
  });

  it('renders a row for each matching trade', () => {
    const matches = [
      makeMatch({ trade_id: 1, product_id: 'BTC-USD', side: 'buy' }),
      makeMatch({ trade_id: 2, product_id: 'BTC-USD', side: 'sell' }),
    ];
    render(<MatchView matches={matches} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('filters out trades for unsubscribed products', () => {
    const matches = [
      makeMatch({ product_id: 'BTC-USD', trade_id: 1 }),
      makeMatch({ product_id: 'ETH-USD', trade_id: 2 }),
    ];
    render(<MatchView matches={matches} subscriptions={{ 'BTC-USD': true }} />);
    const rows = screen.getAllByText('BTC-USD');
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.queryByText('ETH-USD')).toBeNull();
  });

  it('shows the trade count in the title', () => {
    const matches = [makeMatch({ trade_id: 1 }), makeMatch({ trade_id: 2 })];
    render(<MatchView matches={matches} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText('(2 trades)')).toBeInTheDocument();
  });

  it('shows the correct price for each row', () => {
    const matches = [makeMatch({ price: '95432.50', side: 'buy' })];
    render(<MatchView matches={matches} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText('95,432.50')).toBeInTheDocument();
  });

  it('shows the correct size for each row', () => {
    const matches = [makeMatch({ size: '1.234567' })];
    render(<MatchView matches={matches} subscriptions={{ 'BTC-USD': true }} />);
    expect(screen.getByText('1.234567')).toBeInTheDocument();
  });
});
