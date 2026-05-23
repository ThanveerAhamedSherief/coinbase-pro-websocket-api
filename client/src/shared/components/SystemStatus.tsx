import React from 'react';
import { CoinbaseChannelInfo, ConnectionStatus } from '../types';
import { STRINGS } from '../constants/strings';
import { CONNECTION_STYLES } from '../constants/styles';

interface SystemStatusProps {
  channels: CoinbaseChannelInfo[];
  connectionStatus: ConnectionStatus;
  feedRate: number;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  [ConnectionStatus.Connected]:    STRINGS.connection.connected,
  [ConnectionStatus.Connecting]:   STRINGS.connection.connecting,
  [ConnectionStatus.Reconnecting]: STRINGS.connection.reconnecting,
  [ConnectionStatus.Disconnected]: STRINGS.connection.disconnected,
};

export const SystemStatus: React.FC<SystemStatusProps> = ({ channels, connectionStatus, feedRate }) => {
  const { text, dot } = CONNECTION_STYLES[connectionStatus];
  const isConnected = connectionStatus === ConnectionStatus.Connected;

  return (
    <section className="panel">
      <div className="flex justify-between items-center mb-3">
        <div className="panel-title mb-0">{STRINGS.panels.systemStatus}</div>
        <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {STATUS_LABEL[connectionStatus]}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-3 py-2 bg-deep rounded border border-subtle">
        <span className="text-muted text-[10px] font-bold uppercase tracking-wider">{STRINGS.systemStatus.feedRateLabel}</span>
        <span className={`tabular-nums text-xs font-semibold ${isConnected ? 'text-accent' : 'text-dim'}`}>
          {isConnected ? `${feedRate} ${STRINGS.systemStatus.feedRateUnit}` : STRINGS.systemStatus.feedRateEmpty}
        </span>
      </div>

      {channels.length === 0 ? (
        <div className="text-dim text-sm italic">{STRINGS.systemStatus.noChannels}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {channels.map((ch) => (
            <div key={ch.name} className="bg-deep rounded border border-subtle px-3 py-2">
              <div className="text-accent text-xs font-bold mb-1">
                {STRINGS.systemStatus.channelNames[ch.name] ?? ch.name}
              </div>
              <div className="flex flex-wrap gap-1">
                {ch.product_ids.length === 0 ? (
                  <span className="text-dim text-[11px] italic">{STRINGS.systemStatus.noProducts}</span>
                ) : (
                  ch.product_ids.map((pid) => (
                    <span key={pid} className="tag">{pid}</span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
