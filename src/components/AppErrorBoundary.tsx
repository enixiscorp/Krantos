// ============================================================
// Krantos Platform — Error boundary
// ============================================================
// Without it, any error during rendering unmounts the whole app and leaves a
// blank page. Also handles the "new version deployed" case: the old page
// asks for JS chunks that no longer exist → reload once to get the new ones.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

const RELOAD_FLAG = 'krantos:chunkReloadAt';

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);

    if (isChunkLoadError(error)) {
      // Reload at most once per minute to avoid a reload loop
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0); } catch { /* storage unavailable */ }
      if (Date.now() - last > 60_000) {
        try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch { /* storage unavailable */ }
        window.location.reload();
      }
    }
  }

  private retry = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center glass-card p-10 rounded-[2rem] border border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-7 h-7 text-yellow-400" />
          </div>
          <h1 className="text-xl font-black text-white mb-2">Un problème est survenu</h1>
          <p className="text-gray-400 text-sm mb-8">
            L'affichage a été interrompu. Rechargez la page pour continuer, vos données ne sont pas perdues.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-yellow-400 text-gray-900 font-black text-sm hover:bg-yellow-500 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
