import React, { Component, ReactNode } from 'react';
import { STRINGS } from '../constants/strings';
import { ERROR_TEXT, ERROR_BORDER } from '../constants/styles';

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <section className={`panel ${ERROR_BORDER}`}>
          <div className={`${ERROR_TEXT} text-xs font-bold uppercase tracking-wider mb-1`}>
            {this.props.label} — {STRINGS.errorBoundary.renderError}
          </div>
          <div className="text-muted text-[11px] font-mono break-all">
            {this.state.error.message}
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
