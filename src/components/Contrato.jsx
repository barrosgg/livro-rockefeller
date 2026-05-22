import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

function fmtDataLora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const meses = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${dia} de ${meses[d.getMonth()]} de 1901`;
}

const REGRAS = [
  'Manter a fazenda sempre bem limpa.',
  'Os animais sempre bem cuidados.',
  'O lugar onde ficam os animais sempre bem limpo.',
  'Tudo que plantar e colher será de lucro do(a) CONTRATADO(A).',
  'Animais e tudo que produzirem serão de lucro do(a) CONTRATADO(A).',
  'Fica a critério do(a) CONTRATADO(A) para quem vender seus produtos colhidos.',
  'Fica a critério do(a) CONTRATADO(A) para quem vender os animais.',
  'Caso conheça pessoas que gostem de trabalhar com fazenda, deve avisar à Família.',
  'Qualquer problema com a fazenda deve ser comunicado às proprietárias.',
  'Manter sempre tudo em harmonia.',
];

export default function Contrato({ profile, onAssinar }) {
  const assinado = !!profile?.contrato_assinado_em;
  const [aceito, setAceito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const assinar = async () => {
    if (!aceito) return;
    setSalvando(true); setErro(null);
    const { error } = await supabase
      .from('profiles')
      .update({ contrato_assinado_em: new Date().toISOString() })
      .eq('id', profile.id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onAssinar?.();
  };

  return (
    <div className="contrato-card">
      <header className="contrato-header">
        <h2>Contrato de Prestação de Serviços</h2>
        <p className="contrato-sub">Produção Agropecuária · Família Rockefeller</p>
      </header>

      <div className="contrato-corpo">
        <p>
          <strong>Entre as partes:</strong>
          <br />
          <span className="contrato-parte">
            CONTRATANTE: <strong>Rockefeller Produtos Agropecuários S.A.</strong>,
            estabelecida em Flatneck Station, New Hanover · Westfox.
          </span>
          <br />
          <span className="contrato-parte">
            CONTRATADO(A): <strong>{profile?.nome_completo || '—'}</strong>,
            portador(a) da identificação Nº <strong>{profile?.identificacao || '—'}</strong>,
            conta bancária <strong>{profile?.conta_bancaria || '—'}</strong>.
          </span>
        </p>

        <h3>Cláusula Primeira — Do Objeto</h3>
        <p>
          O presente contrato tem por objeto a prestação de serviços de produção agropecuária
          pelo(a) CONTRATADO(A) em benefício da CONTRATANTE, contemplando o plantio, a colheita,
          a criação e o trato de animais e a produção de insumos da fazenda.
        </p>

        <h3>Cláusula Segunda — Da Distribuição e Pagamento</h3>
        <p>
          Os serviços serão distribuídos por meio do <em>Caderno da Fazenda Rockefeller</em>,
          registro oficial de orçamentos, pedidos e produção. A remuneração será calculada
          conforme a tabela de preços vigente para cada item, descontada a comissão da Fazenda
          definida em sistema. Os pagamentos serão efetuados em conta bancária após confirmação
          da entrega no baú.
        </p>

        <h3>Cláusula Terceira — Das Regras da Fazenda</h3>
        <ol className="contrato-regras">
          {REGRAS.map((r, i) => <li key={i}>{r}</li>)}
        </ol>

        <h3>Cláusula Quarta — Da Harmonia</h3>
        <p>
          As partes comprometem-se a manter sempre a harmonia entre os membros, base do
          funcionamento da Família Rockefeller. Qualquer desavença deverá ser comunicada às
          proprietárias para mediação amigável.
        </p>

        <h3>Cláusula Quinta — Da Vigência</h3>
        <p>
          Este contrato vigora a partir da data do aceite eletrônico, por prazo indeterminado,
          podendo ser rescindido por qualquer das partes mediante comunicação.
        </p>

        <p className="contrato-local">
          Flatneck Station, New Hanover · Westfox · <strong>Anno MCMI</strong>
        </p>
      </div>

      <footer className="contrato-footer">
        {assinado ? (
          <div className="contrato-assinado">
            <div className="contrato-selo-ok">✓</div>
            <div>
              <strong>Contrato assinado</strong>
              <div className="muted small">em {fmtDataLora(profile.contrato_assinado_em)}</div>
              <div className="muted small" style={{ marginTop: 2, fontStyle: 'italic' }}>
                Assinatura registrada: {profile.nome_completo}
              </div>
            </div>
          </div>
        ) : (
          <>
            <label className="contrato-aceite">
              <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} />
              <span>
                Li e aceito todas as cláusulas e regras deste contrato, em nome de
                <strong> {profile?.nome_completo || '—'}</strong>.
              </span>
            </label>
            <button className="btn lg" disabled={!aceito || salvando} onClick={assinar}>
              {salvando ? 'Registrando assinatura…' : '✍ Assinar Contrato'}
            </button>
            {erro && <p style={{ color: 'var(--burgundy)' }}>{erro}</p>}
          </>
        )}
      </footer>
    </div>
  );
}
