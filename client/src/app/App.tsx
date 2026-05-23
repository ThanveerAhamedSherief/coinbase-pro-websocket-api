import React from 'react';
import { useWebSocket } from '../shared/hooks/useWebSocket';
import { useTheme } from '../shared/hooks/useTheme';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { SubscribePanel } from '../shared/components/SubscribePanel';
import { PriceView } from '../shared/components/PriceView';
import { MatchView } from '../shared/components/MatchView';
import { SystemStatus } from '../shared/components/SystemStatus';
import { ConnectionStatus, SUPPORTED_PRODUCTS } from '../shared/types';
import { STRINGS } from '../shared/constants/strings';

const App: React.FC = () => {
  const {
    connectionStatus,
    subscriptions,
    orderBooks,
    matches,
    systemChannels,
    feedRate,
    subscribe,
    unsubscribe,
  } = useWebSocket();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-base text-text font-mono p-5">
      <header className="flex items-center justify-between mb-5 pb-4 border-b border-subtle">
        <div>
          <div className="text-lg font-bold text-text tracking-wide">
            <span className="text-green">◈</span> {STRINGS.app.title}
          </div>
          <div className="text-muted text-[11px] mt-0.5">
            {STRINGS.app.subtitle} — {SUPPORTED_PRODUCTS.join(' · ')}
          </div>
        </div>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? STRINGS.theme.switchToLight : STRINGS.theme.switchToDark}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-surface text-muted text-base hover:text-text hover:border-muted transition-colors duration-150 cursor-pointer"
        >
          {theme === 'dark' ? STRINGS.theme.iconLight : STRINGS.theme.iconDark}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <ErrorBoundary label={STRINGS.panels.subscribe}>
          <SubscribePanel
            subscriptions={subscriptions}
            onSubscribe={subscribe}
            onUnsubscribe={unsubscribe}
            disabled={connectionStatus !== ConnectionStatus.Connected}
          />
        </ErrorBoundary>
        <ErrorBoundary label={STRINGS.panels.systemStatus}>
          <SystemStatus channels={systemChannels} connectionStatus={connectionStatus} feedRate={feedRate} />
        </ErrorBoundary>
      </div>

      <div className="mb-4">
        <ErrorBoundary label={STRINGS.panels.priceView}>
          <PriceView orderBooks={orderBooks} subscriptions={subscriptions} />
        </ErrorBoundary>
      </div>

      <div className="mb-4">
        <ErrorBoundary label={STRINGS.panels.matchView}>
          <MatchView matches={matches} subscriptions={subscriptions} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;
