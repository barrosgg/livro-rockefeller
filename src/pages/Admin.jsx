import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const ROLES = ['proprietario','gerente','trabalhador'];

export default function Admin() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = () => supabase.from('profiles').select('*').order('criado_em').then(({ data }) => {
    setProfiles(data || []); setLoading(false);
  });

  useEffect(() => { carregar(); }, []);

  const mudarRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) alert(error.message); else carregar();
  };

  return (
    <div className="page">
      <h1 className="mt-0">Administração</h1>
      <p className="muted">Atribua os papéis (somente Proprietário enxerga esta página).</p>
      <div className="divider" />
      {loading ? <p>Carregando…</p> : (
        <table className="book">
          <thead><tr><th>Nome</th><th>Discord</th><th>Identificação</th><th>Conta</th><th>Papel</th></tr></thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id}>
                <td>{p.nome_completo || <span className="muted">—</span>}</td>
                <td>{p.discord_handle || <span className="muted">—</span>}</td>
                <td>{p.identificacao || <span className="muted">—</span>}</td>
                <td>{p.conta_bancaria || <span className="muted">—</span>}</td>
                <td>
                  <select value={p.role} onChange={e => mudarRole(p.id, e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
