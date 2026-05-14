import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'full' | 'mini';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.variant === 'mini') {
        return (
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/40 rounded-lg">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <p className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-widest">Erro no Componente</p>
                <p className="text-[10px] text-rose-600 dark:text-rose-400">Este recurso está temporariamente indisponível.</p>
              </div>
            </div>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-[10px] font-bold text-rose-700 dark:text-rose-400 hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-center max-w-md">
            <div className="mb-6 inline-flex p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl">
              <span className="text-4xl">🚀</span>
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter uppercase">Ops! Algo deu errado.</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">Tivemos um pequeno problema durante a transição. Tente recarregar para restaurar o sistema.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all uppercase tracking-widest text-xs"
              >
                Recarregar Sistema
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors text-xs uppercase"
              >
                Voltar para a Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
