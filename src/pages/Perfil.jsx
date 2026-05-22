import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';

export default function Perfil() {
  const { profile, refreshProfile, user } = useAuth();
  const [form, setForm] = useState({
    nome_completo: '', identificacao: '', discord_handle: '', conta_bancaria: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (profile) {
      setForm({
        nome_completo: profile.nome_completo || '',
        identificacao: profile.identificacao || '',
        discord_handle: profile.discord_handle || '',
        conta_bancaria: profile.conta_bancaria || '',
      });
    }
  }, [profile]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id);
    setSaving(false);
    if (error) { setMsg({ type: 'err', text: error.message }); return; }
    setMsg({ type: 'ok', text: 'Perfil salvo.' });
    refreshProfile();
  };

  return (
    <div className="page">
      <div className="flex between center-y">
        <h1 className="mt-0">Perfil do Trabalhador</h1>
        <span className={`badge ${profile?.role}`}>{profile?.role}</span>
      </div>
      <p className="muted">Mantenha seus dados atualizados — são usados para pagamento e identificação.</p>
      <div className="divider" />
      <form onSubmit={submit} className="row">
        <div style={{ minWidth: 300 }}>
          <div className="field">
            <label>Nome completo</label>
            <input type="text" required value={form.nome_completo} onChange={set('nome_completo')} />
          </div>
          <div className="field">
            <label>Identificação</label>
            <input type="text" required value={form.identificacao} onChange={set('identificacao')} placeholder="RG / passaporte / ID do personagem" />
          </div>
        </div>
        <div style={{ minWidth: 300 }}>
          <div className="field">
            <label>Handle do Discord</label>
            <input type="text" required value={form.discord_handle} onChange={set('discord_handle')} placeholder="usuario#0000 ou @usuario" />
          </div>
          <div className="field">
            <label>Conta bancária</label>
            <input type="text" required value={form.conta_bancaria} onChange={set('conta_bancaria')} placeholder="Número da conta para pagamento" />
          </div>
        </div>
        <div style={{ flexBasis: '100%' }}>
          <button className="btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar Perfil'}</button>
          {msg && <span className="muted" style={{ marginLeft: 12, color: msg.type === 'err' ? '#7a1f15' : 'inherit' }}>{msg.text}</span>}
        </div>
      </form>
    </div>
  );
}
