import { useAuth } from '../lib/auth.jsx';
import '../styles/login.css';

export default function Login() {
  const { signInDiscord } = useAuth();

  return (
    <div className="login-stage">
      <img
        src="/imagem-fazenda.png"
        alt=""
        aria-hidden="true"
        className="login-bg-img"
      />
      <div className="login-vignette" />
      <div className="login-dust" />
      <div className="login-mist" />

      <div className="login-card-wrap">
        <div className="login-card-tilt">
          <span className="login-corner tl" />
          <span className="login-corner tr" />
          <span className="login-corner bl" />
          <span className="login-corner br" />

          <div className="zoom-in" style={{ marginBottom: 14 }}>
            <img
              src="/familia-rockefeller.png"
              alt="Família Rockefeller"
              style={{ maxWidth: '100%', height: 'auto', maxHeight: 130, display: 'block', margin: '0 auto' }}
            />
          </div>

          <div className="login-decor-line" />

          <p className="ornament fade-up delay-2" style={{ marginTop: 16 }}>
            Livro da Fazenda · Pedidos, Produção &amp; Pagamentos
          </p>

          <p className="muted fade-up delay-3" style={{ fontSize: '.92rem', marginTop: 14, lineHeight: 1.55 }}>
            Registro oficial de orçamentos, produção e remunerações da fazenda.
            Acesse com sua conta do Discord para continuar.
          </p>

          <div className="fade-up delay-4" style={{ marginTop: 22 }}>
            <button
              type="button"
              className="btn btn-discord lg"
              onClick={() => { signInDiscord?.(); }}
            >
              Entrar com Discord
            </button>
          </div>

          <p className="muted fade-up delay-5" style={{ fontSize: '.78rem', marginTop: 18, lineHeight: 1.5, fontStyle: 'italic' }}>
            Ao entrar pela primeira vez, você será solicitado a preencher seu perfil
            (nome completo, identificação, handle do Discord, conta bancária e correio).
          </p>
        </div>
      </div>
    </div>
  );
}
