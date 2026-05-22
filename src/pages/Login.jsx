import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth.jsx';
import '../styles/login.css';

export default function Login() {
  const { signInDiscord } = useAuth();
  const tiltRef = useRef(null);

  /* Parallax 3D: o card inclina suavemente seguindo o mouse */
  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotY = (x - 0.5) * 8;     // -4° a +4°
      const rotX = (0.5 - y) * 6;     // -3° a +3°
      el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    };
    const onLeave = () => { el.style.transform = ''; };
    const wrap = el.parentElement;
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div className="login-stage">
      <div className="login-vignette" />
      <div className="login-dust" />
      <div className="login-mist" />

      <div className="login-card-wrap">
        <div className="login-card-tilt" ref={tiltRef}>
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

          <div className="stamp delay-1" style={{ display: 'inline-block' }}>
            <span className="seal">Anno Domini MCM</span>
          </div>

          <div className="login-decor-line" />

          <p className="ornament fade-up delay-2" style={{ marginTop: 16 }}>
            Caderno da Fazenda · Pedidos, Produção &amp; Pagamentos
          </p>

          <p className="muted fade-up delay-3" style={{ fontSize: '.92rem', marginTop: 14, lineHeight: 1.55 }}>
            Registro oficial de orçamentos, produção e remunerações da fazenda.
            Acesse com sua conta do Discord para continuar.
          </p>

          <div className="fade-up delay-4" style={{ marginTop: 22 }}>
            <button className="btn btn-discord lg" onClick={signInDiscord}>
              Entrar com Discord
            </button>
          </div>

          <p className="muted fade-up delay-5" style={{ fontSize: '.78rem', marginTop: 18, lineHeight: 1.5, fontStyle: 'italic' }}>
            Ao entrar pela primeira vez, você será solicitado a preencher seu perfil
            (nome completo, identificação, handle do Discord e conta bancária).
          </p>
        </div>
      </div>
    </div>
  );
}
