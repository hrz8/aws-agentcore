import { Component, type ErrorInfo as ReactErrorInfo, type ReactNode } from 'react';

import { AppErrorView } from './app-error-view';

interface Props {
  children: ReactNode;
  fallback?: (error: unknown) => ReactNode;
}

interface State {
  error?: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ReactErrorInfo): void {
    console.error('[error-boundary]', error, info);
  }

  render(): ReactNode {
    if (this.state.error != null) {
      const { fallback } = this.props;
      if (fallback != null) return fallback(this.state.error);
      return <AppErrorView error={this.state.error} />;
    }
    return this.props.children;
  }
}
