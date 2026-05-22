import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import Avatar from '../components/Avatar.jsx';
import Credencial from '../components/Credencial.jsx';
import Contrato from '../components/Contrato.jsx';
import '../styles/credencial.css';
import '../styles/contrato.css';

/* ============== VISTA — Tabs Credencial/Contrato ============== */
function CredencialView({ profile, onEdit, onContratoAssinado }) {
  const [tab, setTab] = useState('credencial');
  const [toast, setToast] = useState(null);
  const url = profile?.public_code
    ? `${window.location.origin}/c/${profile.public_code}`
    : null;
  const contratoOk = !!profile?.contrato_assinado_em;

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
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Tabs */}
      <div className="perfil-tabs">
        <button
          className={`perfil-tab ${tab === 'credencial' ? 'active' : ''}`}
          onClick={() => setTab('credencial')}>
          Credencial
        </button>
        <button
          className={`perfil-tab ${tab === 'contrato' ? 'active' : ''}`}
          onClick={() => setTab('contrato')}>
          Contrato
          {contratoOk
            ? <span className="perfil-tab-status ok">✓</span>
            : <span className="perfil-tab-status pendente">!</span>}
        </button>
      </div>

      {tab === 'credencial' && (
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

          {!contratoOk && (
            <div className="perfil-alerta-contrato" onClick={() => setTab('contrato')}>
              ⚠️ Contrato pendente — clique aqui para revisar e assinar
            </div>
          )}

          {toast && <div className="toast">{toast}</div>}
        </div>
      )}

      {tab === 'contrato' && (
        <div>
          <Contrato profile={profile} onAssinar={onContratoAssinado} />
        </div>
      )}
    </div>
  );
}

/* ============== FORM — credencial em modo edição ============== */
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
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="flex between center-y">
        <h1 className="mt-0">{isFirstFill ? 'Complete Seu Perfil' : 'Editar Credencial'}</h1>
        <span className={`badge ${profile?.role}`}>{profile?.role}</span>
      </div>
      <p className="muted">
        {isFirstFill
          ? 'Para receber pedidos e remuneração, complete os campos abaixo.'
          : 'Mantenha seus dados atualizados — são usados para pagamento e identificação.'}
      </p>
      <hr className="divider" />

      <form onSubmit={submit}>
        {/* ---------- Seção: Aparência ---------- */}
        <section className="form-section">
          <h2 className="form-section-title">Aparência</h2>
          <div className="flex gap-2 center-y form-avatar-row">
            <div className="form-avatar-frame">
              <Avatar slug={form.avatar} name={form.nome_completo} size={96} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>Avatar (URL da imagem)</label>
                <input
                  type="url"
                  placeholder="https://i.imgur.com/seuavatar.png"
                  value={form.avatar}
                  onChange={set('avatar')}
                />
              </div>
              <div className="hint">
                Cole o link direto de uma imagem (PNG ou JPG). Sem link, mostramos suas iniciais.
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Seção: Identidade ---------- */}
        <section className="form-section">
          <h2 className="form-section-title">Identidade</h2>
          <div className="row">
            <div className="field" style={{ flex: '1 1 280px' }}>
              <label>Nome completo</label>
              <input type="text" required value={form.nome_completo} onChange={set('nome_completo')} />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Identificação</label>
              <input type="text" required value={form.identificacao} onChange={set('identificacao')}
                placeholder="RG / passaporte / ID do personagem" />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Handle do Discord</label>
              <input type="text" required value={form.discord_handle} onChange={set('discord_handle')}
                placeholder="usuario#0000 ou @usuario" />
            </div>
          </div>
        </section>

        {/* ---------- Seção: Pagamento & Contato ---------- */}
        <section className="form-section">
          <h2 className="form-section-title">Pagamento &amp; Contato</h2>
          <div className="row">
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label>Conta bancária</label>
              <input type="text" required value={form.conta_bancaria} onChange={set('conta_bancaria')}
                placeholder="Número da conta para pagamento" />
            </div>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label>Correio (PO Box)</label>
              <input type="text" value={form.correio} onChange={set('correio')}
                placeholder="Endereço de correio do personagem" />
            </div>
          </div>
        </section>

        <div className="mt-3 flex gap-1 center-y" style={{ flexWrap: 'wrap' }}>
          <button className="btn lg" disabled={saving}>{saving ? 'Salvando…' : 'Salvar Credencial'}</button>
          {!isFirstFill && (
            <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
          )}
          {msg && (
            <span style={{
              color: msg.type === 'err' ? 'var(--burgundy)' : 'var(--olive)',
              fontStyle: 'italic',
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

  return (
    <CredencialView
      profile={profile}
      onEdit={() => setEditing(true)}
      onContratoAssinado={refreshProfile}
    />
  );
}
