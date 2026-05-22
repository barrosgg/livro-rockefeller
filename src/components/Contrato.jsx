import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

function fmtData1901(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')} de ${MESES[d.getMonth()]} de 1901`;
}

function fmtHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}h${mm}`;
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
          conforme a tabela de preços vigente para cada item, descontada a comissão da Fazenda.
          Os pagamentos serão efetuados em conta bancária ou em espécie na Fazenda após
          confirmação da entrega no baú.
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
          enquanto perdurar a relação de prestação de serviços.
        </p>

        <h3>Cláusula Sexta — Da Rescisão</h3>
        <p>
          O presente contrato poderá ser rescindido a qualquer tempo, por qualquer das partes,
          mediante comunicação às proprietárias da Fazenda ou pelo próprio sistema. A rescisão
          não isenta as partes do cumprimento das obrigações já assumidas, em especial:
          (i) a entrega de itens cuja produção já tenha sido iniciada por meio de pedidos
          aceitos; (ii) o pagamento das remunerações devidas por entregas confirmadas;
          (iii) o respeito às regras de harmonia previstas na Cláusula Quarta. Em caso de
          descumprimento das cláusulas e regras aqui estabelecidas, a CONTRATANTE poderá
          rescindir unilateralmente o contrato, com efeito imediato.
        </p>

        <p className="contrato-local">
          E, por estarem assim justas e contratadas, as partes firmam o presente instrumento.
          <br />
          Flatneck Station, New Hanover · Westfox · <strong>Anno MCMI</strong>
        </p>
      </div>

      <footer className="contrato-footer">
        {assinado ? (
          <div className="contrato-assinado-bloco">
            <div className="contrato-selo-aprovado">
              <div className="contrato-selo-aprovado-borda">
                <div className="contrato-selo-aprovado-texto">
                  <span>Família</span>
                  <strong>R</strong>
                  <span>MCMI</span>
                </div>
              </div>
            </div>

            <div className="contrato-assinado-conteudo">
              <div className="contrato-assinatura-cursiva">
                {profile.nome_completo}
              </div>
              <div className="contrato-assinatura-linha" />
              <div className="contrato-assinado-print">
                {profile.nome_completo} <span className="muted">·</span>{' '}
                Identificação Nº {profile.identificacao}
              </div>
              <div className="contrato-assinado-meta">
                Assinado eletronicamente em <strong>{fmtData1901(profile.contrato_assinado_em)}</strong>
                {' '}às <strong>{fmtHora(profile.contrato_assinado_em)}</strong>.
                <br />
                Flatneck Station, New Hanover · Westfox.
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
