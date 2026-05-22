import { useState } from 'react';

/**
 * Renderiza o ícone de um produto.
 * - Slug no formato '<author>/<icon-name>' (ex: 'lorc/wheat').
 * - Arquivos servidos de /public/icons/<author>__<icon-name>.svg
 * - Se o SVG falhar, mostra um quadradinho com a inicial do nome.
 *
 * Os SVGs do game-icons.net são pretos sobre transparente — fica
 * naturalmente no clima vintage do tema (sépia sobre cream).
 */
export default function ProductIcon({ slug, name, size = 22 }) {
  const [failed, setFailed] = useState(false);
  const safe = slug ? slug.replace('/', '__') : null;
  const url = safe ? `/icons/${safe}.svg` : null;

  if (!url || failed) {
    const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
    return (
      <span
        title={name}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size,
          borderRadius: 3,
          background: 'transparent',
          border: '1px solid var(--paper-edge)',
          color: 'var(--ink-mute)',
          fontSize: size * 0.55,
          fontFamily: "'Playfair Display', serif",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={name || slug}
      title={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        width: size, height: size,
        display: 'inline-block',
        opacity: 0.82,
        flexShrink: 0,
      }}
    />
  );
}
