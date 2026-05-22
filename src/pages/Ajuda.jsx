import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useCommissionPct, useWorkerPct } from '../lib/settings.jsx';

export default function Ajuda() {
  const { profile } = useAuth();
  const com = useCommissionPct();
  const trab = useWorkerPct();
  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';

  return (
    <div className="page" style={{ maxWidth: 880, margin: '0 auto' }}>
      <h1 className="mt-0">Como Funciona a Fazenda</h1>
      <p className="muted">
        Guia rápido do Caderno da Fazenda Rockefeller. Tudo o que você precisa saber para
        trabalhar conosco.
      </p>
      <hr className="divider" />

      <h2>O ciclo de um pedido</h2>
      <ol className="ajuda-passos">
        <li>
          <strong>Orçamento</strong> — Um Gerente da Família monta um orçamento com itens,
          quantidades e prazo de entrega.
        </li>
        <li>
          <strong>Aprovação</strong> — Após aprovação, o pedido fica visível para todos os
          trabalhadores.
        </li>
        <li>
          <strong>Produção</strong> — Trabalhadores assumem partes do pedido (você não precisa
          fazer tudo sozinho). Quantos itens cada um vai produzir e quando vai entregar é
          decidido livremente.
        </li>
        <li>
          <strong>Entrega no baú</strong> — Quando termina, o trabalhador marca a entrega no
          baú da Fazenda.
        </li>
        <li>
          <strong>Pagamento</strong> — Gerente confirma o pagamento. Pode ser bancário ou em
          espécie na Fazenda.
        </li>
        <li>
          <strong>Recibo</strong> — Cada produção paga gera um recibo público que serve de
          comprovante.
        </li>
      </ol>

      <h2 className="mt-3">Remuneração</h2>
      <p>
        A Fazenda retém <strong>{(com * 100).toFixed(0)}%</strong> de comissão em cima do
        valor bruto da produção. O trabalhador recebe <strong>{(trab * 100).toFixed(0)}%</strong>.
        Os preços de cada item ficam entre um <em>mínimo</em> e um <em>máximo</em> definidos no
        catálogo — quanto maior o preço aprovado, maior sua remuneração.
      </p>

      <h2 className="mt-3">Papéis</h2>
      <table className="book responsive">
        <thead>
          <tr><th>Papel</th><th>O que pode fazer</th></tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="Papel"><span className="badge proprietario">Proprietário</span></td>
            <td data-label="Pode">Controle total. Gerencia usuários, papéis, produtos, comissão, categorias, ícones e tudo no Admin.</td>
          </tr>
          <tr>
            <td data-label="Papel"><span className="badge gerente">Gerente</span></td>
            <td data-label="Pode">Cria orçamentos, aprova pedidos, confirma pagamentos, edita produtos e templates.</td>
          </tr>
          <tr>
            <td data-label="Papel"><span className="badge trabalhador">Trabalhador</span></td>
            <td data-label="Pode">Assume itens de pedidos abertos, produz e entrega no baú para receber remuneração.</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-3">Regras da Fazenda</h2>
      <ul className="ajuda-regras">
        <li>Manter a fazenda sempre bem limpa.</li>
        <li>Os animais sempre bem cuidados.</li>
        <li>O lugar onde ficam os animais sempre bem limpo.</li>
        <li>Tudo que plantar e colher será de lucro do Trabalhador.</li>
        <li>Fica a critério do Trabalhador para quem vender seus produtos colhidos e seus animais.</li>
        <li>Caso conheça pessoas que gostem de trabalhar com fazenda, avise a Família.</li>
        <li>Qualquer problema com a fazenda deve ser comunicado às proprietárias.</li>
        <li>Manter sempre tudo em harmonia.</li>
      </ul>

      <h2 className="mt-3">Sua credencial</h2>
      <p>
        Na <Link to="/perfil">página de Perfil</Link> você encontra sua <strong>Credencial
        oficial</strong> — uma carteira da Família Rockefeller com seu nome, identificação,
        avatar e código único. Use o botão <strong>📎 Copiar link público</strong> para
        compartilhar com clientes e parceiros, ou <strong>⬇ Baixar PNG</strong> para postar no
        Discord.
      </p>
      <p>
        Sua credencial também guarda suas <Link to="/perfil">conquistas</Link> — desbloqueadas
        à medida que você trabalha (primeira produção, mil unidades, top do ranking, etc.).
      </p>

      <h2 className="mt-3">Atalhos úteis</h2>
      <table className="book responsive">
        <thead><tr><th>Onde</th><th>Atalho</th><th>O que faz</th></tr></thead>
        <tbody>
          <tr><td data-label="Onde">Novo Pedido</td><td data-label="Atalho"><kbd>/</kbd></td><td data-label="Faz">Foca o campo de busca de produto</td></tr>
          <tr><td data-label="Onde">Novo Pedido</td><td data-label="Atalho"><kbd>↵</kbd></td><td data-label="Faz">Adiciona produto / quantidade</td></tr>
          <tr><td data-label="Onde">Novo Pedido</td><td data-label="Atalho"><kbd>Ctrl</kbd>+<kbd>↵</kbd></td><td data-label="Faz">Aprova o pedido</td></tr>
          <tr><td data-label="Onde">Novo Pedido</td><td data-label="Atalho"><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td data-label="Faz">Salva como rascunho</td></tr>
        </tbody>
      </table>

      {isManager && (
        <>
          <h2 className="mt-3">Para Gerentes & Proprietários</h2>
          <ul>
            <li><strong>Aprovação em lote</strong>: na lista de Pedidos, selecione vários rascunhos com a caixinha e use as ações em lote.</li>
            <li><strong>Templates</strong>: ao montar um pedido, você pode salvar como template para reutilizar depois.</li>
            <li><strong>Link p/ Cliente</strong>: cada pedido tem um link público compartilhável que mostra o andamento sem precisar de login.</li>
            <li><strong>Notas internas</strong>: card vermelho-borgonha visível só para gerentes/proprietários.</li>
            <li><strong>Bulk export</strong>: em Admin → Backup você baixa CSV de pedidos, produção, usuários e produtos.</li>
          </ul>
        </>
      )}

      <div className="divider" />
      <p className="muted center small">
        Dúvidas que este guia não respondeu? Procure um Proprietário da Família no Discord.
      </p>
    </div>
  );
}
