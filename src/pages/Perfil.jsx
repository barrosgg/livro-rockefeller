import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import Avatar from '../components/Avatar.jsx';
import '../styles/credencial.css';

const ROLE_LABELS = {
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  trabalhador: 'Trabalhador',
};

function gerarNumeroCredencial(userId) {
  // Número fixo derivado do user id (não muda entre sessões)
  if (!userId) return '0000';
  const hash = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return hash.match(/.{1,4}/g).join(' ');
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ============== CREDENCIAL (modo vista) ============== */
function Credencial({ profile, onEdit }) {
  const numero = gerarNumeroCredencial(profile?.id);
  return (
    <div className="credencial-stage">
      <div className="credencial">
        <span className="corner tl" /><span className="corner tr" />
        <span className="corner bl" /><span className="corner br" />

        <header className="credencial-header">
          <div className="credencial-numero">Nº {numero}</div>
          <div className="credencial-titulo">Família Rockefeller</div>
          <div className="credencial-subtitulo">Credencial do Caderno da Fazenda</div>
        </header>

        <div className="credencial-body">
          <div className="credencial-avatar-wrap">
            <div className="credencial-avatar-frame">
              <Avatar slug={profile?.avatar} name={profile?.nome_completo} size={118} />
            </div>
            <div className="credencial-cargo">{ROLE_LABELS[profile?.role] || profile?.role}</div>
          </div>

          <div className="credencial-campos">
            <div className="credencial-campo full">
              <span className="credencial-label">Nome Completo</span>
              <div className="credencial-valor">{profile?.nome_completo || <em className="empty">—</em>}</div>
            </div>

            <div className="credencial-campo">
              <span className="credencial-label">Identificação</span>
              <div className="credencial-valor">{profile?.identificacao || <em className="empty">—</em>}</div>
            </div>

            <div className="credencial-campo">
              <span className="credencial-label">Discord</span>
              <div className="credencial-valor">{profile?.discord_handle || <em className="empty">—</em>}</div>
            </div>

            <div className="credencial-campo">
              <span className="credencial-label">Conta Bancária</span>
              <div className="credencial-valor">{profile?.conta_bancaria || <em className="empty">—</em>}</div>
            </div>

            <div className="credencial-campo">
              <span className="credencial-label">Correio (PO Box)</span>
              <div className="credencial-valor">{profile?.correio || <em className="empty">não informado</em>}</div>
            </div>
          </div>
        </div>

        <footer className="credencial-footer">
          <div className="credencial-emissao">
            Emitida em <strong>{formatarData(profile?.criado_em)}</strong>
            <br />
            Caderno da Fazenda Rockefeller · Anno MCM
          </div>

          <div className="credencial-assinatura">
            <div className="credencial-assinatura-linha" />
            <div className="credencial-assinatura-label">Assinatura do Trabalhador</div>
          </div>

          <div className="credencial-selo" title="Família Rockefeller · Registro Oficial">
            <div className="credencial-selo-top">Família</div>
            <div className="credencial-selo-mid">R</div>
            <div className="credencial-selo-bottom">MCM</div>
          </div>
        </footer>
      </div>

      <div className="mt-2 center">
        <button className="btn" onClick={onEdit}>Editar Credencial</button>
      </div>
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

  return <Credencial profile={profile} onEdit={() => setEditing(true)} />;
}
