import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useSettings } from '../lib/settings.jsx';
import { useAuth } from '../lib/auth.jsx';
import { fmt, statusLabel } from '../lib/calc.js';

const ROLES = ['proprietario', 'gerente', 'trabalhador'];
const CATEGORIAS = [
  'Frutas, Grãos & Vegetais',
  'Laticínios',
  'Animais & Insumos',
  'Especiarias & Outros',
  'Matérias-primas',
  'Sacos',
];

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
  const [editing, setEditing] = useState(null); // profile sendo editado
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
      if (!confirm('Você está prestes a DESABILITAR a si mesmo. Perderá acesso. Continuar?')) return;
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
              <td>{p.nome_completo || <span className="muted">—</span>}</td>
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
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ nome: '', categoria: CATEGORIAS[0], preco_min: '', preco_max: '' });
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});

  const carregar = () => supabase.from('products').select('*').order('nome')
    .then(({ data }) => { setProdutos(data || []); setLoading(false); });
  useEffect(() => { carregar(); }, []);

  const adicionar = async (e) => {
    e.preventDefault();
    const payload = {
      nome: novo.nome.trim(),
      categoria: novo.categoria,
      preco_min: Number(novo.preco_min),
      preco_max: Number(novo.preco_max),
    };
    if (!payload.nome) { alert('Nome obrigatório.'); return; }
    if (payload.preco_min <= 0 || payload.preco_max < payload.preco_min) {
      alert('Preço inválido (mínimo > 0 e máximo ≥ mínimo).'); return;
    }
    const { error } = await supabase.from('products').insert(payload);
    if (error) { alert(error.message); return; }
    setNovo({ nome: '', categoria: CATEGORIAS[0], preco_min: '', preco_max: '' });
    carregar();
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditVals({ categoria: p.categoria, preco_min: p.preco_min, preco_max: p.preco_max });
  };

  const salvarEdit = async (id) => {
    const v = editVals;
    if (Number(v.preco_min) <= 0 || Number(v.preco_max) < Number(v.preco_min)) {
      alert('Preço inválido.'); return;
    }
    const { error } = await supabase.from('products').update({
      categoria: v.categoria,
      preco_min: Number(v.preco_min),
      preco_max: Number(v.preco_max),
    }).eq('id', id);
    if (error) { alert(error.message); return; }
    setEditId(null);
    carregar();
  };

  const apagar = async (p) => {
    if (!confirm(`Apagar "${p.nome}"? (vai falhar se ele já estiver em algum pedido)`)) return;
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
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
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
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : <span className="muted small">{p.categoria}</span>}
                </td>
                <td className="num">
                  {editing
                    ? <input type="number" step="0.01" min="0" value={editVals.preco_min}
                        onChange={e => setEditVals({ ...editVals, preco_min: e.target.value })} />
                    : fmt(p.preco_min)}
                </td>
                <td className="num">
                  {editing
                    ? <input type="number" step="0.01" min="0" value={editVals.preco_max}
                        onChange={e => setEditVals({ ...editVals, preco_max: e.target.value })} />
                    : fmt(p.preco_max)}
                </td>
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

