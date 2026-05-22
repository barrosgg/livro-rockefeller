import { AVATARS } from '../lib/avatars.js';
import Avatar from './Avatar.jsx';

/** Grade de avatares para seleção. */
export default function AvatarPicker({ value, onChange, size = 56 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
      gap: 10,
    }}>
      {AVATARS.map(a => {
        const sel = value === a.slug;
        return (
          <button
            key={a.slug}
            type="button"
            onClick={() => onChange(a.slug)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px',
              background: sel ? 'rgba(176,141,61,.18)' : 'transparent',
              border: `1px solid ${sel ? 'var(--gold)' : 'var(--paper-edge)'}`,
              borderRadius: 'var(--r)',
              cursor: 'pointer',
              transition: 'background .15s, border-color .15s, transform .05s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            title={a.nome}
          >
            <Avatar slug={a.slug} name={a.nome} size={size} />
            <span style={{ fontSize: '.72rem', color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.15 }}>
              {a.nome.split(' ')[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
