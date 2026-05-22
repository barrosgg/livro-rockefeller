/**
 * Medalha circular tipo "fita de mérito" — discreta, sem texto.
 * Tier define a cor (gold/silver/bronze) com gradiente metálico,
 * symbol é o caractere unicode no centro.
 */
export default function Medal({ tier = 'gold', symbol = '★', size = 30, title }) {
  const gradId = `medal-${tier}-${Math.random().toString(36).slice(2, 7)}`;
  const stops = STOPS[tier] || STOPS.gold;

  return (
    <span
      className={`medal medal-${tier}`}
      title={title}
      aria-label={title}
      role="img"
      style={{ width: size, height: size, display: 'inline-block' }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="32%" r="65%">
            <stop offset="0%"   stopColor={stops[0]} />
            <stop offset="55%"  stopColor={stops[1]} />
            <stop offset="100%" stopColor={stops[2]} />
          </radialGradient>
        </defs>
        {/* corpo da medalha */}
        <circle cx="20" cy="20" r="18" fill={`url(#${gradId})`}
                stroke={stops[2]} strokeWidth="1.2" />
        {/* anel interno */}
        <circle cx="20" cy="20" r="14" fill="none"
                stroke={stops[2]} strokeWidth="0.6" opacity="0.45" />
        {/* brilho superior */}
        <ellipse cx="20" cy="14" rx="9" ry="4" fill="#ffffff" opacity="0.32" />
        {/* simbolo central */}
        <text x="20" y="26" textAnchor="middle"
              fontFamily="'Playfair Display', Georgia, serif"
              fontSize="15" fontWeight="700"
              fill={stops[3]}
              style={{ filter: 'drop-shadow(0 1px 0 rgba(255,255,255,.25))' }}>
          {symbol}
        </text>
      </svg>
    </span>
  );
}

// [topo claro, meio, escuro (borda), cor do símbolo]
const STOPS = {
  gold:   ['#fff1be', '#d4ab4d', '#7a5810', '#3d2a05'],
  silver: ['#f5f5f5', '#bdbdbd', '#666666', '#1f1f1f'],
  bronze: ['#f4ceaa', '#b8814f', '#683f1c', '#341e09'],
};
