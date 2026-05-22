import { Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, isProfileComplete } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Perfil from './pages/Perfil.jsx';
import Pedidos from './pages/Pedidos.jsx';
import NovoPedido from './pages/NovoPedido.jsx';
import PedidoDetalhe from './pages/PedidoDetalhe.jsx';
import MeusTrabalhos from './pages/MeusTrabalhos.jsx';
import Admin from './pages/Admin.jsx';

function Topbar() {
  const { profile, signOut } = useAuth();
  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';
  return (
    <header className="topbar">
      <div className="brand">Caderno da Fazenda Rockefeller</div>
      <nav>
        <NavLink to="/pedidos" className={({isActive}) => isActive ? 'active' : ''}>Pedidos</NavLink>
        {isManager && <NavLink to="/novo" className={({isActive}) => isActive ? 'active' : ''}>Novo Pedido</NavLink>}
        <NavLink to="/meus" className={({isActive}) => isActive ? 'active' : ''}>Meus Trabalhos</NavLink>
        <NavLink to="/perfil" className={({isActive}) => isActive ? 'active' : ''}>Perfil</NavLink>
        {profile?.role === 'proprietario' && <NavLink to="/admin" className={({isActive}) => isActive ? 'active' : ''}>Admin</NavLink>}
      </nav>
      <div className="user">
        <span>{profile?.nome_completo || profile?.discord_handle || '...'}</span>
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
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="shell"><div className="page">Carregando…</div></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (!isProfileComplete(profile) && loc.pathname !== '/perfil') return <Navigate to="/perfil" replace />;
  if (allow && profile && !allow.includes(profile.role)) {
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
