import Avatar from './Avatar.jsx';

const ROLE_LABELS = {
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  trabalhador: 'Trabalhador',
};

function gerarNumeroCredencial(seed) {
  if (!seed) return '0000';
  const hash = String(seed).replace(/-/g, '').slice(0, 8).toUpperCase();
  return hash.match(/.{1,4}/g).join(' ');
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Renderiza visualmente a credencial.
 * `profile` deve ter: nome_completo, identificacao, conta_bancaria, correio,
 *                     role, avatar, criado_em, public_code.
 */
export default function Credencial({ profile }) {
  const numero = gerarNumeroCredencial(profile?.public_code || profile?.id);
  return (
    <div className="credencial">
      <span className="corner tl" /><span className="corner tr" />
      <span className="corner bl" /><span className="corner br" />

      <header className="credencial-header">
        <div className="credencial-emissao-top">Emitida em {formatarData(profile?.criado_em)}</div>
        <div className="credencial-numero">Nº {numero}</div>
        <img className="brand" src="/familia-rockefeller.png" alt="Família Rockefeller" />
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
            <span className="credencial-label">Conta Bancária</span>
            <div className="credencial-valor">{profile?.conta_bancaria || <em className="empty">—</em>}</div>
          </div>

          <div className="credencial-campo full">
            <span className="credencial-label">Correio (PO Box)</span>
            <div className="credencial-valor">{profile?.correio || <em className="empty">não informado</em>}</div>
          </div>
        </div>
      </div>

      <footer className="credencial-footer">
        <div className="credencial-assinatura">
          <div className="credencial-assinatura-nome">{profile?.nome_completo || '—'}</div>
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
  );
}
