import { useState } from 'react';
import { avatarUrl, colorFor } from '../lib/avatars.js';

/** Avatar circular. Se a imagem não carregar, exibe iniciais sobre círculo colorido. */
export default function Avatar({ slug, name, size = 36, title }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || slug || '?').trim()[0]?.toUpperCase() || '?';
  const url = avatarUrl(slug);
  const tooltip = title || name || slug;

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
