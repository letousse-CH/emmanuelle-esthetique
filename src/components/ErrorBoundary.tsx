import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex flex-col items-center justify-center text-center px-6">
          <p className="text-stone-500 text-sm mb-2 uppercase tracking-widest">Une erreur est survenue</p>
          <h1 className="text-2xl font-serif text-stone-800 mb-6">
            Cette page n'a pas pu se charger
          </h1>
          <p className="text-stone-400 text-sm mb-8 max-w-sm">
            Rechargez la page ou revenez à l'accueil. Si le problème persiste, contactez le support.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-stone-800 text-white text-sm rounded hover:bg-stone-700 transition-colors"
            >
              Recharger
            </button>
            <a
              href="/"
              className="px-5 py-2 border border-stone-300 text-stone-600 text-sm rounded hover:border-stone-400 transition-colors"
            >
              Accueil
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
