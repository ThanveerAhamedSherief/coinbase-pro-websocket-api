import React, { useMemo } from 'react';
import { MatchUpdateMessage, ProductId } from '../types';
import { MATCH_VISIBLE_ROWS } from '../constants/limits';
import { formatTime, formatPrice, formatSize, TRADE_SIDE_TO_BOOK_SIDE } from '../utils/formats';
import { STRINGS } from '../constants/strings';
import { SIDE_STYLES } from '../constants/styles';

interface MatchViewProps {
  matches: MatchUpdateMessage[];
  subscriptions: Partial<Record<ProductId, boolean>>;
}

export const MatchView: React.FC<MatchViewProps> = ({ matches, subscriptions }) => {
  const filtered = useMemo(
    () => matches.filter((m) => subscriptions[m.product_id]).slice(0, MATCH_VISIBLE_ROWS),
    [matches, subscriptions],
  );

  const subscribedAny = Object.values(subscriptions).some(Boolean);

  return (
    <section className="panel">
      <div className="panel-title">
        {STRINGS.panels.matchView}
        {filtered.length > 0 && (
          <span className="text-dim font-normal ml-2">({filtered.length} {STRINGS.matchView.trades})</span>
        )}
      </div>

      {!subscribedAny ? (
        <div className="text-dim text-sm italic">{STRINGS.matchView.noSubs}</div>
      ) : filtered.length === 0 ? (
        <div className="text-dim text-sm italic">{STRINGS.matchView.waiting}</div>
      ) : (
        <div className="overflow-y-auto max-h-[420px] rounded border border-subtle">
          <table className="w-full border-collapse tabular-nums text-xs">
            <thead className="bg-deep sticky top-0 z-10">
              <tr>
                {STRINGS.matchView.columns.map((h, i) => (
                  <th
                    key={h}
                    className={`text-muted text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border-b border-subtle ${i >= 3 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((match) => {
                const side = TRADE_SIDE_TO_BOOK_SIDE[match.side];
                const s = SIDE_STYLES[side];
                return (
                  <tr
                    key={`${match.product_id}-${match.trade_id}`}
                    className={`border-b border-surface ${s.row}`}
                  >
                    <td className="px-2.5 py-1 text-muted whitespace-nowrap">{formatTime(match.time)}</td>
                    <td className="px-2.5 py-1 text-text whitespace-nowrap">{match.product_id}</td>
                    <td className="px-2.5 py-1 whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-px rounded text-[10px] font-bold tracking-wider ${s.badge}`}>
                        {match.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-text text-right whitespace-nowrap">{formatSize(match.size)}</td>
                    <td className={`px-2.5 py-1 text-right font-semibold whitespace-nowrap ${s.text}`}>{formatPrice(match.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
