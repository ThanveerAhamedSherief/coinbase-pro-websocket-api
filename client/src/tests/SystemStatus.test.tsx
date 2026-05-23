import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SystemStatus } from '../shared/components/SystemStatus';
import { ConnectionStatus } from '../shared/types';

const noChannels = [] as { name: string; product_ids: string[] }[];

describe('SystemStatus', () => {
  describe('connection status display', () => {
    it('shows Connected label when connected', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Connected} feedRate={0} />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows Connecting label when connecting', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Connecting} feedRate={0} />);
      expect(screen.getByText('Connecting…')).toBeInTheDocument();
    });

    it('shows Reconnecting label when reconnecting', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Reconnecting} feedRate={0} />);
      expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
    });

    it('shows Disconnected label when disconnected', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Disconnected} feedRate={0} />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('feed rate display', () => {
    it('shows msg/s when connected', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Connected} feedRate={42} />);
      expect(screen.getByText('42 msg/s')).toBeInTheDocument();
    });

    it('shows dash when disconnected', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Disconnected} feedRate={0} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('shows zero rate when connected but idle', () => {
      render(<SystemStatus channels={noChannels} connectionStatus={ConnectionStatus.Connected} feedRate={0} />);
      expect(screen.getByText('0 msg/s')).toBeInTheDocument();
    });
  });

  describe('channel list', () => {
    it('shows empty state message when no channels', () => {
      render(<SystemStatus channels={[]} connectionStatus={ConnectionStatus.Disconnected} feedRate={0} />);
      expect(screen.getByText(/No active subscriptions/)).toBeInTheDocument();
    });

    it('renders channel name and its product ids', () => {
      const channels = [
        { name: 'level2_batch', product_ids: ['BTC-USD', 'ETH-USD'] },
        { name: 'matches',      product_ids: ['BTC-USD'] },
      ];
      render(<SystemStatus channels={channels} connectionStatus={ConnectionStatus.Connected} feedRate={5} />);
      expect(screen.getByText('Order Book (Level 2)')).toBeInTheDocument();
      expect(screen.getByText('Trades')).toBeInTheDocument();
      expect(screen.getAllByText('BTC-USD')).toHaveLength(2);
      expect(screen.getByText('ETH-USD')).toBeInTheDocument();
    });

    it('shows "no products" for a channel with empty product list', () => {
      const channels = [{ name: 'level2_batch', product_ids: [] }];
      render(<SystemStatus channels={channels} connectionStatus={ConnectionStatus.Connected} feedRate={0} />);
      expect(screen.getByText('no products')).toBeInTheDocument();
    });
  });
});
