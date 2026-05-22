import { useState } from 'react';

const COLORS = [
  '#7a3a2a', '#5e5a2a', '#3a5e2a', '#2a5e5a', '#2a3a5e', '#5a2a5e',
  '#7a5a2a', '#2a7a3a', '#7a2a4a', '#4a2a7a', '#2a4a7a', '#7a3a5a',
];
function colorFor(seed = '') {
  const code = String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[code % COLORS.length];
}

/** Avatar circular.
 *  - `slug` aceita uma URL completa (http://... ou https://...) OU um identificador.
 *  - Se for URL → usa direto. Se for identificador local → tenta /avatars/<id>.png.
 *  - Se a imagem falhar (404, broken link, vazio) → mostra inicial sobre círculo colorido.
 */
export default function Avatar({ slug, name, size = 36, title }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || slug || '?').trim()[0]?.toUpperCase() || '?';
  const tooltip = title || name || slug;

  let url = null;
  if (slug) {
    if (/^https?:\/\//i.test(slug)) url = slug;          // URL completa
    else url = `/avatars/${slug}.png`;                   // identificador local (legado)
  }

  if (!url || failed) {
    return (
      <span
        title={tooltip}
        style={{
          width: size, height: size, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: colorFor(slug || name || ''),
          color: '#fdf4e3',
          fontFamily: "'Playfair Display', serif",
          fontWeight: 600,
          fontSize: size * 0.42,
          border: '1px solid rgba(0,0,0,.1)',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.18)',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={tooltip}
      title={tooltip}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      style={{
        width: size, height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid var(--paper-edge)',
        background: '#fff',
        flexShrink: 0,
      }}
    />
  );
}
