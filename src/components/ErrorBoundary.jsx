import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Erro capturado:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="login-wrap">
          <div className="page login-card" style={{ maxWidth: 700, textAlign: 'left' }}>
            <h2>Algo deu errado nesta tela</h2>
            <p className="muted">
              Ocorreu um erro ao renderizar esta página. Os dados foram salvos —
              a navegação foi interrompida apenas visualmente.
            </p>
            <pre style={{
              background: '#fff',
              border: '1px solid var(--paper-edge)',
              padding: 12,
              fontSize: 12,
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: 240,
              whiteSpace: 'pre-wrap',
            }}>
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <div className="flex gap-1 mt-2">
              <button className="btn" onClick={() => window.location.assign('/pedidos')}>
                Voltar para Pedidos
              </button>
              <button className="btn ghost" onClick={() => window.location.reload()}>
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
