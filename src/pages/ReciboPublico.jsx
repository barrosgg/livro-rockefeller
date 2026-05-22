import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fmt } from '../lib/calc.js';
import { useCommissionPct, useWorkerPct } from '../lib/settings.jsx';
import { baixarComoPng } from '../lib/export.js';
import Avatar from '../components/Avatar.jsx';
import ProductIcon from '../components/ProductIcon.jsx';
import '../styles/credencial.css';
import '../styles/recibo.css';

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

function fmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')} de ${MESES[d.getMonth()]} de 1901`;
}
function fmtHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ReciboPublico() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(true);
  const reciboRef = useRef(null);
  const commission = useCommissionPct();
  const worker = useWorkerPct();

  useEffect(() => {
    let alive = true;
    const cacheKey = `recibo:${code}`;

    // Tenta cache local (sessionStorage) primeiro para render instantâneo
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}

    // Re-busca em background para garantir dados atualizados
    supabase.rpc('get_recibo_public', { p_code: code }).then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        // Se cache existia, mantém. Só mostra erro se não havia nada.
        setErro(prev => prev || (sessionStorage.getItem(cacheKey) ? null : error.message));
        setLoading(false);
        return;
      }
      setData(data);
      setLoading(false);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
    });
    return () => { alive = false; };
  }, [code]);

  if (loading) return <div className="login-wrap"><div className="page login-card">Buscando recibo…</div></div>;
  if (erro || !data) return (
    <div className="login-wrap">
      <div className="page login-card">
        <h2>Recibo não encontrado</h2>
        <p className="muted">{erro || 'O link pode estar incorreto ou o pagamento ainda não foi confirmado.'}</p>
      </div>
    </div>
  );

  const { claim, order, trabalhador, items, bruto } = data;
  const comissao = Number(bruto) * commission;
  const liquido = Number(bruto) * worker;
  const numero = (claim.public_code || '').match(/.{1,4}/g)?.join(' ') || claim.public_code;

  return (
    <div className="shell">
      <div className="recibo-stage">
        <div className="recibo" ref={reciboRef}>
          <header className="recibo-header">
            <div className="recibo-numero">Recibo Nº {numero}</div>
            <img className="brand" src="/familia-rockefeller.png" alt="Família Rockefeller" />
            <div className="recibo-empresa">
              Rockefeller Produtos Agropecuários S.A.
              <div className="recibo-empresa-end">
                Flatneck Station · New Hanover · Westfox
              </div>
            </div>
          </header>

          <div className="recibo-pessoa">
            <Avatar slug={trabalhador.avatar} name={trabalhador.nome_completo} size={56} />
            <div>
              <div className="recibo-pessoa-nome">{trabalhador.nome_completo}</div>
              <div className="recibo-pessoa-meta">
                Identificação Nº {trabalhador.identificacao} · Conta {trabalhador.conta_bancaria}
              </div>
            </div>
          </div>

          <div className="recibo-meta-pedido">
            <strong>Pedido Nº {order.numero_nota}</strong>
            {order.cliente && <> · cliente {order.cliente}</>}
          </div>

          <table className="recibo-tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Qtd</th>
                <th className="num">Preço unit.</th>
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <div className="flex gap-1 center-y">
                      <ProductIcon slug={it.product.icon} name={it.product.nome} size={20} />
                      {it.product.nome}
                    </div>
                  </td>
                  <td className="num">{it.quantidade}</td>
                  <td className="num">{fmt(it.preco_unit)}</td>
                  <td className="num">{fmt(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="recibo-totais">
            <div><span>Bruto da produção</span><strong>{fmt(bruto)}</strong></div>
            <div className="recibo-totais-desc"><span>Comissão da Fazenda ({(commission*100).toFixed(0)}%)</span><strong>−{fmt(comissao)}</strong></div>
            <div className="recibo-totais-final"><span>Líquido pago ao trabalhador</span><strong>{fmt(liquido)}</strong></div>
          </div>

          <footer className="recibo-footer">
            <div className="recibo-assinatura">
              <div className="recibo-assinatura-cursiva">{trabalhador.nome_completo}</div>
              <div className="recibo-assinatura-linha" />
              <div className="recibo-assinatura-print">Recebido por {trabalhador.nome_completo}</div>
              <div className="recibo-assinatura-meta">
                Entrega no baú em <strong>{fmtData(claim.entregue_em)}</strong> às <strong>{fmtHora(claim.entregue_em)}</strong>
                <br />
                Pagamento confirmado em <strong>{fmtData(claim.pago_em)}</strong> às <strong>{fmtHora(claim.pago_em)}</strong>
              </div>
            </div>

            <div className="credencial-selo" title="Família Rockefeller · Pagamento confirmado">
              <div className="credencial-selo-top">Pago</div>
              <div className="credencial-selo-mid">✓</div>
              <div className="credencial-selo-bottom">MCMI</div>
            </div>
          </footer>
        </div>

        <div className="mt-2 center">
          <button className="btn" onClick={() => baixarComoPng(reciboRef.current, `recibo-${claim.public_code}`)}>
            ⬇ Baixar Recibo (PNG)
          </button>
        </div>
      </div>
    </div>
  );
}
