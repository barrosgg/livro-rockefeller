import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import Avatar from '../components/Avatar.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';

export default function Perfil() {
  const { profile, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome_completo: '', identificacao: '', discord_handle: '', conta_bancaria: '', avatar: null,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        nome_completo: profile.nome_completo || '',
        identificacao: profile.identificacao || '',
        discord_handle: profile.discord_handle || '',
        conta_bancaria: profile.conta_bancaria || '',
        avatar: profile.avatar || null,
      });
    }
  }, [profile]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id).select().single();
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
        {/* Avatar */}
        <div className="flex gap-2 center-y" style={{ marginBottom: 18 }}>
          <Avatar slug={form.avatar} name={form.nome_completo} size={72} />
          <div>
            <div className="muted small" style={{ fontWeight: 600, letterSpacing: 0 }}>SEU PERSONAGEM</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem' }}>
              {form.avatar
                ? <em>{(form.avatar.charAt(0).toUpperCase() + form.avatar.slice(1)).replace('-', ' ')}</em>
                : <span className="muted it">Nenhum selecionado</span>}
            </div>
            <button type="button" className="btn ghost sm" style={{ marginTop: 6 }}
              onClick={() => setPickerOpen(o => !o)}>
              {pickerOpen ? 'Fechar' : (form.avatar ? 'Trocar avatar' : 'Escolher avatar')}
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="card" style={{ marginBottom: 18 }}>
            <AvatarPicker value={form.avatar} onChange={(slug) => {
              setForm(f => ({ ...f, avatar: slug }));
              setPickerOpen(false);
            }} />
          </div>
        )}

        <div className="row">
          <div style={{ minWidth: 300, flex: 1 }}>
            <div className="field">
              <label>Nome completo</label>
              <input type="text" required value={form.nome_completo} onChange={set('nome_completo')} />
            </div>
            <div className="field">
              <label>Identificação</label>
              <input type="text" required value={form.identificacao} onChange={set('identificacao')} placeholder="RG / passaporte / ID do personagem" />
            </div>
          </div>
          <div style={{ minWidth: 300, flex: 1 }}>
            <div className="field">
              <label>Handle do Discord</label>
              <input type="text" required value={form.discord_handle} onChange={set('discord_handle')} placeholder="usuario#0000 ou @usuario" />
            </div>
            <div className="field">
              <label>Conta bancária</label>
              <input type="text" required value={form.conta_bancaria} onChange={set('conta_bancaria')} placeholder="Número da conta para pagamento" />
            </div>
          </div>
        </div>
        <div className="mt-2">
          <button className="btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar Perfil'}</button>
          {msg && <span className="muted" style={{ marginLeft: 12, color: msg.type === 'err' ? 'var(--burgundy)' : 'inherit' }}>{msg.text}</span>}
        </div>
      </form>
    </div>
  );
}
