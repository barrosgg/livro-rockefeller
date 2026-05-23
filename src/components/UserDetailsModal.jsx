import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useUI } from '../lib/ui.jsx';
import { useWorkerPct } from '../lib/settings.jsx';
import { useFocusTrap } from '../lib/a11y.js';
import { fmt } from '../lib/calc.js';
import { BADGES } from '../lib/badges.js';
import Avatar from './Avatar.jsx';

const ROLES = ['proprietario', 'gerente', 'trabalhador'];

export default function UserDetailsModal({ userId, onClose, onUpdate }) {
  const { showToast, confirmar } = useUI() || {};
  const TRABALHADOR_PCT = useWorkerPct();
  const modalRef = useFocusTrap(true);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);
  const [badgeInput, setBadgeInput] = useState('');

  const carregar = () => {
    if (!userId) return;
    setLoading(true);
    supabase.rpc('get_user_admin_details', { p_user_id: userId })
      .then(({ data: result, error }) => {
        if (error) { showToast?.(error.message, { type: 'error' }); return; }
        setData(result);
        setVals({
          nome_completo:  result.profile.nome_completo || '',
          identificacao:  result.profile.identificacao || '',
          discord_handle: result.profile.discord_handle || '',
          conta_bancaria: result.profile.conta_bancaria || '',
          correio:        result.profile.correio || '',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [userId]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const salvarPerfil = async () => {
    setSaving(true);
    const payload = {
      nome_completo:  vals.nome_completo,
      identificacao:  vals.identificacao,
      discord_handle: vals.discord_handle,
      conta_bancaria: vals.conta_bancaria,
      correio:        vals.correio || null,
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    setSaving(false);
    if (error) { showToast?.(error.message, { type: 'error' }); return; }
    showToast?.('Dados salvos.', { type: 'success' });
    setEditing(false);
    carregar();
    onUpdate?.();
  };

  const mudarRole = async (novoRole) => {
    const { error } = await supabase.from('profiles').update({ role: novoRole }).eq('id', userId);
    if (error) showToast?.(error.message, { type: 'error' });
    else { showToast?.('Papel alterado.', { type: 'success' }); carregar(); onUpdate?.(); }
  };

  const toggleDisabled = async () => {
    const { error } = await supabase.from('profiles')
      .update({ disabled: !data.profile.disabled })
      .eq('id', userId);
    if (error) showToast?.(error.message, { type: 'error' });
    else { showToast?.(data.profile.disabled ? 'Reativado.' : 'Desabilitado.', { type: 'info' }); carregar(); onUpdate?.(); }
  };

  const limparContrato = async () => {
    const ok = await confirmar?.(
      'O contrato será desfeito e o trabalhador precisará assinar de novo antes de assumir produção.',
      { title: 'Desfazer assinatura?', danger: true, confirmLabel: 'Desfazer' });
    if (!ok) return;
    const { error } = await supabase.from('profiles')
      .update({ contrato_assinado_em: null })
      .eq('id', userId);
    if (error) showToast?.(error.message, { type: 'error' });
    else { showToast?.('Assinatura desfeita.', { type: 'info' }); carregar(); }
  };

  const adicionarBadge = async () => {
    const id = badgeInput.trim();
    if (!id) return;
    const atuais = data.profile.badges_extras || [];
    if (atuais.includes(id)) {
      showToast?.('Este selo já está atribuído.', { type: 'error' });
      return;
    }
    const novos = [...atuais, id];
    const { error } = await supabase.from('profiles').update({ badges_extras: novos }).eq('id', userId);
    if (error) showToast?.(error.message, { type: 'error' });
    else { setBadgeInput(''); carregar(); showToast?.('Selo atribuído.', { type: 'success' }); }
  };

  const removerBadge = async (id) => {
    const novos = (data.profile.badges_extras || []).filter(b => b !== id);
    const { error } = await supabase.from('profiles').update({ badges_extras: novos }).eq('id', userId);
    if (error) showToast?.(error.message, { type: 'error' });
    else { carregar(); showToast?.('Selo removido.', { type: 'info' }); }
  };

  if (loading) {
    return (
      <div className="confirm-backdrop" onClick={onClose}>
        <div className="user-detail-modal" onClick={e => e.stopPropagation()}>
          <div style={{ padding: 40, textAlign: 'center' }}>Carregando…</div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { profile: p, auth, stats } = data;
  const meta = auth?.raw_user_meta_data || {};
  const customClaims = meta.custom_claims || {};
  // Email do último login OAuth (mais atualizado) com fallback pro email
  // do cadastro inicial (auth.users.email — não atualiza em re-logins por design do Supabase)
  const emailAtual    = meta.email || auth?.email || '—';
  const emailCadastro = auth?.email || '—';
  const emailDifere   = meta.email && auth?.email && meta.email !== auth.email;
  // Discord mudou nomes dos campos em 2023 — checa todas as variantes
  const discordId      = meta.provider_id || meta.sub || customClaims.id || '—';
  // Discord moderno usa "username#0" pra indicar "sem discriminador" — limpa esse sufixo
  const rawUsername = meta.preferred_username || meta.user_name ||
                      meta.username || meta.global_name || meta.name ||
                      customClaims.global_name || customClaims.username || '';
  const discordUsername = rawUsername.replace(/#0$/, '') || '—';
  const discordDisplayName = meta.full_name || meta.name || customClaims.global_name || '—';
  const linkCredencial = `${window.location.origin}/c/${p.public_code}`;

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="user-detail-modal" ref={modalRef} onClick={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-labelledby="ud-title">

        <button type="button" className="ud-close" onClick={onClose} aria-label="Fechar">✕</button>

        {/* ===== Cabeçalho ===== */}
        <header className="ud-header">
          <Avatar slug={p.avatar} name={p.nome_completo} size={64} />
          <div className="ud-header-info">
            <h2 id="ud-title" className="mt-0">{p.nome_completo || <span className="muted">— sem nome —</span>}</h2>
            <div className="ud-handle">@{p.discord_handle || '?'}</div>
            <div className="ud-header-badges">
              <span className={`badge ${p.role}`}>{p.role}</span>
              {p.disabled
                ? <span className="badge cancelado"><span className="badge-icon">✕</span>Desabilitado</span>
                : <span className="badge aprovado"><span className="badge-icon">✓</span>Ativo</span>}
            </div>
          </div>
          <div className="ud-header-actions">
            <select className="role-select" value={p.role} onChange={e => mudarRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className={`btn sm ${p.disabled ? 'success' : 'danger'}`} onClick={toggleDisabled}>
              {p.disabled ? '↺ Reativar' : '⊘ Desabilitar'}
            </button>
          </div>
        </header>

        {/* ===== Discord Auth ===== */}
        <section className="ud-section">
          <h3 className="ud-section-title"><span className="ud-icon">◈</span> Discord (Autenticação)</h3>
          <div className="ud-info-grid">
            <div>
              <span className="ud-key">Email atual (Discord)</span>
              <span className="ud-val">{emailAtual}</span>
              {emailDifere && (
                <span className="ud-val muted small" style={{ fontStyle: 'italic', marginTop: 2 }}>
                  Cadastro original: {emailCadastro}
                </span>
              )}
            </div>
            <div><span className="ud-key">Discord ID</span><code className="ud-code">{discordId}</code></div>
            <div><span className="ud-key">Username Discord</span><code className="ud-code">{discordUsername}</code></div>
            <div><span className="ud-key">Nome no Discord</span><span className="ud-val">{discordDisplayName}</span></div>
            <div><span className="ud-key">Provider</span><span className="ud-val">{auth?.provider || 'discord'}</span></div>
            <div><span className="ud-key">Último login</span><span className="ud-val">{auth?.last_sign_in_at ? new Date(auth.last_sign_in_at).toLocaleString('pt-BR') : '—'}</span></div>
            <div><span className="ud-key">Conta criada</span><span className="ud-val">{auth?.created_at ? new Date(auth.created_at).toLocaleString('pt-BR') : '—'}</span></div>
            {meta.avatar_url && (
              <div className="ud-info-full"><span className="ud-key">Avatar URL</span>
                <a href={meta.avatar_url} target="_blank" rel="noopener noreferrer" className="ud-link">{meta.avatar_url}</a>
              </div>
            )}
          </div>
        </section>

        {/* ===== Perfil do Livro (editável) ===== */}
        <section className="ud-section">
          <div className="flex between center-y wrap">
            <h3 className="ud-section-title"><span className="ud-icon">☥</span> Perfil do Livro</h3>
            {!editing && <button className="btn ghost sm" onClick={() => setEditing(true)}>✎ Editar</button>}
          </div>

          {editing ? (
            <div className="row">
              <div className="field" style={{ flex: '1 1 240px' }}>
                <label>Nome completo</label>
                <input value={vals.nome_completo} onChange={e => setVals({ ...vals, nome_completo: e.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 160px' }}>
                <label>Identificação</label>
                <input value={vals.identificacao} onChange={e => setVals({ ...vals, identificacao: e.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label>Discord handle</label>
                <input value={vals.discord_handle} onChange={e => setVals({ ...vals, discord_handle: e.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label>Conta bancária</label>
                <input value={vals.conta_bancaria} onChange={e => setVals({ ...vals, conta_bancaria: e.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label>Correio (PO Box)</label>
                <input value={vals.correio} onChange={e => setVals({ ...vals, correio: e.target.value })} />
              </div>
              <div className="flex gap-1 mt-1" style={{ width: '100%' }}>
                <button className="btn" disabled={saving} onClick={salvarPerfil}>{saving ? 'Salvando…' : 'Salvar'}</button>
                <button className="btn ghost" onClick={() => { setEditing(false); carregar(); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="ud-info-grid">
              <div><span className="ud-key">Nome completo</span><span className="ud-val">{p.nome_completo || '—'}</span></div>
              <div><span className="ud-key">Identificação</span><span className="ud-val">{p.identificacao || '—'}</span></div>
              <div><span className="ud-key">Discord handle</span><span className="ud-val">{p.discord_handle || '—'}</span></div>
              <div><span className="ud-key">Conta bancária</span><span className="ud-val">{p.conta_bancaria || '—'}</span></div>
              <div><span className="ud-key">Correio</span><span className="ud-val">{p.correio || '—'}</span></div>
              <div><span className="ud-key">Avatar (slug)</span><span className="ud-val"><code className="ud-code">{p.avatar || '—'}</code></span></div>
              <div><span className="ud-key">Membro desde</span><span className="ud-val">{p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}</span></div>
              <div><span className="ud-key">Onboarding</span><span className="ud-val">{p.onboarding_completed_em ? '✓ concluído ' + new Date(p.onboarding_completed_em).toLocaleDateString('pt-BR') : '⊘ pendente'}</span></div>
            </div>
          )}
        </section>

        {/* ===== Contrato ===== */}
        <section className="ud-section">
          <h3 className="ud-section-title"><span className="ud-icon">☞</span> Contrato de Prestação</h3>
          {p.contrato_assinado_em ? (
            <div className="ud-contrato ud-contrato-ok">
              <span className="ud-mark">✓</span>
              <div>
                Assinado em <strong>{new Date(p.contrato_assinado_em).toLocaleString('pt-BR')}</strong>
                <div className="muted small">Trabalhador habilitado para assumir produção.</div>
              </div>
              <button className="btn ghost sm" onClick={limparContrato} style={{ marginLeft: 'auto' }}>
                Desfazer assinatura
              </button>
            </div>
          ) : (
            <div className="ud-contrato ud-contrato-pendente">
              <span className="ud-mark">⚠</span>
              <div>
                Ainda <strong>não assinado</strong>.
                <div className="muted small">Trabalhador não pode assumir produção até assinar o contrato no perfil.</div>
              </div>
            </div>
          )}
        </section>

        {/* ===== Credencial ===== */}
        <section className="ud-section">
          <h3 className="ud-section-title"><span className="ud-icon">✦</span> Credencial Pública</h3>
          <div className="ud-credencial">
            <code className="ud-code-block">{linkCredencial}</code>
            <div className="flex gap-1 wrap">
              <button className="btn ghost sm" onClick={() => {
                navigator.clipboard.writeText(linkCredencial);
                showToast?.('Link copiado!', { type: 'success' });
              }}>📋 Copiar link</button>
              <a className="btn ghost sm" href={`/c/${p.public_code}`} target="_blank" rel="noopener noreferrer">
                Abrir credencial →
              </a>
            </div>
          </div>
        </section>

        {/* ===== Atividade / Stats ===== */}
        <section className="ud-section">
          <h3 className="ud-section-title"><span className="ud-icon">✿</span> Atividade na Fazenda</h3>
          <div className="ud-stats-grid">
            <div className="ud-stat">
              <div className="ud-stat-value">{stats.claims_total || 0}</div>
              <div className="ud-stat-label">claims totais</div>
              <div className="ud-stat-detail">
                {stats.claims_em_producao || 0} em produção · {stats.claims_pago || 0} pagos
              </div>
            </div>
            <div className="ud-stat">
              <div className="ud-stat-value">{(stats.unidades_total_ativas || 0).toLocaleString('pt-BR')}</div>
              <div className="ud-stat-label">unidades produzidas</div>
              <div className="ud-stat-detail">{(stats.unidades_total_pago || 0).toLocaleString('pt-BR')} já pagas</div>
            </div>
            <div className="ud-stat ud-stat-money">
              <div className="ud-stat-value">{fmt(stats.liquido_total_pago || 0)}</div>
              <div className="ud-stat-label">recebido líquido</div>
              <div className="ud-stat-detail">de {fmt(stats.bruto_total_pago || 0)} bruto</div>
            </div>
            <div className="ud-stat">
              <div className="ud-stat-value">{stats.orders_criados || 0}</div>
              <div className="ud-stat-label">pedidos criados</div>
              <div className="ud-stat-detail">{stats.orders_aprovados || 0} aprovados por ele</div>
            </div>
          </div>
        </section>

        {/* ===== Conquistas manuais ===== */}
        <section className="ud-section">
          <h3 className="ud-section-title"><span className="ud-icon">❀</span> Conquistas Manuais (badges_extras)</h3>
          <div className="ud-badges">
            {(p.badges_extras || []).length === 0 ? (
              <p className="muted small mt-0">Nenhum selo manual atribuído.</p>
            ) : (
              <div className="ud-badges-list">
                {(p.badges_extras || []).map(id => {
                  const def = BADGES.find(b => b.id === id);
                  return (
                    <div key={id} className="ud-badge">
                      <span className="ud-badge-icon">{def?.symbol || '★'}</span>
                      <div className="ud-badge-info">
                        <strong>{def?.nome || id}</strong>
                        {def && <div className="muted small">{def.desc}</div>}
                      </div>
                      <button className="btn ghost sm" onClick={() => removerBadge(id)} aria-label={`Remover ${def?.nome || id}`}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="ud-badge-add">
              <input
                type="text"
                placeholder="ID do selo (ex: top_3, veterano)"
                value={badgeInput}
                onChange={e => setBadgeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarBadge()}
                list="badge-options"
              />
              <datalist id="badge-options">
                {BADGES.map(b => (
                  <option key={b.id} value={b.id}>{b.nome} — {b.desc}</option>
                ))}
              </datalist>
              <button className="btn sm" disabled={!badgeInput.trim()} onClick={adicionarBadge}>+ Atribuir</button>
            </div>
            <p className="muted small mt-1">
              Selos automáticos (por critério de stats) são calculados em tempo de execução e aparecem na credencial.
              Aqui você atribui selos especiais manualmente.
            </p>
          </div>
        </section>

        <footer className="ud-footer">
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
