import React from 'react';

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[Atlas renderer error boundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-atlas-gradient px-6">
        <div className="w-full max-w-[760px] rounded-[32px] border border-atlas-line bg-white/92 px-8 py-8 shadow-atlas">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-steel">Atlas Runtime Guard</p>
          <h1 className="mt-3 font-serif text-[2rem] leading-tight text-atlas-ink">O renderer encontrou um erro ao montar a interface.</h1>
          <p className="mt-3 text-sm leading-7 text-atlas-body/78">
            O Atlas preservou a aplicação com uma tela de erro controlada para evitar janela branca silenciosa.
          </p>
          {this.state.message ? (
            <pre className="mt-5 overflow-x-auto rounded-[18px] border border-atlas-line bg-atlas-panel px-4 py-4 text-xs leading-6 text-atlas-body/82">
              {this.state.message}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
