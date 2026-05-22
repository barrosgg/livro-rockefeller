import { Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, isProfileComplete } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Perfil from './pages/Perfil.jsx';
import Pedidos from './pages/Pedidos.jsx';
import NovoPedido from './pages/NovoPedido.jsx';
import PedidoDetalhe from './pages/PedidoDetalhe.jsx';
import MeusTrabalhos from './pages/MeusTrabalhos.jsx';
import Admin from './pages/Admin.jsx';
import PedidoPublico from './pages/PedidoPublico.jsx';
import CredencialPublica from './pages/CredencialPublica.jsx';
import ReciboPublico from './pages/ReciboPublico.jsx';
import Avatar from './components/Avatar.jsx';

function Topbar() {
  const { profile, signOut } = useAuth();
  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';
  return (
    <header className="topbar">
      <a href="/" className="brand" style={{ display: 'inline-flex', alignItems: 'center', borderBottom: 'none' }}>
        <img
          src="/familia-rockefeller.png"
          alt="Família Rockefeller"
          style={{ height: 52, width: 'auto', display: 'block' }}
        />
      </a>
      <nav>
        <NavLink to="/pedidos" className={({isActive}) => isActive ? 'active' : ''}>Pedidos</NavLink>
        {isManager && <NavLink to="/novo" className={({isActive}) => isActive ? 'active' : ''}>Novo Pedido</NavLink>}
        <NavLink to="/meus" className={({isActive}) => isActive ? 'active' : ''}>Meus Trabalhos</NavLink>
        <NavLink to="/perfil" className={({isActive}) => isActive ? 'active' : ''}>Perfil</NavLink>
        {profile?.role === 'proprietario' && <NavLink to="/admin" className={({isActive}) => isActive ? 'active' : ''}>Admin</NavLink>}
      </nav>
      <div className="user">
        <Avatar slug={profile?.avatar} name={profile?.nome_completo || profile?.discord_handle} size={32} />
        <span className="name">{profile?.nome_completo || profile?.discord_handle || '...'}</span>
        {profile?.role && <span className={`badge ${profile.role}`}>{profile.role}</span>}
        <button className="btn ghost sm" onClick={signOut}>Sair</button>
      </div>
    </header>
  );
}

function Layout() {
  return (
    <>
      <Topbar />
      <main className="shell"><Outlet /></main>
    </>
  );
}

function Protected({ children, allow }) {
  const { user, profile, loading, profileReady } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="shell"><div className="page">Carregando…</div></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  // Profile ainda carregando — mostra loader em vez de redirecionar (evita
  // F5 cair em /perfil por engano enquanto o profile não chegou)
  if (!profileReady || !profile) {
    return <div className="shell"><div className="page">Carregando perfil…</div></div>;
  }
  if (profile.disabled) {
    return (
      <div className="shell"><div className="page">
        <h2>Acesso suspenso</h2>
        <p className="muted">Sua conta foi desabilitada pelo Proprietário. Procure-o no Discord.</p>
      </div></div>
    );
  }
  if (!isProfileComplete(profile) && loc.pathname !== '/perfil') {
    return <Navigate to="/perfil" replace />;
  }
  if (allow && !allow.includes(profile.role)) {
    return <div className="page"><h2>Acesso restrito</h2><p className="muted">Esta página é exclusiva para: {allow.join(', ')}.</p></div>;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-wrap"><div className="page login-card">Carregando…</div></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/pedidos" replace /> : <Login />} />
      {/* Rotas públicas — sem auth */}
      <Route path="/p/:token" element={<PedidoPublico />} />
      <Route path="/r/:code" element={<ReciboPublico />} />
      <Route path="/c/:code" element={<CredencialPublica />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/pedidos" replace />} />
        <Route path="/perfil"       element={<Protected><Perfil /></Protected>} />
        <Route path="/pedidos"      element={<Protected><Pedidos /></Protected>} />
        <Route path="/pedidos/:id"  element={<Protected><PedidoDetalhe /></Protected>} />
        <Route path="/novo"         element={<Protected allow={['gerente','proprietario']}><NovoPedido /></Protected>} />
        <Route path="/meus"         element={<Protected><MeusTrabalhos /></Protected>} />
        <Route path="/admin"        element={<Protected allow={['proprietario']}><Admin /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
