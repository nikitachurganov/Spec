import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error('[UI] ErrorBoundary caught render error', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{ padding: 16, fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Plugin UI crashed</h2>
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#4E4E4E' }}>
          {this.state.message || 'Unknown UI error'}
        </p>
        <button type="button" onClick={this.handleReload}>
          Reload UI
        </button>
      </div>
    );
  }
}
