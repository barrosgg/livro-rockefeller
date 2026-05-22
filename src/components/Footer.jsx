import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer" aria-label="Rodapé da fazenda">
      <div className="site-footer-inner">
        <div className="site-footer-divisor" aria-hidden="true">
          <span className="ornament-left" />
          <span className="ornament-flor">❦</span>
          <span className="ornament-right" />
        </div>

        <div className="site-footer-brand">
          <img
            src="/familia-rockefeller.png"
            alt=""
            aria-hidden="true"
            className="site-footer-logo"
          />
        </div>

        <div className="site-footer-empresa">
          Rockefeller Produtos Agropecuários S.A.
          <div className="site-footer-end">
            Flatneck Station · New Hanover · Westfox
          </div>
        </div>

        <nav className="site-footer-nav" aria-label="Navegação do rodapé">
          <Link to="/ajuda">Ajuda</Link>
          <span aria-hidden="true">·</span>
          <Link to="/perfil">Credencial</Link>
          <span aria-hidden="true">·</span>
          <Link to="/pedidos">Pedidos</Link>
        </nav>

        <div className="site-footer-anno">
          ❧ Anno MCMI ❧
        </div>
      </div>
    </footer>
  );
}
