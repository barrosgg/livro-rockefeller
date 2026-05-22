import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import Avatar from '../components/Avatar.jsx';
import Credencial from '../components/Credencial.jsx';
import '../styles/credencial.css';

/* ============== VISTA — Credencial + ações ============== */
function CredencialView({ profile, onEdit }) {
  const [toast, setToast] = useState(null);
  const url = profile?.public_code
    ? `${window.location.origin}/c/${profile.public_code}`
    : null;

  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link da credencial copiado.');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('Não foi possível copiar.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="credencial-stage">
      <Credencial profile={profile} />

      <div className="mt-2 center flex gap-1" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={onEdit}>Editar Credencial</button>
        {url && (
          <button className="btn ghost" onClick={copiar}>📎 Copiar link público</button>
        )}
        {url && (
          <a className="btn ghost" href={url} target="_blank" rel="noopener noreferrer">
            👁 Visualizar
          </a>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ============== FORMULÁRIO (modo edição) ============== */
function FormularioPerfil({ profile, user, onSaved, onCancel, isFirstFill }) {
  const [form, setForm] = useState({
    nome_completo: profile?.nome_completo || '',
    identificacao: profile?.identificacao || '',
    discord_handle: profile?.discord_handle || '',
    conta_bancaria: profile?.conta_bancaria || '',
    correio: profile?.correio || '',
    avatar: profile?.avatar || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

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
    onSaved?.();
  };

  return (
    <div className="page">
      <div className="flex between center-y">
        <h1 className="mt-0">{isFirstFill ? 'Complete Seu Perfil' : 'Editar Credencial'}</h1>
        <span className={`badge ${profile?.role}`}>{profile?.role}</span>
      </div>
      <p className="muted">Mantenha seus dados atualizados — são usados para pagamento e identificação.</p>
      <hr className="divider" />

      <form onSubmit={submit}>
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
        <div className="mt-2 flex gap-1">
          <button className="btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar Credencial'}</button>
          {!isFirstFill && (
            <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
          )}
          {msg && (
            <span className="muted" style={{
              marginLeft: 12, color: msg.type === 'err' ? 'var(--burgundy)' : 'inherit',
              alignSelf: 'center',
            }}>{msg.text}</span>
          )}
        </div>
      </form>
    </div>
  );
}

/* ============== ROOT ============== */
export default function Perfil() {
  const { profile, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const completo = isProfileComplete(profile);
  // Se perfil já está completo, mostra a credencial; senão, força preenchimento
  const [editing, setEditing] = useState(!completo);

  useEffect(() => {
    setEditing(!isProfileComplete(profile));
  }, [profile]);

  const handleSaved = async () => {
    const wasFirst = !completo;
    await refreshProfile();
    if (wasFirst) {
      navigate('/pedidos', { replace: true });
    } else {
      setEditing(false);
    }
  };

  if (editing || !completo) {
    return (
      <FormularioPerfil
        profile={profile}
        user={user}
        isFirstFill={!completo}
        onSaved={handleSaved}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return <CredencialView profile={profile} onEdit={() => setEditing(true)} />;
}
