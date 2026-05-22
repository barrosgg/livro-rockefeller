/* Catálogo de avatares (personagens RDR2). O arquivo de imagem fica em
   /public/avatars/<slug>.png. Se não existir, mostramos um fallback
   (círculo colorido com inicial). */

export const AVATARS = [
  { slug: 'arthur',     nome: 'Arthur Morgan',     genero: 'm' },
  { slug: 'john',       nome: 'John Marston',      genero: 'm' },
  { slug: 'dutch',      nome: 'Dutch van der Linde', genero: 'm' },
  { slug: 'hosea',      nome: 'Hosea Matthews',    genero: 'm' },
  { slug: 'charles',    nome: 'Charles Smith',     genero: 'm' },
  { slug: 'bill',       nome: 'Bill Williamson',   genero: 'm' },
  { slug: 'micah',      nome: 'Micah Bell',        genero: 'm' },
  { slug: 'javier',     nome: 'Javier Escuella',   genero: 'm' },
  { slug: 'lenny',      nome: 'Lenny Summers',     genero: 'm' },
  { slug: 'sean',       nome: 'Sean MacGuire',     genero: 'm' },
  { slug: 'uncle',      nome: 'Uncle',             genero: 'm' },
  { slug: 'sadie',      nome: 'Sadie Adler',       genero: 'f' },
  { slug: 'abigail',    nome: 'Abigail Roberts',   genero: 'f' },
  { slug: 'mary-beth',  nome: 'Mary-Beth Gaskill', genero: 'f' },
  { slug: 'karen',      nome: 'Karen Jones',       genero: 'f' },
  { slug: 'molly',      nome: 'Molly O\'Shea',     genero: 'f' },
];

export function avatarUrl(slug) {
  if (!slug) return null;
  return `/avatars/${slug}.png`;
}

export function avatarInfo(slug) {
  return AVATARS.find(a => a.slug === slug);
}

/* Paleta de cores determinística por inicial (fallback). */
const COLORS = [
  '#7a3a2a', '#5e5a2a', '#3a5e2a', '#2a5e5a', '#2a3a5e', '#5a2a5e',
  '#7a5a2a', '#2a7a3a', '#7a2a4a', '#4a2a7a', '#2a4a7a', '#7a3a5a',
];
export function colorFor(seed = '') {
  const code = String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[code % COLORS.length];
}
