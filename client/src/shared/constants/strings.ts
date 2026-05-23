export const STRINGS = {
  app: {
    title:    'Coinbase Pro Live Feed',
    subtitle: 'Real-time WebSocket market data',
  },

  theme: {
    switchToLight: 'Switch to light theme',
    switchToDark:  'Switch to dark theme',
    iconLight:     '☀',
    iconDark:      '☾',
  },

  connection: {
    connected:    'Connected',
    connecting:   'Connecting…',
    reconnecting: 'Reconnecting…',
    disconnected: 'Disconnected',
  },

  panels: {
    subscribe:    'Subscribe / Unsubscribe',
    systemStatus: 'System Status',
    priceView:    'Price View — Order Book (Level 2)',
    matchView:    'Match View — Trade Blotter',
  },

  subscribePanel: {
    subscribedLabel:   'SUBSCRIBED',
    unsubscribedLabel: 'UNSUBSCRIBED',
    ariaSubscribe:   'Subscribe to',
    ariaUnsubscribe: 'Unsubscribe from',
  },

  systemStatus: {
    feedRateLabel: 'Feed Rate',
    feedRateUnit:  'msg/s',
    feedRateEmpty: '—',
    noChannels:    'No active subscriptions. Subscribe to a product to begin.',
    noProducts:    'no products',
    channelNames: {
      level2_50:    'Order Book (Level 2)',
      level2_batch: 'Order Book (Level 2)',
      matches:      'Trades',
    } as Record<string, string>,
  },

  priceView: {
    bids:   'Bids',
    asks:   'Asks',
    waiting: 'Waiting…',
    noSubs: 'No subscriptions active. Subscribe to a product above.',
  },

  matchView: {
    trades:  'trades',
    noSubs:  'Subscribe to a product to see trades.',
    waiting: 'Waiting for trades…',
    columns: ['Time', 'Product', 'Side', 'Size', 'Price'] as const,
  },

  errorBoundary: {
    renderError: 'render error',
  },
} as const;
