import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useSettings, useCategorias } from '../lib/settings.jsx';
import { useAuth } from '../lib/auth.jsx';
import { fmt, statusLabel } from '../lib/calc.js';
import { toCsv, downloadCsv } from '../lib/csv.js';
import { useUI } from '../lib/ui.jsx';
import Avatar from '../components/Avatar.jsx';
import ProductIcon from '../components/ProductIcon.jsx';

const ROLES = ['proprietario', 'gerente', 'trabalhador'];

function Tabs({ value, onChange, options }) {
  return (
    <nav className="admin-tabs" aria-label="Seções do painel">
      {options.map(o => (
        <button key={o.key}
          type="button"
          className={`admin-tab ${value === o.key ? 'active' : ''}`}
          aria-current={value === o.key ? 'page' : undefined}
          onClick={() => onChange(o.key)}>
          <span className="admin-tab-icon" aria-hidden="true">{o.icon}</span>
          <span className="admin-tab-label">{o.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ========================= USUÁRIOS ========================= */
function UsuariosTab() {
  const { user: me } = useAuth();
  const { showToast, confirmar } = useUI() || {};
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('todos');

  const carregar = () => supabase.from('profiles').select('*').order('criado_em')
    .then(({ data }) => { setProfiles(data || []); setLoading(false); });
  useEffect(() => { carregar(); }, []);

  const salvarEdit = async () => {
    const { id, nome_completo, identificacao, discord_handle, conta_bancaria, correio } = editing;
    const { error } = await supabase.from('profiles')
      .update({ nome_completo, identificacao, discord_handle, conta_bancaria, correio: correio || null })
      .eq('id', id);
    if (error) { showToast?.(error.message, { type: 'error' }); return; }
    setEditing(null);
    showToast?.('Dados atualizados.', { type: 'success' });
    carregar();
  };

  const mudarRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) showToast?.(error.message, { type: 'error' });
    else { showToast?.('Papel alterado.', { type: 'success' }); carregar(); }
  };

  const toggleDisabled = async (p) => {
    if (p.id === me.id && !p.disabled) {
      const ok = await confirmar?.(
        'Você está prestes a DESABILITAR a si mesmo. Perderá o acesso imediatamente.',
        { title: 'Desabilitar a si mesmo?', danger: true, confirmLabel: 'Desabilitar' });
      if (!ok) return;
    }
    const { error } = await supabase.from('profiles').update({ disabled: !p.disabled }).eq('id', p.id);
    if (error) showToast?.(error.message, { type: 'error' });
    else carregar();
  };

  if (loading) return <p className="muted">Carregando…</p>;

  // Stats por role
  const stats = {
    total: profiles.length,
    proprietario: profiles.filter(p => p.role === 'proprietario' && !p.disabled).length,
    gerente:      profiles.filter(p => p.role === 'gerente' && !p.disabled).length,
    trabalhador:  profiles.filter(p => p.role === 'trabalhador' && !p.disabled).length,
    desabilitados:profiles.filter(p => p.disabled).length,
  };

  // Filtrar lista
  const filtrados = profiles.filter(p => {
    if (filtroRole !== 'todos' && p.role !== filtroRole) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (p.nome_completo || '').toLowerCase().includes(q) ||
             (p.discord_handle || '').toLowerCase().includes(q) ||
             (p.identificacao || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      {msg && <p className="muted small">{msg.text}</p>}

      {/* Nota sobre permissões */}
      <div className="admin-note mt-2">
        <span className="admin-note-icon" aria-hidden="true">ⓘ</span>
        <div>
          Todo novo membro entra como <strong>trabalhador</strong> ao se cadastrar pelo Discord.
          Promova manualmente para <strong>gerente</strong> ou <strong>proprietário</strong> usando o seletor de papel abaixo.
        </div>
      </div>

      {/* KPIs */}
      <div className="admin-stats mt-2">
        <div className="admin-stat"><span className="admin-stat-value">{stats.total}</span><span className="admin-stat-label">membros</span></div>
        <div className="admin-stat"><span className="admin-stat-value">{stats.proprietario}</span><span className="admin-stat-label">proprietários</span></div>
        <div className="admin-stat"><span className="admin-stat-value">{stats.gerente}</span><span className="admin-stat-label">gerentes</span></div>
        <div className="admin-stat"><span className="admin-stat-value">{stats.trabalhador}</span><span className="admin-stat-label">trabalhadores</span></div>
        {stats.desabilitados > 0 && (
          <div className="admin-stat danger"><span className="admin-stat-value">{stats.desabilitados}</span><span className="admin-stat-label">desabilitados</span></div>
        )}
      </div>

      {/* Busca + filtro por role */}
      <div className="admin-toolbar mt-2">
        <div className="search-wrap" style={{ maxWidth: 320 }}>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            type="text"
            placeholder="Buscar por nome, Discord ou identificação…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="search-input"
          />
          {busca && (
            <button type="button" className="search-clear"
              aria-label="Limpar busca"
              onClick={() => setBusca('')}>✕</button>
          )}
        </div>
        <div className="flex gap-1 wrap filter-chips">
          {['todos', ...ROLES].map(r => (
            <button key={r}
              className={`chip ${filtroRole === r ? 'active' : ''}`}
              onClick={() => setFiltroRole(r)}>
              {r === 'todos' ? 'Todos' : r}
              <span className="chip-count">
                {r === 'todos' ? profiles.length : profiles.filter(p => p.role === r).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="empty-state mt-2">
          <div className="empty-state-icon">🔍</div>
          <p className="muted">Nenhum membro encontrado com este filtro.</p>
        </div>
      ) : (
      <table className="book mt-2 user-table">
        <thead>
          <tr>
            <th>Membro</th>
            <th>Documentos</th>
            <th style={{ width: 150 }}>Papel</th>
            <th style={{ width: 120 }}>Status</th>
            <th style={{ width: 180 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map(p => (
            <tr key={p.id} className={`user-row ${p.disabled ? 'is-disabled' : ''}`}>
              <td data-label="Membro">
                <div className="user-cell">
                  <Avatar slug={p.avatar} name={p.nome_completo} size={38} />
                  <div className="user-info">
                    <div className="user-name">{p.nome_completo || <span className="muted">— sem nome —</span>}</div>
                    <div className="user-discord">@{p.discord_handle || '?'}</div>
                  </div>
                </div>
              </td>
              <td data-label="Documentos">
                <div className="docs-cell">
                  <div className="doc-line"><span className="doc-key">Identif.</span><span className="doc-val">{p.identificacao || <span className="muted">—</span>}</span></div>
                  <div className="doc-line"><span className="doc-key">Conta</span><span className="doc-val">{p.conta_bancaria || <span className="muted">—</span>}</span></div>
                  <div className="doc-line"><span className="doc-key">Correio</span><span className="doc-val">{p.correio || <span className="muted">—</span>}</span></div>
                </div>
              </td>
              <td data-label="Papel">
                <select className="role-select" value={p.role} onChange={e => mudarRole(p.id, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td data-label="Status">
                {p.disabled
                  ? <span className="badge cancelado"><span className="badge-icon">✕</span>Desabilitado</span>
                  : <span className="badge aprovado"><span className="badge-icon">✓</span>Ativo</span>}
              </td>
              <td data-label="" className="cell-actions">
                <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn ghost sm" onClick={() => setEditing(p)}>✎ editar</button>
                  <button className={`btn sm ${p.disabled ? 'success' : 'danger'}`} onClick={() => toggleDisabled(p)}>
                    {p.disabled ? '↺ reativar' : '⊘ desabilitar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}

      {editing && (
        <div className="card mt-3" style={{ borderColor: 'var(--gold)' }}>
          <h3 className="mt-0">Editar Usuário</h3>
          <div className="row">
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label>Nome completo</label>
              <input type="text" value={editing.nome_completo || ''}
                onChange={e => setEditing({ ...editing, nome_completo: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Identificação</label>
              <input type="text" value={editing.identificacao || ''}
                onChange={e => setEditing({ ...editing, identificacao: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Discord</label>
              <input type="text" value={editing.discord_handle || ''}
                onChange={e => setEditing({ ...editing, discord_handle: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label>Conta bancária</label>
              <input type="text" value={editing.conta_bancaria || ''}
                onChange={e => setEditing({ ...editing, conta_bancaria: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Correio</label>
              <input type="text" value={editing.correio || ''}
                onChange={e => setEditing({ ...editing, correio: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            <button className="btn" onClick={salvarEdit}>Salvar</button>
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ========================= PRODUTOS ========================= */
function ProdutosTab() {
  const categorias = useCategorias();
  const { showToast, confirmar } = useUI() || {};
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ nome: '', categoria: '', preco_min: '', preco_max: '', icon: '' });
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});

  useEffect(() => {
    if (!novo.categoria && categorias.length) setNovo(n => ({ ...n, categoria: categorias[0] }));
  }, [categorias, novo.categoria]);

  const carregar = () => supabase.from('products').select('*').order('nome')
    .then(({ data }) => { setProdutos(data || []); setLoading(false); });
  useEffect(() => { carregar(); }, []);

  const adicionar = async (e) => {
    e.preventDefault();
    const payload = {
      nome: novo.nome.trim(), categoria: novo.categoria,
      preco_min: Number(novo.preco_min), preco_max: Number(novo.preco_max),
      icon: novo.icon.trim() || null,
    };
    if (!payload.nome) { showToast?.('Nome do produto é obrigatório.', { type: 'error' }); return; }
    if (payload.preco_min <= 0 || payload.preco_max < payload.preco_min) {
      showToast?.('Preço inválido — verifique mínimo e máximo.', { type: 'error' }); return;
    }
    const { error } = await supabase.from('products').insert(payload);
    if (error) { showToast?.(error.message, { type: 'error' }); return; }
    setNovo({ nome: '', categoria: categorias[0] || '', preco_min: '', preco_max: '', icon: '' });
    showToast?.('Produto adicionado.', { type: 'success' });
    carregar();
  };

  const startEdit = (p) => { setEditId(p.id); setEditVals({ categoria: p.categoria, preco_min: p.preco_min, preco_max: p.preco_max, icon: p.icon || '' }); };

  const salvarEdit = async (id) => {
    const v = editVals;
    if (Number(v.preco_min) <= 0 || Number(v.preco_max) < Number(v.preco_min)) {
      showToast?.('Preço inválido.', { type: 'error' }); return;
    }
    const { error } = await supabase.from('products').update({
      categoria: v.categoria, preco_min: Number(v.preco_min), preco_max: Number(v.preco_max),
      icon: v.icon?.trim() || null,
    }).eq('id', id);
    if (error) { showToast?.(error.message, { type: 'error' }); return; }
    setEditId(null);
    showToast?.('Produto atualizado.', { type: 'success' });
    carregar();
  };

  const apagar = async (p) => {
    const ok = await confirmar?.(
      `O produto "${p.nome}" será removido do catálogo. Esta ação só funciona se ele ainda não foi usado em nenhum pedido.`,
      { title: 'Apagar produto?', danger: true, confirmLabel: 'Apagar' });
    if (!ok) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) showToast?.(error.message, { type: 'error' });
    else { showToast?.('Produto removido.', { type: 'success' }); carregar(); }
  };

  if (loading) return <p className="muted">Carregando…</p>;

  return (
    <>
      <div className="card" style={{ background: '#fff' }}>
        <h3 className="mt-0">Adicionar Produto</h3>
        <form onSubmit={adicionar} className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 240px' }}>
            <label>Nome</label>
            <input type="text" value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} required />
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Categoria</label>
            <select value={novo.categoria} onChange={e => setNovo({ ...novo, categoria: e.target.value })}>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 120px' }}>
            <label>Preço mín.</label>
            <input type="number" step="0.01" min="0" value={novo.preco_min}
              onChange={e => setNovo({ ...novo, preco_min: e.target.value })} required />
          </div>
          <div className="field" style={{ flex: '0 0 120px' }}>
            <label>Preço máx.</label>
            <input type="number" step="0.01" min="0" value={novo.preco_max}
              onChange={e => setNovo({ ...novo, preco_max: e.target.value })} required />
          </div>
          <div className="field" style={{ flex: '1 1 180px' }}>
            <label>
              Ícone
              {' '}
              <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: '.7rem', marginLeft: 4 }}>buscar →</a>
            </label>
            <input type="text" value={novo.icon}
              placeholder="ex: delapouite/corn"
              onChange={e => setNovo({ ...novo, icon: e.target.value })} />
            <div className="hint">Formato: <code>autor/nome-icone</code></div>
          </div>
          <button className="btn">Adicionar</button>
        </form>
      </div>

      <h3 className="mt-3">{produtos.length} produtos no catálogo</h3>
      <table className="book responsive" aria-label="Catálogo de produtos">
        <colgroup>
          <col style={{ width: 50 }} /><col /><col style={{ width: 200 }} /><col style={{ width: 120 }} /><col style={{ width: 120 }} /><col style={{ width: 180 }} /><col style={{ width: 140 }} />
        </colgroup>
        <thead>
          <tr><th></th><th>Nome</th><th>Categoria</th><th className="num">Preço mín.</th><th className="num">Preço máx.</th><th>Ícone</th><th></th></tr>
        </thead>
        <tbody>
          {produtos.map(p => {
            const editing = editId === p.id;
            return (
              <tr key={p.id}>
                <td data-label=""><ProductIcon slug={p.icon} name={p.nome} size={24} /></td>
                <td data-label="Nome">{p.nome}</td>
                <td data-label="Categoria">
                  {editing ? (
                    <select value={editVals.categoria} onChange={e => setEditVals({ ...editVals, categoria: e.target.value })}>
                      {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : <span className="muted small">{p.categoria}</span>}
                </td>
                <td className="num" data-label="Preço mín.">{editing
                  ? <input type="number" step="0.01" value={editVals.preco_min}
                      onChange={e => setEditVals({ ...editVals, preco_min: e.target.value })} />
                  : fmt(p.preco_min)}</td>
                <td className="num" data-label="Preço máx.">{editing
                  ? <input type="number" step="0.01" value={editVals.preco_max}
                      onChange={e => setEditVals({ ...editVals, preco_max: e.target.value })} />
                  : fmt(p.preco_max)}</td>
                <td data-label="Ícone">
                  {editing
                    ? <input type="text" value={editVals.icon || ''} placeholder="autor/icon"
                        onChange={e => setEditVals({ ...editVals, icon: e.target.value })} />
                    : <span className="muted small">{p.icon || '—'}</span>}
                </td>
                <td data-label="">
                  {editing ? (
                    <div className="flex gap-1">
                      <button className="btn sm" onClick={() => salvarEdit(p.id)}>salvar</button>
                      <button type="button" aria-label="Cancelar edição" className="btn ghost sm" onClick={() => setEditId(null)}>×</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button className="btn ghost sm" onClick={() => startEdit(p)}>editar</button>
                      <button className="btn ghost sm" style={{ color: 'var(--burgundy)' }} onClick={() => apagar(p)}>apagar</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/* ========================= CATEGORIAS ========================= */
function CategoriasTab() {
  const { settings, setSetting } = useSettings();
  const { showToast: showSetToast } = useUI() || {};
  const [lista, setLista] = useState(settings.categorias || []);
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setLista(settings.categorias || []); }, [settings.categorias]);

  const adicionar = () => {
    const t = novo.trim();
    if (!t || lista.includes(t)) return;
    setLista([...lista, t]);
    setNovo('');
  };
  const remover = (i) => setLista(lista.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const copy = [...lista];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setLista(copy);
  };
  const salvar = async () => {
    setSalvando(true);
    try { await setSetting('categorias', lista); showSetToast?.('Categorias salvas.', { type: 'success' }); } catch (e) { showSetToast?.(e.message, { type: 'error' }); }
    setSalvando(false);
  };

  return (
    <>
      <p className="muted small">
        Categorias usadas na lista de produtos e no dropdown de busca em Novo Pedido.
        A ordem aqui define a ordem de exibição.
      </p>
      <div className="card" style={{ background: '#fff', maxWidth: 540 }}>
        <div className="flex gap-1 mt-0" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Nova categoria</label>
            <input type="text" value={novo} onChange={e => setNovo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }} />
          </div>
          <button className="btn" onClick={adicionar}>Adicionar</button>
        </div>
        <table className="book mt-2">
          <tbody>
            {lista.map((c, i) => (
              <tr key={c}>
                <td style={{ width: 90 }}>
                  <div className="flex gap-1">
                    <button type="button" aria-label="Mover para cima" className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" aria-label="Mover para baixo" className="btn ghost sm" disabled={i === lista.length - 1} onClick={() => move(i, 1)}>↓</button>
                  </div>
                </td>
                <td>{c}</td>
                <td style={{ width: 60 }}>
                  <button type="button" aria-label={`Remover categoria ${c}`} className="btn ghost sm" style={{ color: 'var(--burgundy)' }} onClick={() => remover(i)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2">
          <button className="btn" disabled={salvando} onClick={salvar}>Salvar Lista</button>
        </div>
      </div>
    </>
  );
}

/* ========================= TEMPLATES ========================= */
function TemplatesTab() {
  const { showToast: showTplToast, confirmar: confirmTpl } = useUI() || {};
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = () => supabase
    .from('order_templates')
    .select('*, items:order_template_items(*, product:products(nome))')
    .order('criado_em', { ascending: false })
    .then(({ data }) => { setTemplates(data || []); setLoading(false); });
  useEffect(() => { carregar(); }, []);

  const apagar = async (t) => {
    const ok = await confirmTpl?.(
      `O template "${t.nome}" será removido. Pedidos já criados a partir dele não são afetados.`,
      { title: 'Apagar template?', danger: true, confirmLabel: 'Apagar' });
    if (!ok) return;
    const { error } = await supabase.from('order_templates').delete().eq('id', t.id);
    if (error) showTplToast?.(error.message, { type: 'error' });
    else { showTplToast?.('Template removido.', { type: 'success' }); carregar(); }
  };

  if (loading) return <p className="muted">Carregando…</p>;

  return (
    <>
      <p className="muted small">
        Templates são criados na tela <em>Novo Pedido</em> usando o botão <strong>Salvar como template</strong>.
        Aqui você pode revisar e apagar.
      </p>
      {templates.length === 0 ? (
        <div className="card"><p className="muted it small mt-0">Nenhum template ainda.</p></div>
      ) : (
        <div className="stack">
          {templates.map(t => {
            const total = (t.items || []).reduce((a, i) => a + i.quantidade * Number(i.preco_unit), 0);
            return (
              <div key={t.id} className="card">
                <div className="flex between center-y wrap gap-1">
                  <div>
                    <strong>{t.nome}</strong>
                    {t.descricao && <div className="muted small">{t.descricao}</div>}
                    <div className="muted small">
                      {(t.items || []).length} item(ns) · total {fmt(total)} · criado {new Date(t.criado_em).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button className="btn ghost sm" style={{ color: 'var(--burgundy)' }} onClick={() => apagar(t)}>apagar</button>
                </div>
                <div className="mt-2" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(t.items || []).map(i => (
                    <span key={i.id} className="badge trabalhador">
                      {i.product?.nome} ×{i.quantidade}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ========================= CONFIGURAÇÕES ========================= */
function ConfigTab() {
  const { settings, setSetting } = useSettings();
  const [commissionInput, setCommissionInput] = useState((settings.commission_pct * 100).toFixed(1));
  const [farmName, setFarmName] = useState(settings.farm_name);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setCommissionInput((settings.commission_pct * 100).toFixed(1));
    setFarmName(settings.farm_name);
  }, [settings]);

  const salvarComissao = async () => {
    const pct = Number(commissionInput) / 100;
    if (isNaN(pct) || pct < 0 || pct > 0.9) { setMsg({ type: 'err', text: '0–90%.' }); return; }
    setSaving(true); setMsg(null);
    try { await setSetting('commission_pct', pct); setMsg({ type: 'ok', text: 'Comissão atualizada.' }); }
    catch (e) { setMsg({ type: 'err', text: e.message }); }
    setSaving(false);
  };

  const salvarNome = async () => {
    setSaving(true); setMsg(null);
    try { await setSetting('farm_name', farmName); setMsg({ type: 'ok', text: 'Nome atualizado.' }); }
    catch (e) { setMsg({ type: 'err', text: e.message }); }
    setSaving(false);
  };

  return (
    <>
      <div className="card" style={{ background: '#fff' }}>
        <h3 className="mt-0">Comissão da Fazenda</h3>
        <p className="muted small">
          Atual: <strong>{(settings.commission_pct * 100).toFixed(1)}%</strong> · trabalhador recebe <strong>{((1 - settings.commission_pct) * 100).toFixed(1)}%</strong>.
        </p>
        <div className="flex gap-1 wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 0 140px', marginBottom: 0 }}>
            <label>Comissão (%)</label>
            <input type="number" step="0.5" min="0" max="90" value={commissionInput}
              style={{ textAlign: 'right' }} onChange={e => setCommissionInput(e.target.value)} />
          </div>
          <button className="btn" disabled={saving} onClick={salvarComissao}>Salvar</button>
        </div>
      </div>

      <div className="card mt-2" style={{ background: '#fff' }}>
        <h3 className="mt-0">Nome da Fazenda</h3>
        <div className="flex gap-1 wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 280px', marginBottom: 0 }}>
            <label>Nome</label>
            <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} />
          </div>
          <button className="btn" disabled={saving} onClick={salvarNome}>Salvar</button>
        </div>
      </div>

      {msg && <p className="mt-2" style={{ color: msg.type === 'err' ? 'var(--burgundy)' : 'var(--olive)' }}>{msg.text}</p>}
    </>
  );
}

/* ========================= AUDIT LOG ========================= */
const AUDIT_LABELS = {
  'order.criado': '📜 Pedido criado',
  'order.status_aprovado': '✓ Pedido aprovado',
  'order.status_em_producao': '⚙ Pedido em produção',
  'order.status_entregue': '📦 Pedido entregue',
  'order.status_pago': '💰 Pedido pago',
  'order.status_concluido': '🏁 Pedido concluído',
  'order.status_cancelado': '✕ Pedido cancelado',
  'claim.criado': '🛠 Produção assumida',
  'claim.status_entregue': '📦 Entregue no baú',
  'claim.status_pago': '💰 Pagamento confirmado',
  'claim.status_cancelado': '✕ Claim cancelado',
  'profile.role_changed': '👑 Papel alterado',
  'profile.desabilitado': '🚫 Conta desabilitada',
  'profile.reativado': '✓ Conta reativada',
};

function AuditTab() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [visiveis, setVisiveis] = useState(50);

  useEffect(() => {
    supabase.from('audit_log')
      .select('*, actor:profiles!audit_log_actor_id_fkey(nome_completo, discord_handle)')
      .order('criado_em', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) console.error(error);
        setEventos(data || []);
        setLoading(false);
      });
  }, []);

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return eventos;
    return eventos.filter(e => e.entity_type === filtro);
  }, [eventos, filtro]);

  // Reset paginação ao mudar filtro
  useEffect(() => { setVisiveis(50); }, [filtro]);

  const exibidos = filtrados.slice(0, visiveis);

  if (loading) return <p className="muted" aria-live="polite">Carregando…</p>;

  return (
    <>
      <div className="flex gap-1 wrap">
        {['todos', 'order', 'claim', 'profile'].map(t => (
          <button key={t} className={`btn sm ${filtro === t ? '' : 'ghost'}`} onClick={() => setFiltro(t)}>
            {t === 'todos' ? 'Todos' : t === 'order' ? 'Pedidos' : t === 'claim' ? 'Produção' : 'Usuários'}
          </button>
        ))}
      </div>
      <p className="muted small mt-2">
        Mostrando {exibidos.length} de {filtrados.length} eventos (últimos 500).
      </p>
      {filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3 className="mt-0">Nenhum evento neste filtro</h3>
          <p className="muted">Tente outro filtro acima.</p>
        </div>
      ) : (
        <table className="book mt-2" aria-label="Eventos de auditoria">
          <thead>
            <tr><th style={{ width: 160 }}>Quando</th><th style={{ width: 220 }}>Quem</th><th>Evento</th><th>Detalhes</th></tr>
          </thead>
          <tbody>
            {exibidos.map(e => (
              <tr key={e.id}>
                <td className="small muted">{new Date(e.criado_em).toLocaleString('pt-BR')}</td>
                <td className="small">
                  {e.actor?.nome_completo || e.actor?.discord_handle || <span className="muted">sistema</span>}
                </td>
                <td>{AUDIT_LABELS[e.action] || e.action}</td>
                <td className="small muted" style={{ fontFamily: "'Lora', serif" }}>
                  {e.payload?.numero_nota && <>Nº {e.payload.numero_nota} </>}
                  {e.payload?.de && e.payload?.para && <>· {e.payload.de} → {e.payload.para}</>}
                  {e.payload?.cliente && <> · cliente {e.payload.cliente}</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {exibidos.length < filtrados.length && (
        <div className="center mt-2">
          <button type="button" className="btn ghost"
            onClick={() => setVisiveis(v => v + 50)}>
            Carregar mais 50 eventos ({filtrados.length - exibidos.length} restantes)
          </button>
        </div>
      )}
    </>
  );
}

/* ========================= FINANCEIRO ========================= */
function FinanceiroTab() {
  const { showToast: showFinToast } = useUI() || {};
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [de, setDe] = useState(monthAgo);
  const [ate, setAte] = useState(today);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();
  const workerPct = 1 - (settings.commission_pct || 0.25);

  const carregar = async () => {
    setLoading(true);
    const ini = new Date(de + 'T00:00:00').toISOString();
    const fim = new Date(ate + 'T23:59:59').toISOString();
    const { data, error } = await supabase
      .from('claims')
      .select('id, status, criado_em, pago_em, entregue_em, data_prevista_entrega, trabalhador:profiles!claims_trabalhador_id_fkey(nome_completo, discord_handle, conta_bancaria), items:claim_items(quantidade, order_item:order_items(preco_unit, product:products(nome))), order:orders(numero_nota)')
      .gte('criado_em', ini)
      .lte('criado_em', fim)
      .order('criado_em', { ascending: false });
    if (error) { showFinToast?.(error.message, { type: 'error' }); setLoading(false); return; }
    setClaims(data || []);
    setLoading(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const agg = useMemo(() => {
    const byTrab = new Map();
    let totalPago = 0, totalAPagar = 0;
    claims.forEach(c => {
      const bruto = (c.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
      const liquido = bruto * workerPct;
      const key = c.trabalhador?.discord_handle || 'sem-id';
      if (!byTrab.has(key)) byTrab.set(key, { trab: c.trabalhador, pago: 0, a_pagar: 0, claims: 0 });
      const e = byTrab.get(key);
      e.claims += 1;
      if (c.status === 'pago') { e.pago += liquido; totalPago += liquido; }
      else if (c.status === 'entregue') { e.a_pagar += liquido; totalAPagar += liquido; }
    });
    return { byTrab: [...byTrab.values()].sort((a, b) => (b.a_pagar + b.pago) - (a.a_pagar + a.pago)), totalPago, totalAPagar };
  }, [claims, workerPct]);

  const exportar = () => {
    const rows = agg.byTrab.map(e => ({
      trabalhador: e.trab?.nome_completo || '',
      discord: e.trab?.discord_handle || '',
      conta: e.trab?.conta_bancaria || '',
      claims: e.claims,
      a_pagar: e.a_pagar.toFixed(2),
      pago: e.pago.toFixed(2),
    }));
    downloadCsv(`financeiro_${de}_${ate}.csv`, toCsv(rows, [
      'trabalhador', 'discord', 'conta', 'claims', 'a_pagar', 'pago',
    ]));
  };

  return (
    <>
      <div className="card" style={{ background: '#fff' }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 0 180px' }}>
            <label>De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '0 0 180px' }}>
            <label>Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} />
          </div>
          <button className="btn" onClick={carregar}>Atualizar</button>
          <button className="btn ghost" onClick={exportar} disabled={agg.byTrab.length === 0}>Exportar CSV</button>
        </div>
      </div>

      <div className="grid-3 mt-3">
        <div className="stat">
          <div className="label">Total já pago</div>
          <div className="value">{fmt(agg.totalPago)}</div>
          <div className="hint">claims entregues e pagos no período</div>
        </div>
        <div className="stat accent">
          <div className="label">A pagar</div>
          <div className="value">{fmt(agg.totalAPagar)}</div>
          <div className="hint">entregues e ainda não pagos</div>
        </div>
        <div className="stat">
          <div className="label">Trabalhadores</div>
          <div className="value">{agg.byTrab.length}</div>
          <div className="hint">com claims no período</div>
        </div>
      </div>

      {loading ? <p className="muted mt-2">Calculando…</p> : (
        <table className="book mt-3">
          <thead>
            <tr>
              <th>Trabalhador</th>
              <th>Discord</th>
              <th>Conta</th>
              <th className="num">Claims</th>
              <th className="num">A pagar</th>
              <th className="num">Pago</th>
            </tr>
          </thead>
          <tbody>
            {agg.byTrab.map((e, i) => (
              <tr key={i}>
                <td>{e.trab?.nome_completo || <span className="muted">—</span>}</td>
                <td className="small">{e.trab?.discord_handle}</td>
                <td className="small">{e.trab?.conta_bancaria}</td>
                <td className="num">{e.claims}</td>
                <td className="num" style={{ color: e.a_pagar > 0 ? 'var(--gold-deep)' : 'var(--ink-faded)' }}>
                  {fmt(e.a_pagar)}
                </td>
                <td className="num" style={{ color: 'var(--olive)' }}>{fmt(e.pago)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ========================= BACKUP ========================= */
function BackupTab() {
  const exportar = async (entidade) => {
    if (entidade === 'orders') {
      const { data } = await supabase.from('orders').select('numero_nota, short_code, cliente, status, prazo_entrega, desconto_pct, anotacoes, criado_em, aprovado_em, concluido_em');
      downloadCsv('pedidos.csv', toCsv(data || [], [
        'numero_nota', 'short_code', 'cliente', 'status', 'prazo_entrega', 'desconto_pct', 'anotacoes',
        'criado_em', 'aprovado_em', 'concluido_em',
      ]));
    } else if (entidade === 'claims') {
      const { data } = await supabase.from('claims')
        .select('id, status, data_prevista_entrega, entregue_em, pago_em, trabalhador:profiles!claims_trabalhador_id_fkey(nome_completo, discord_handle), order:orders(numero_nota)');
      const rows = (data || []).map(c => ({
        claim_id: c.id,
        pedido: c.order?.numero_nota,
        trabalhador: c.trabalhador?.nome_completo,
        discord: c.trabalhador?.discord_handle,
        status: c.status,
        prevista: c.data_prevista_entrega,
        entregue_em: c.entregue_em,
        pago_em: c.pago_em,
      }));
      downloadCsv('producao.csv', toCsv(rows, ['claim_id', 'pedido', 'trabalhador', 'discord', 'status', 'prevista', 'entregue_em', 'pago_em']));
    } else if (entidade === 'profiles') {
      const { data } = await supabase.from('profiles').select('nome_completo, discord_handle, identificacao, conta_bancaria, role, disabled, criado_em');
      downloadCsv('usuarios.csv', toCsv(data || [], ['nome_completo', 'discord_handle', 'identificacao', 'conta_bancaria', 'role', 'disabled', 'criado_em']));
    } else if (entidade === 'products') {
      const { data } = await supabase.from('products').select('nome, categoria, preco_min, preco_max');
      downloadCsv('produtos.csv', toCsv(data || [], ['nome', 'categoria', 'preco_min', 'preco_max']));
    }
  };

  return (
    <>
      <p className="muted small">Baixe os dados em CSV (compatível com Excel/Google Sheets).</p>
      <div className="grid-3">
        <div className="card center">
          <h3>Pedidos</h3>
          <p className="muted small">Todos os pedidos com status, prazo, datas.</p>
          <button className="btn" onClick={() => exportar('orders')}>Baixar CSV</button>
        </div>
        <div className="card center">
          <h3>Produção</h3>
          <p className="muted small">Claims (produções assumidas) com trabalhador.</p>
          <button className="btn" onClick={() => exportar('claims')}>Baixar CSV</button>
        </div>
        <div className="card center">
          <h3>Usuários</h3>
          <p className="muted small">Cadastros, roles, contas bancárias.</p>
          <button className="btn" onClick={() => exportar('profiles')}>Baixar CSV</button>
        </div>
        <div className="card center">
          <h3>Produtos</h3>
          <p className="muted small">Catálogo com preços min/max.</p>
          <button className="btn" onClick={() => exportar('products')}>Baixar CSV</button>
        </div>
      </div>
    </>
  );
}

/* ========================= ESTATÍSTICAS ========================= */
function EstatisticasTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    (async () => {
      const [orders, claims, profiles, products] = await Promise.all([
        supabase.from('orders').select('status'),
        supabase.from('claims').select('status, trabalhador_id, items:claim_items(quantidade, order_item:order_items(preco_unit))'),
        supabase.from('profiles').select('id, nome_completo, disabled'),
        supabase.from('products').select('id'),
      ]);
      const o = orders.data || []; const c = claims.data || [];
      const porStatus = {};
      o.forEach(x => { porStatus[x.status] = (porStatus[x.status] || 0) + 1; });
      const valorPago = c.filter(x => x.status === 'pago').reduce((acc, cl) =>
        acc + (cl.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0), 0);
      const porTrab = new Map();
      c.filter(x => x.status === 'pago').forEach(cl => {
        const bruto = (cl.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
        porTrab.set(cl.trabalhador_id, (porTrab.get(cl.trabalhador_id) || 0) + bruto);
      });
      const profMap = new Map((profiles.data || []).map(p => [p.id, p]));
      const topTrabalhadores = [...porTrab.entries()]
        .map(([id, v]) => ({ profile: profMap.get(id), bruto: v }))
        .sort((a, b) => b.bruto - a.bruto).slice(0, 5);
      setStats({
        totalOrders: o.length, porStatus, valorPago,
        totalUsuarios: (profiles.data || []).length,
        usuariosAtivos: (profiles.data || []).filter(p => !p.disabled).length,
        totalProdutos: (products.data || []).length, topTrabalhadores,
      });
    })();
  }, []);
  if (!stats) return <p className="muted">Calculando…</p>;
  return (
    <>
      <div className="grid-3">
        <div className="stat">
          <div className="label">Pedidos</div>
          <div className="value">{stats.totalOrders}</div>
          <div className="hint">{stats.porStatus.concluido || 0} concluídos · {stats.porStatus.em_producao || 0} em produção</div>
        </div>
        <div className="stat accent">
          <div className="label">Total pago</div>
          <div className="value">{fmt(stats.valorPago)}</div>
          <div className="hint">soma dos claims pagos (bruto)</div>
        </div>
        <div className="stat">
          <div className="label">Usuários</div>
          <div className="value">{stats.usuariosAtivos}<span style={{fontSize:'1rem',color:'var(--ink-mute)'}}> / {stats.totalUsuarios}</span></div>
          <div className="hint">ativos / total</div>
        </div>
      </div>
      <h3 className="mt-3">Top Trabalhadores</h3>
      {stats.topTrabalhadores.length === 0 ? (
        <div className="card"><p className="muted it small mt-0">Ainda sem dados.</p></div>
      ) : (
        <table className="book">
          <thead><tr><th>#</th><th>Trabalhador</th><th className="num">Bruto</th></tr></thead>
          <tbody>
            {stats.topTrabalhadores.map((t, i) => (
              <tr key={i}><td>{i + 1}º</td><td>{t.profile?.nome_completo || '—'}</td><td className="num">{fmt(t.bruto)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 className="mt-3">Pedidos por Status</h3>
      <div className="flex gap-1 wrap">
        {Object.entries(stats.porStatus).map(([s, n]) => (
          <span key={s} className={`badge ${s}`}>{statusLabel(s)}: {n}</span>
        ))}
      </div>
    </>
  );
}

/* ========================= DISCORD ========================= */
function DiscordTab() {
  const { settings, setSetting } = useSettings();
  const { showToast } = useUI() || {};
  const stored = settings.discord_webhooks || { pedidos: '', producao: '', financeiro: '' };
  const [local, setLocal] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  useEffect(() => { setLocal(stored); /* eslint-disable-next-line */ }, [settings.discord_webhooks]);

  const dirty = JSON.stringify(local) !== JSON.stringify(stored);

  const salvar = async () => {
    setSaving(true);
    try {
      // Normaliza: trim e remove espaços
      const clean = Object.fromEntries(
        Object.entries(local).map(([k, v]) => [k, (v || '').trim()])
      );
      await setSetting('discord_webhooks', clean);
      showToast?.('Webhooks salvos.', { type: 'success' });
    } catch (e) {
      showToast?.(e.message, { type: 'error' });
    }
    setSaving(false);
  };

  const testar = async (canal) => {
    if (!stored[canal]) {
      showToast?.('Salve a URL antes de testar.', { type: 'error' });
      return;
    }
    setTesting(canal);
    const { error } = await supabase.rpc('test_discord_webhook', { canal });
    setTesting(null);
    if (error) showToast?.(error.message, { type: 'error' });
    else showToast?.(`Mensagem de teste enviada ao canal "${canal}". Veja seu Discord.`, { type: 'success' });
  };

  const CANAIS = [
    {
      key: 'pedidos',
      titulo: '📜 Canal de Pedidos',
      desc: 'Recebe notificações de pedidos aprovados, cancelados e concluídos.',
      eventos: ['pedido aprovado', 'pedido cancelado', 'pedido concluído'],
    },
    {
      key: 'producao',
      titulo: '🛠 Canal de Produção',
      desc: 'Recebe notificações quando trabalhadores assumem produção.',
      eventos: ['claim assumido por trabalhador'],
    },
    {
      key: 'financeiro',
      titulo: '💰 Canal Financeiro',
      desc: 'Recebe notificações de entregas no baú e pagamentos confirmados.',
      eventos: ['claim entregue', 'pagamento confirmado'],
    },
  ];

  return (
    <>
      <div className="admin-note mt-2">
        <span className="admin-note-icon" aria-hidden="true">ⓘ</span>
        <div>
          As notificações aparecem automaticamente no Discord quando eventos importantes acontecem.
          Você pode usar o <strong>mesmo URL</strong> para todos os canais (vai pra um único canal) ou separar em 3 canais distintos.
          {' '}<a href="https://support.discord.com/hc/pt-br/articles/228383668" target="_blank" rel="noopener noreferrer">
            Como criar um webhook do Discord →
          </a>
        </div>
      </div>

      <div className="discord-cards mt-2">
        {CANAIS.map(c => (
          <div key={c.key} className="discord-card">
            <div className="discord-card-header">
              <h3 className="mt-0">{c.titulo}</h3>
              <p className="muted small mt-0">{c.desc}</p>
              <div className="discord-eventos">
                {c.eventos.map(e => <span key={e} className="discord-evento-chip">{e}</span>)}
              </div>
            </div>

            <div className="field">
              <label htmlFor={`wh-${c.key}`}>URL do webhook</label>
              <input
                id={`wh-${c.key}`}
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={local[c.key] || ''}
                onChange={e => setLocal(l => ({ ...l, [c.key]: e.target.value }))}
                style={{ fontFamily: 'monospace', fontSize: '.84rem' }}
              />
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                className="btn ghost sm"
                disabled={testing === c.key || !stored[c.key]}
                onClick={() => testar(c.key)}
                title={!stored[c.key] ? 'Salve a URL primeiro' : 'Enviar mensagem de teste'}>
                {testing === c.key ? 'Enviando…' : '✓ Testar canal'}
              </button>
              {local[c.key] && local[c.key] !== stored[c.key] && (
                <span className="muted small" style={{ alignSelf: 'center' }}>
                  ⚠ alteração não salva
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mt-2" style={{ justifyContent: 'flex-end' }}>
        {dirty && (
          <button className="btn ghost" onClick={() => setLocal(stored)}>
            Descartar alterações
          </button>
        )}
        <button className="btn" disabled={saving || !dirty} onClick={salvar}>
          {saving ? 'Salvando…' : 'Salvar webhooks'}
        </button>
      </div>

      <details className="discord-howto mt-3">
        <summary>Como criar um webhook do Discord (passo a passo)</summary>
        <ol>
          <li>No Discord, vá no canal desejado e clique no <strong>⚙ ícone de configurações</strong> ao lado do nome do canal.</li>
          <li>Clique em <strong>Integrações</strong> no menu lateral.</li>
          <li>Clique em <strong>Webhooks</strong> → <strong>Novo Webhook</strong>.</li>
          <li>Dê um nome (ex: "Caderno da Fazenda") e opcionalmente um avatar (use o logo da família).</li>
          <li>Clique em <strong>Copiar URL do Webhook</strong>.</li>
          <li>Cole aqui no campo correspondente e clique em <strong>Salvar webhooks</strong>.</li>
          <li>Clique em <strong>✓ Testar canal</strong> para confirmar que está funcionando.</li>
        </ol>
        <p className="muted small">
          <strong>Segurança:</strong> qualquer pessoa com o URL pode postar no canal. Mantenha em sigilo.
          Apenas o Proprietário enxerga esses URLs no Caderno (RLS no Postgres protege isso).
        </p>
      </details>
    </>
  );
}

/* ========================= ROOT ========================= */
const TABS = [
  { key: 'usuarios',    label: 'Usuários',     icon: '☥', desc: 'Gerencie acesso, papéis e habilitação dos membros da fazenda.' },
  { key: 'produtos',    label: 'Produtos',     icon: '✿', desc: 'Catálogo de produtos com faixa de preço e ícone visual.' },
  { key: 'categorias',  label: 'Categorias',   icon: '❖', desc: 'Categorias usadas para agrupar produtos no catálogo.' },
  { key: 'templates',   label: 'Templates',    icon: '▤', desc: 'Modelos de pedido salvos para reutilizar rapidamente.' },
  { key: 'config',      label: 'Configurações',icon: '⚙', desc: 'Comissão da Fazenda e parâmetros gerais do sistema.' },
  { key: 'discord',     label: 'Discord',      icon: '✦', desc: 'Notificações automáticas via webhooks do Discord. Embeds ricos quando pedidos e produções mudam de status.' },
  { key: 'audit',       label: 'Auditoria',    icon: '☞', desc: 'Histórico de eventos importantes — aprovações, cancelamentos, pagamentos.' },
  { key: 'financeiro',  label: 'Financeiro',   icon: '◈', desc: 'Pagamentos pendentes e realizados por trabalhador.' },
  { key: 'backup',      label: 'Backup',       icon: '⊟', desc: 'Exporte dados em CSV para snapshots manuais.' },
  { key: 'stats',       label: 'Estatísticas', icon: '▦', desc: 'Métricas globais da fazenda — produção, receita, top trabalhadores.' },
];

export default function Admin() {
  const [tab, setTab] = useState('usuarios');
  const current = TABS.find(t => t.key === tab) || TABS[0];
  return (
    <div className="page admin-page">
      <header className="admin-header">
        <h1 className="mt-0">Administração</h1>
        <p className="muted mt-0">Painel exclusivo do Proprietário.</p>
      </header>

      <div className="admin-layout">
        <Tabs value={tab} onChange={setTab} options={TABS} />

        <main className="admin-content">
          <div className="admin-tab-header">
            <h2 className="mt-0">
              <span className="admin-tab-header-icon" aria-hidden="true">{current.icon}</span>
              {current.label}
            </h2>
            <p className="muted mt-0">{current.desc}</p>
          </div>
          {tab === 'usuarios'   && <UsuariosTab />}
          {tab === 'produtos'   && <ProdutosTab />}
          {tab === 'categorias' && <CategoriasTab />}
          {tab === 'templates'  && <TemplatesTab />}
          {tab === 'config'     && <ConfigTab />}
          {tab === 'discord'    && <DiscordTab />}
          {tab === 'audit'      && <AuditTab />}
          {tab === 'financeiro' && <FinanceiroTab />}
          {tab === 'backup'     && <BackupTab />}
          {tab === 'stats'      && <EstatisticasTab />}
        </main>
      </div>
    </div>
  );
}
