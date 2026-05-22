import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useSettings, useCategorias } from '../lib/settings.jsx';
import { useAuth } from '../lib/auth.jsx';
import { fmt, statusLabel } from '../lib/calc.js';
import { toCsv, downloadCsv } from '../lib/csv.js';
import Avatar from '../components/Avatar.jsx';

const ROLES = ['proprietario', 'gerente', 'trabalhador'];

function Tabs({ value, onChange, options }) {
  return (
    <div className="flex gap-1 wrap mt-2">
      {options.map(o => (
        <button key={o.key}
          className={`btn sm ${value === o.key ? '' : 'ghost'}`}
          onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ========================= USUÁRIOS ========================= */
function UsuariosTab() {
  const { user: me } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const carregar = () => supabase.from('profiles').select('*').order('criado_em')
    .then(({ data }) => { setProfiles(data || []); setLoading(false); });
  useEffect(() => { carregar(); }, []);

  const salvarEdit = async () => {
    const { id, nome_completo, identificacao, discord_handle, conta_bancaria } = editing;
    const { error } = await supabase.from('profiles')
      .update({ nome_completo, identificacao, discord_handle, conta_bancaria })
      .eq('id', id);
    if (error) { alert(error.message); return; }
    setEditing(null);
    setMsg({ type: 'ok', text: 'Dados atualizados.' });
    carregar();
  };

  const mudarRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) alert(error.message); else carregar();
  };

  const toggleDisabled = async (p) => {
    if (p.id === me.id && !p.disabled) {
      if (!confirm('Você está prestes a DESABILITAR a si mesmo. Continuar?')) return;
    }
    const { error } = await supabase.from('profiles').update({ disabled: !p.disabled }).eq('id', p.id);
    if (error) alert(error.message); else carregar();
  };

  if (loading) return <p className="muted">Carregando…</p>;

  return (
    <>
      {msg && <p className="muted small">{msg.text}</p>}
      <table className="book mt-2">
        <thead>
          <tr>
            <th>Nome</th><th>Discord</th><th>Identif.</th><th>Conta</th>
            <th style={{ width: 140 }}>Papel</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 140 }}></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <tr key={p.id} style={{ opacity: p.disabled ? 0.55 : 1 }}>
              <td>
                <div className="flex gap-1 center-y">
                  <Avatar slug={p.avatar} name={p.nome_completo} size={28} />
                  <span>{p.nome_completo || <span className="muted">—</span>}</span>
                </div>
              </td>
              <td>{p.discord_handle || <span className="muted">—</span>}</td>
              <td>{p.identificacao || <span className="muted">—</span>}</td>
              <td>{p.conta_bancaria || <span className="muted">—</span>}</td>
              <td>
                <select value={p.role} onChange={e => mudarRole(p.id, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>
                {p.disabled
                  ? <span className="badge cancelado">Desabilitado</span>
                  : <span className="badge aprovado">Ativo</span>}
              </td>
              <td>
                <div className="flex gap-1">
                  <button className="btn ghost sm" onClick={() => setEditing(p)}>editar</button>
                  <button className={`btn sm ${p.disabled ? 'success' : 'danger'}`} onClick={() => toggleDisabled(p)}>
                    {p.disabled ? 'reativar' : 'desabilitar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ nome: '', categoria: '', preco_min: '', preco_max: '' });
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
    };
    if (!payload.nome) { alert('Nome obrigatório.'); return; }
    if (payload.preco_min <= 0 || payload.preco_max < payload.preco_min) {
      alert('Preço inválido.'); return;
    }
    const { error } = await supabase.from('products').insert(payload);
    if (error) { alert(error.message); return; }
    setNovo({ nome: '', categoria: categorias[0] || '', preco_min: '', preco_max: '' });
    carregar();
  };

  const startEdit = (p) => { setEditId(p.id); setEditVals({ categoria: p.categoria, preco_min: p.preco_min, preco_max: p.preco_max }); };

  const salvarEdit = async (id) => {
    const v = editVals;
    if (Number(v.preco_min) <= 0 || Number(v.preco_max) < Number(v.preco_min)) { alert('Preço inválido.'); return; }
    const { error } = await supabase.from('products').update({
      categoria: v.categoria, preco_min: Number(v.preco_min), preco_max: Number(v.preco_max),
    }).eq('id', id);
    if (error) { alert(error.message); return; }
    setEditId(null); carregar();
  };

  const apagar = async (p) => {
    if (!confirm(`Apagar "${p.nome}"?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) alert(error.message); else carregar();
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
          <button className="btn">Adicionar</button>
        </form>
      </div>

      <h3 className="mt-3">{produtos.length} produtos no catálogo</h3>
      <table className="book">
        <colgroup>
          <col /><col style={{ width: 200 }} /><col style={{ width: 120 }} /><col style={{ width: 120 }} /><col style={{ width: 140 }} />
        </colgroup>
        <thead>
          <tr><th>Nome</th><th>Categoria</th><th className="num">Preço mín.</th><th className="num">Preço máx.</th><th></th></tr>
        </thead>
        <tbody>
          {produtos.map(p => {
            const editing = editId === p.id;
            return (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>
                  {editing ? (
                    <select value={editVals.categoria} onChange={e => setEditVals({ ...editVals, categoria: e.target.value })}>
                      {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : <span className="muted small">{p.categoria}</span>}
                </td>
                <td className="num">{editing
                  ? <input type="number" step="0.01" value={editVals.preco_min}
                      onChange={e => setEditVals({ ...editVals, preco_min: e.target.value })} />
                  : fmt(p.preco_min)}</td>
                <td className="num">{editing
                  ? <input type="number" step="0.01" value={editVals.preco_max}
                      onChange={e => setEditVals({ ...editVals, preco_max: e.target.value })} />
                  : fmt(p.preco_max)}</td>
                <td>
                  {editing ? (
                    <div className="flex gap-1">
                      <button className="btn sm" onClick={() => salvarEdit(p.id)}>salvar</button>
                      <button className="btn ghost sm" onClick={() => setEditId(null)}>×</button>
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
    try { await setSetting('categorias', lista); } catch (e) { alert(e.message); }
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
                    <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button className="btn ghost sm" disabled={i === lista.length - 1} onClick={() => move(i, 1)}>↓</button>
                  </div>
                </td>
                <td>{c}</td>
                <td style={{ width: 60 }}>
                  <button className="btn ghost sm" style={{ color: 'var(--burgundy)' }} onClick={() => remover(i)}>×</button>
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
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = () => supabase
    .from('order_templates')
    .select('*, items:order_template_items(*, product:products(nome))')
    .order('criado_em', { ascending: false })
    .then(({ data }) => { setTemplates(data || []); setLoading(false); });
  useEffect(() => { carregar(); }, []);

  const apagar = async (t) => {
    if (!confirm(`Apagar template "${t.nome}"?`)) return;
    const { error } = await supabase.from('order_templates').delete().eq('id', t.id);
    if (error) alert(error.message); else carregar();
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

  if (loading) return <p className="muted">Carregando…</p>;

  return (
    <>
      <div className="flex gap-1 wrap">
        {['todos', 'order', 'claim', 'profile'].map(t => (
          <button key={t} className={`btn sm ${filtro === t ? '' : 'ghost'}`} onClick={() => setFiltro(t)}>
            {t === 'todos' ? 'Todos' : t === 'order' ? 'Pedidos' : t === 'claim' ? 'Produção' : 'Usuários'}
          </button>
        ))}
      </div>
      <p className="muted small mt-2">Últimos 500 eventos.</p>
      {filtrados.length === 0 ? (
        <div className="card"><p className="muted it mt-0">Nenhum evento.</p></div>
      ) : (
        <table className="book mt-2">
          <thead>
            <tr><th style={{ width: 160 }}>Quando</th><th style={{ width: 220 }}>Quem</th><th>Evento</th><th>Detalhes</th></tr>
          </thead>
          <tbody>
            {filtrados.map(e => (
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
    </>
  );
}

/* ========================= FINANCEIRO ========================= */
function FinanceiroTab() {
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
    if (error) { alert(error.message); setLoading(false); return; }
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

/* ========================= ROOT ========================= */
const TABS = [
  { key: 'usuarios',    label: 'Usuários' },
  { key: 'produtos',    label: 'Produtos' },
  { key: 'categorias',  label: 'Categorias' },
  { key: 'templates',   label: 'Templates' },
  { key: 'config',      label: 'Configurações' },
  { key: 'audit',       label: 'Auditoria' },
  { key: 'financeiro',  label: 'Financeiro' },
  { key: 'backup',      label: 'Backup' },
  { key: 'stats',       label: 'Estatísticas' },
];

export default function Admin() {
  const [tab, setTab] = useState('usuarios');
  return (
    <div className="page">
      <h1 className="mt-0">Administração</h1>
      <p className="muted small">Painel exclusivo do Proprietário.</p>
      <Tabs value={tab} onChange={setTab} options={TABS} />
      <hr className="divider" />
      {tab === 'usuarios'   && <UsuariosTab />}
      {tab === 'produtos'   && <ProdutosTab />}
      {tab === 'categorias' && <CategoriasTab />}
      {tab === 'templates'  && <TemplatesTab />}
      {tab === 'config'     && <ConfigTab />}
      {tab === 'audit'      && <AuditTab />}
      {tab === 'financeiro' && <FinanceiroTab />}
      {tab === 'backup'     && <BackupTab />}
      {tab === 'stats'      && <EstatisticasTab />}
    </div>
  );
}
