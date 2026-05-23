import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useFocusTrap } from '../lib/a11y.js';

const ROLE_DESC = {
  proprietario: {
    nome: 'Proprietário',
    poderes: 'controle total — gerencia usuários, papéis, produtos, comissão e tudo no Admin.',
  },
  gerente: {
    nome: 'Gerente',
    poderes: 'cria orçamentos, aprova pedidos, marca pagamentos e organiza a produção.',
  },
  trabalhador: {
    nome: 'Trabalhador',
    poderes: 'assume itens de pedidos abertos, produz e entrega no baú para receber sua remuneração.',
  },
};

export default function Onboarding({ profile, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const role = profile?.role || 'trabalhador';
  const roleInfo = ROLE_DESC[role] || ROLE_DESC.trabalhador;
  const modalRef = useFocusTrap(true);

  const finalizar = async (paraContrato = false) => {
    await supabase.from('profiles')
      .update({ onboarding_completed_em: new Date().toISOString() })
      .eq('id', profile.id);
    onClose?.();
    if (paraContrato) navigate('/perfil');
  };

  const slides = [
    {
      titulo: 'Bem-vindo à Família Rockefeller',
      conteudo: (
        <>
          <p>
            Este é o <strong>Livro da Fazenda</strong> — onde registramos todos os
            orçamentos, produções e pagamentos da nossa propriedade em <em>Flatneck Station,
            New Hanover</em>.
          </p>
          <p>
            Em poucos passos você vai entender como tudo funciona e estará pronto(a)
            para trabalhar conosco. ✋
          </p>
        </>
      ),
    },
    {
      titulo: 'Como funcionam os pedidos',
      conteudo: (
        <>
          <ol className="onboarding-passos">
            <li><strong>Gerente</strong> abre um pedido na Fazenda com os itens necessários e prazo.</li>
            <li><strong>Trabalhador</strong> vê o pedido em <em>Pedidos</em> e assume a quantidade que pretende produzir.</li>
            <li>Quando termina, marca a <strong>entrega no baú</strong> da Fazenda.</li>
            <li>O <strong>Gerente</strong> confirma o pagamento — bancário ou em espécie.</li>
            <li>O sistema gera um <strong>recibo público</strong> e o ciclo se encerra.</li>
          </ol>
          <p className="muted small">
            A Fazenda retém uma comissão de cada produção. Você recebe o líquido do trabalho.
          </p>
        </>
      ),
    },
    {
      titulo: `Seu papel: ${roleInfo.nome}`,
      conteudo: (
        <>
          <p>
            Você foi cadastrado(a) como <strong>{roleInfo.nome}</strong>.
          </p>
          <p>
            Isso significa que você tem {roleInfo.poderes}
          </p>
          <p className="muted small">
            Caso precise mudar de papel, fale com algum Proprietário da Família.
          </p>
        </>
      ),
    },
    {
      titulo: 'Próximos passos',
      conteudo: (
        <>
          <ul className="onboarding-checklist">
            <li>✍ <strong>Assine o contrato</strong> de prestação de serviços (obrigatório antes de assumir produção).</li>
            <li>🖼 <strong>Personalize seu avatar</strong> com uma imagem do seu personagem.</li>
            <li>📜 <strong>Compartilhe sua credencial</strong> com colegas e clientes.</li>
            <li>🏆 <strong>Acompanhe suas conquistas</strong> conforme você produz.</li>
          </ul>
          <p className="muted small">
            Você pode rever esse guia a qualquer momento em <strong>Ajuda</strong>, no menu.
          </p>
        </>
      ),
    },
  ];

  const ultimo = step === slides.length - 1;
  const atual = slides[step];

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-modal" ref={modalRef}>
        <div className="onboarding-progress">
          {slides.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        <h2 id="onboarding-title" className="onboarding-titulo">{atual.titulo}</h2>
        <div className="onboarding-conteudo">{atual.conteudo}</div>

        <div className="onboarding-acoes">
          <button
            type="button"
            className="btn ghost"
            onClick={() => finalizar(false)}>
            Pular tutorial
          </button>

          <div className="flex gap-1">
            {step > 0 && (
              <button type="button" className="btn ghost" onClick={() => setStep(s => s - 1)}>
                ← Voltar
              </button>
            )}
            {!ultimo && (
              <button type="button" className="btn" onClick={() => setStep(s => s + 1)}>
                Continuar →
              </button>
            )}
            {ultimo && (
              <button type="button" className="btn" onClick={() => finalizar(true)}>
                Ir para o Contrato ✍
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