/* ========================= CONFIGURAÇÕES ========================= */
function ConfigTab() {
  const { settings, setSetting, refresh } = useSettings();
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
    if (isNaN(pct) || pct < 0 || pct > 0.9) {
      setMsg({ type: 'err', text: 'Comissão precisa estar entre 0 e 90%.' });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      await setSetting('commission_pct', pct);
      setMsg({ type: 'ok', text: 'Comissão atualizada.' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    setSaving(false);
  };

  const salvarNome = async () => {
    setSaving(true); setMsg(null);
    try {
      await setSetting('farm_name', farmName);
      setMsg({ type: 'ok', text: 'Nome da fazenda atualizado.' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    setSaving(false);
  };

  return (
    <>
      <div className="card" style={{ background: '#fff' }}>
        <h3 className="mt-0">Comissão da Fazenda</h3>
        <p className="muted small">
          Percentual retido pela Fazenda em cada produção. O trabalhador recebe (100% − comissão).
          <br />
          <strong>Atual: {(settings.commission_pct * 100).toFixed(1)}%</strong> ·
          trabalhador recebe <strong>{((1 - settings.commission_pct) * 100).toFixed(1)}%</strong>.
        </p>
        <div className="flex gap-1 wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 0 140px', marginBottom: 0 }}>
            <label>Comissão (%)</label>
            <input type="number" step="0.5" min="0" max="90" value={commissionInput}
              style={{ textAlign: 'right' }}
              onChange={e => setCommissionInput(e.target.value)} />
          </div>
          <button className="btn" disabled={saving} onClick={salvarComissao}>Salvar Comissão</button>
        </div>
      </div>

      <div className="card mt-2" style={{ background: '#fff' }}>
        <h3 className="mt-0">Nome da Fazenda</h3>
        <p className="muted small">Usado no cabeçalho da mensagem do Discord.</p>
        <div className="flex gap-1 wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 280px', marginBottom: 0 }}>
            <label>Nome</label>
            <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} />
          </div>
          <button className="btn" disabled={saving} onClick={salvarNome}>Salvar Nome</button>
        </div>
      </div>

      {msg && (
        <p className="mt-2" style={{ color: msg.type === 'err' ? 'var(--burgundy)' : 'var(--olive)' }}>
          {msg.text}
        </p>
      )}
    </>
  );
}

/* ========================= ESTATÍSTICAS (overview básico) ========================= */
function EstatisticasTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    (async () => {
      const [orders, claims, profiles, products] = await Promise.all([
        supabase.from('orders').select('status, desconto_pct, criado_em'),
        supabase.from('claims').select('status, pago_em, trabalhador_id, items:claim_items(quantidade, order_item:order_items(preco_unit))'),
        supabase.from('profiles').select('id, nome_completo, disabled, role'),
        supabase.from('products').select('id'),
      ]);
      const o = orders.data || []; const c = claims.data || [];
      const porStatus = {};
      o.forEach(x => { porStatus[x.status] = (porStatus[x.status] || 0) + 1; });
      const valorPago = (c || []).filter(x => x.status === 'pago').reduce((acc, cl) => {
        return acc + (cl.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
      }, 0);
      // Top trabalhadores por valor bruto produzido (pago)
      const porTrab = new Map();
      (c || []).filter(x => x.status === 'pago').forEach(cl => {
        const bruto = (cl.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
        porTrab.set(cl.trabalhador_id, (porTrab.get(cl.trabalhador_id) || 0) + bruto);
      });
      const profMap = new Map((profiles.data || []).map(p => [p.id, p]));
      const topTrabalhadores = [...porTrab.entries()]
        .map(([id, v]) => ({ profile: profMap.get(id), bruto: v }))
        .sort((a, b) => b.bruto - a.bruto).slice(0, 5);

      setStats({
        totalOrders: o.length,
        porStatus,
        valorPago,
        totalUsuarios: (profiles.data || []).length,
        usuariosAtivos: (profiles.data || []).filter(p => !p.disabled).length,
        totalProdutos: (products.data || []).length,
        topTrabalhadores,
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

      <h3 className="mt-3">Top Trabalhadores (por valor produzido)</h3>
      {stats.topTrabalhadores.length === 0 ? (
        <div className="card"><p className="muted it small mt-0">Ainda sem dados — nenhum claim pago ainda.</p></div>
      ) : (
        <table className="book">
          <thead><tr><th>#</th><th>Trabalhador</th><th className="num">Bruto produzido</th></tr></thead>
          <tbody>
            {stats.topTrabalhadores.map((t, i) => (
              <tr key={i}>
                <td>{i + 1}º</td>
                <td>{t.profile?.nome_completo || '—'}</td>
                <td className="num">{fmt(t.bruto)}</td>
              </tr>
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
  { key: 'usuarios', label: 'Usuários' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'config',   label: 'Configurações' },
  { key: 'stats',    label: 'Estatísticas' },
];

export default function Admin() {
  const [tab, setTab] = useState('usuarios');
  return (
    <div className="page">
      <h1 className="mt-0">Administração</h1>
      <p className="muted small">Painel exclusivo do Proprietário.</p>
      <Tabs value={tab} onChange={setTab} options={TABS} />
      <hr className="divider" />
      {tab === 'usuarios' && <UsuariosTab />}
      {tab === 'produtos' && <ProdutosTab />}
      {tab === 'config'   && <ConfigTab />}
      {tab === 'stats'    && <EstatisticasTab />}
    </div>
  );
}
