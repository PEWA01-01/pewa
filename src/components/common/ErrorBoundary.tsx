import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0b] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#121216] border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Something went wrong</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                PEWA encountered an unexpected issue. Don't worry, your data is safe.
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 hover:opacity-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload PEWA App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
