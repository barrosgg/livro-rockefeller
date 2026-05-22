import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { signInDiscord } = useAuth();
  return (
    <div className="login-wrap">
      <div className="page login-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img
            src="/familia-rockefeller.png"
            alt="Família Rockefeller"
            style={{ maxWidth: '100%', height: 'auto', maxHeight: 140 }}
          />
        </div>
        <div className="seal">Anno Domini MCM</div>
        <p className="ornament mt-2">Caderno da Fazenda · Pedidos, Produção & Pagamentos</p>
        <p className="muted mt-2">
          Registro oficial de orçamentos, produção e remunerações da fazenda.
          Acesse com sua conta do Discord para continuar.
        </p>
        <div className="mt-3">
          <button className="btn" onClick={signInDiscord}>Entrar com Discord</button>
        </div>
        <p className="muted mt-3" style={{ fontSize: '.85rem' }}>
          Ao entrar pela primeira vez, você será solicitado a preencher seu perfil
          (nome completo, identificação, handle do Discord e conta bancária).
        </p>
      </div>
    </div>
  );
}
