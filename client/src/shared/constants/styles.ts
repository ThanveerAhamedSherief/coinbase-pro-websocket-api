import { ConnectionStatus } from '../types';

export const CONNECTION_STYLES: Record<ConnectionStatus, { text: string; dot: string }> = {
  [ConnectionStatus.Connected]:    { text: 'text-green', dot: 'bg-green shadow-[0_0_6px_#3fb950]' },
  [ConnectionStatus.Connecting]:   { text: 'text-amber', dot: 'bg-amber' },
  [ConnectionStatus.Reconnecting]: { text: 'text-amber', dot: 'bg-amber' },
  [ConnectionStatus.Disconnected]: { text: 'text-red',   dot: 'bg-red'   },
};

export const SIDE_STYLES = {
  bid: {
    text:       'text-green',
    row:        'bg-green/5',
    badge:      'bg-green/25 text-green',
    dot:        'bg-green shadow-[0_0_4px_#3fb950]',
  },
  ask: {
    text:       'text-red',
    row:        'bg-red/5',
    badge:      'bg-red/25 text-red',
    dot:        'bg-red',
  },
} as const;

export const ERROR_TEXT   = 'text-red';
export const ERROR_BORDER = 'border-red/40';

export const SUBSCRIPTION_STYLES = {
  active: {
    button: 'border-green/60 bg-green/10 text-green',
    badge:  'bg-green/20 text-green',
    dot:    'bg-green shadow-[0_0_5px_#3fb950]',
  },
  inactive: {
    button: 'border-border bg-deep text-muted',
    badge:  'bg-dim/20 text-muted',
    dot:    'bg-dim',
  },
} as const;
