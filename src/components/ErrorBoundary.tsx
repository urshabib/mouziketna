import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    console.error('[MOUZIKA] Caught unhandled rendering error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      // Clear potentially corrupt temporary playback cache while keeping user library
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  private handleFullReset = () => {
    try {
      localStorage.removeItem('taste_profile_v2');
      localStorage.removeItem('recent_searches');
      localStorage.removeItem('mouzika_now_playing');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0d0905] text-[#f5f5f7] p-6 text-center font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-3xl">
            <span className="text-[#ff6b1a]">⚡</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
            MOUZIKA encountered an unexpected issue while loading. You can reload the application or reset cached data to continue.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReset}
              className="w-full py-3 px-6 rounded-full bg-[#ff6b1a] text-black font-semibold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#ff6b1a]/20"
            >
              Reload App
            </button>
            <button
              onClick={this.handleFullReset}
              className="w-full py-3 px-6 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 active:scale-95 transition-all"
            >
              Reset Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
