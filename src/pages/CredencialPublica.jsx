import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import Credencial from '../components/Credencial.jsx';
import '../styles/credencial.css';

export default function CredencialPublica() {
  const { code } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let alive = true;
    const carregar = async () => {
      const { data, error } = await supabase.rpc('get_profile_public', { p_code: code });
      if (!alive) return;
      if (error) { setErro(error.message); setLoading(false); return; }
      setProfile(data);
      setLoading(false);
    };
    carregar();
    return () => { alive = false; };
  }, [code]);

  if (loading) return (
    <div className="login-wrap"><div className="page login-card">Buscando credencial…</div></div>
  );

  if (erro || !profile) return (
    <div className="login-wrap">
      <div className="page login-card">
        <h2>Credencial não encontrada</h2>
        <p className="muted">O link pode estar incorreto, ou esta conta foi suspensa.</p>
      </div>
    </div>
  );

  return (
    <div className="shell">
      <div className="credencial-stage">
        <Credencial profile={profile} />
        <p className="muted center mt-3" style={{ fontSize: '.8rem', fontStyle: 'italic' }}>
          Credencial oficial · Família Rockefeller · Livro da Fazenda
        </p>
      </div>
    </div>
  );
}
