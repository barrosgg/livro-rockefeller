/**
 * Crest da Família Rockefeller — SVG inline.
 * Laurel wreath + monograma R em gradiente dourado.
 */
export default function Logo({ size = 40, withText = false, textColor = 'currentColor' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Família Rockefeller">
        <defs>
          <linearGradient id="rk-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e6c068" />
            <stop offset="0.55" stopColor="#c9a548" />
            <stop offset="1" stopColor="#8a6b21" />
          </linearGradient>
        </defs>

        {/* === Laurel — galho esquerdo === */}
        <g fill="url(#rk-gold)" stroke="url(#rk-gold)" strokeWidth="1">
          <path d="M 60 108 Q 18 88 22 50 Q 27 22 58 12" fill="none" strokeWidth="1.8" />
          <ellipse cx="32" cy="82" rx="6.5" ry="3" transform="rotate(-35 32 82)" />
          <ellipse cx="26" cy="68" rx="6.5" ry="3" transform="rotate(-15 26 68)" />
          <ellipse cx="23" cy="53" rx="6.5" ry="3" transform="rotate(5 23 53)" />
          <ellipse cx="26" cy="38" rx="6.5" ry="3" transform="rotate(30 26 38)" />
          <ellipse cx="34" cy="25" rx="6.5" ry="3" transform="rotate(50 34 25)" />
          <ellipse cx="46" cy="16" rx="6.5" ry="3" transform="rotate(70 46 16)" />
        </g>

        {/* === Laurel — galho direito === */}
        <g fill="url(#rk-gold)" stroke="url(#rk-gold)" strokeWidth="1">
          <path d="M 60 108 Q 102 88 98 50 Q 93 22 62 12" fill="none" strokeWidth="1.8" />
          <ellipse cx="88" cy="82" rx="6.5" ry="3" transform="rotate(35 88 82)" />
          <ellipse cx="94" cy="68" rx="6.5" ry="3" transform="rotate(15 94 68)" />
          <ellipse cx="97" cy="53" rx="6.5" ry="3" transform="rotate(-5 97 53)" />
          <ellipse cx="94" cy="38" rx="6.5" ry="3" transform="rotate(-30 94 38)" />
          <ellipse cx="86" cy="25" rx="6.5" ry="3" transform="rotate(-50 86 25)" />
          <ellipse cx="74" cy="16" rx="6.5" ry="3" transform="rotate(-70 74 16)" />
        </g>

        {/* === Nó/laço inferior === */}
        <path d="M 56 108 L 64 108 L 62 116 L 58 116 Z" fill="url(#rk-gold)" />
        <path d="M 50 110 Q 55 112 60 110" fill="none" stroke="url(#rk-gold)" strokeWidth="1.4" />
        <path d="M 60 110 Q 65 112 70 110" fill="none" stroke="url(#rk-gold)" strokeWidth="1.4" />

        {/* === Medalhão central === */}
        <circle cx="60" cy="60" r="22" fill="#fbf6e8" stroke="url(#rk-gold)" strokeWidth="2" />
        <circle cx="60" cy="60" r="18" fill="none" stroke="url(#rk-gold)" strokeWidth=".8" opacity=".6" />

        {/* === R Monograma === */}
        <text x="60" y="71" textAnchor="middle"
              fontFamily="'Playfair Display', Georgia, serif"
              fontSize="28"
              fontWeight="700"
              fill="url(#rk-gold)"
              style={{ letterSpacing: '-.02em' }}>
          R
        </text>
      </svg>

      {withText && (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, color: textColor }}>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: '1.15rem',
            letterSpacing: '-.005em',
            color: 'inherit',
          }}>
            Família Rockefeller
          </span>
          <span style={{
            fontFamily: "'Lora', serif",
            fontSize: '.7rem',
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
            marginTop: 3,
          }}>
            Caderno da Fazenda
          </span>
        </span>
      )}
    </span>
  );
}
