import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import Avatar from '../components/Avatar.jsx';

export default function Perfil() {
  const { profile, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome_completo: '',
    identificacao: '',
    discord_handle: '',
    conta_bancaria: '',
    correio: '',
    avatar: '',
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
        correio: profile.correio || '',
        avatar: profile.avatar || '',
      });
    }
  }, [profile]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const payload = {
      nome_completo: form.nome_completo,
      identificacao: form.identificacao,
      discord_handle: form.discord_handle,
      conta_bancaria: form.conta_bancaria,
      correio: form.correio || null,
      avatar: form.avatar?.trim() || null,
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id).select().single();
    setSaving(false);
    if (error) { setMsg({ type: 'err', text: error.message }); return; }
    setMsg({ type: 'ok', text: 'Perfil salvo.' });
    await refreshProfile();
    if (!isProfileComplete(profile)) {
      navigate('/pedidos', { replace: true });
    }
  };

  return (
    <div className="page">
      <div className="flex between center-y">
        <h1 className="mt-0">Perfil do Trabalhador</h1>
        <span className={`badge ${profile?.role}`}>{profile?.role}</span>
      </div>
      <p className="muted">Mantenha seus dados atualizados — são usados para pagamento e identificação.</p>
      <hr className="divider" />

      <form onSubmit={submit}>
        {/* Avatar — preview + input URL */}
        <div className="flex gap-2 center-y" style={{ marginBottom: 22 }}>
          <Avatar slug={form.avatar} name={form.nome_completo} size={72} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{
              fontFamily: "'Lora', serif", fontSize: '.8rem', fontWeight: 600,
              color: 'var(--ink-soft)', display: 'block', marginBottom: 5,
            }}>
              Avatar (URL da imagem)
            </label>
            <input
              type="url"
              placeholder="https://i.imgur.com/seuavatar.png (opcional)"
              value={form.avatar}
              onChange={set('avatar')}
              style={{ width: '100%' }}
            />
            <div className="hint" style={{ marginTop: 4 }}>
              Cole o link direto de uma imagem. Sem link, mostramos as suas iniciais.
            </div>
          </div>
        </div>

        <div className="row">
          <div style={{ minWidth: 300, flex: 1 }}>
            <div className="field">
              <label>Nome completo</label>
              <input type="text" required value={form.nome_completo} onChange={set('nome_completo')} />
            </div>
            <div className="field">
              <label>Identificação</label>
              <input type="text" required value={form.identificacao} onChange={set('identificacao')}
                placeholder="RG / passaporte / ID do personagem" />
            </div>
            <div className="field">
              <label>Correio (PO Box)</label>
              <input type="text" value={form.correio} onChange={set('correio')}
                placeholder="Endereço de correio do personagem" />
            </div>
          </div>
          <div style={{ minWidth: 300, flex: 1 }}>
            <div className="field">
              <label>Handle do Discord</label>
              <input type="text" required value={form.discord_handle} onChange={set('discord_handle')}
                placeholder="usuario#0000 ou @usuario" />
            </div>
            <div className="field">
              <label>Conta bancária</label>
              <input type="text" required value={form.conta_bancaria} onChange={set('conta_bancaria')}
                placeholder="Número da conta para pagamento" />
            </div>
          </div>
        </div>
        <div className="mt-2">
          <button className="btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar Perfil'}</button>
          {msg && (
            <span className="muted" style={{
              marginLeft: 12, color: msg.type === 'err' ? 'var(--burgundy)' : 'inherit',
            }}>{msg.text}</span>
          )}
        </div>
      </form>
    </div>
  );
}
