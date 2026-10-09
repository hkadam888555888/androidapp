import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

/** Last-resort UI for unexpected rendering errors; never silently leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Avoid sending app data or stack traces to a third party. Diagnostics remain local.
  }

  render() {
    if (this.state.hasError) {
      return <main className="app-error" role="alert" aria-live="assertive">
        <div className="app-error-card">
          <div className="brand-mark" aria-hidden="true">AR</div>
          <h1>Something went wrong</h1>
          <p>The app hit an unexpected interface error. Your previously saved local data has not been intentionally cleared.</p>
          {this.state.message && <details><summary>Technical details</summary><pre>{this.state.message}</pre></details>}
          <button className="button primary" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      </main>;
    }
    return this.props.children;
  }
}
