#!/usr/bin/env bash
# Testa múltiplos slugs candidatos por produto em game-icons.net.
# Para cada produto, usa o primeiro slug que existe (HTTP 200).
# Baixa o SVG em public/icons/ e gera um update.sql com os slugs que pegaram.
#
# Uso: bash scripts/discover-icons.sh

mkdir -p public/icons
BASE="https://game-icons.net/icons/000000/transparent/1x1"
SQL_OUT="scripts/icons-discovered.sql"

echo "-- SQL gerado por discover-icons.sh" > "$SQL_OUT"
echo "-- Slugs descobertos automaticamente em $(date)" >> "$SQL_OUT"
echo "" >> "$SQL_OUT"

# Função: tenta cada slug; usa o primeiro que existir.
try_slugs() {
  local produto="$1"; shift
  local candidates=("$@")

  echo "  $produto"
  for slug in "${candidates[@]}"; do
    local author="${slug%/*}"
    local icon="${slug##*/}"
    local url="${BASE}/${author}/${icon}.svg"
    local out="public/icons/${author}__${icon}.svg"

    # Já baixado?
    if [ -f "$out" ]; then
      echo "    -> $slug (já baixado)"
      printf "update products set icon = '%s' where nome = '%s';\n" \
        "$slug" "${produto//\'/\'\'}" >> "$SQL_OUT"
      return 0
    fi

    # Testa existência
    if curl -fsSL "$url" -o "$out" 2>/dev/null; then
      echo "    -> $slug ✓"
      printf "update products set icon = '%s' where nome = '%s';\n" \
        "$slug" "${produto//\'/\'\'}" >> "$SQL_OUT"
      return 0
    else
      rm -f "$out"
    fi
  done
  echo "    -> nenhum candidato funcionou (fallback inicial)"
  return 1
}

echo "Descobrindo ícones para produtos sem mapeamento..."
echo ""

try_slugs "Ovo" \
  "delapouite/sunny-side-up" "delapouite/chicken-leg" "delapouite/eggshell" \
  "lorc/cracked-egg" "delapouite/egg-clutch" "delapouite/chicken-oven" "delapouite/chicken"

try_slugs "Leite" \
  "delapouite/milk-bottle" "delapouite/glass-of-milk" \
  "lorc/milk-carton" "lorc/spilling-bottle" "delapouite/water-bottle" \
  "delapouite/baby-bottle" "delapouite/jug" "lorc/water-drop" \
  "delapouite/round-bottom-flask" "delapouite/glass-shot" "lorc/wooden-mug"

try_slugs "Leite de Cabra" \
  "delapouite/goat" "lorc/goat" "delapouite/goat-head" "lorc/goat-head" \
  "delapouite/milk-bottle" "lorc/spilling-bottle" "lorc/wooden-mug" \
  "delapouite/round-bottom-flask"

try_slugs "Coalhada" \
  "delapouite/milk-bottle" "delapouite/glass-of-milk" \
  "lorc/jar" "delapouite/canned-food" "delapouite/jug" \
  "lorc/wooden-mug" "delapouite/round-bottom-flask"

try_slugs "Queijo" \
  "delapouite/cheese-slice" "lorc/cheese-wedge" "delapouite/wedge-stoneworks"

try_slugs "Queijo de Cabra" \
  "delapouite/cheese-slice" "lorc/cheese-wedge"

try_slugs "Ricota" \
  "delapouite/cheese-slice" "lorc/cheese-wedge"

try_slugs "Requeijão" \
  "delapouite/cheese-slice" "lorc/cheese-wedge"

try_slugs "Manteiga" \
  "delapouite/butter" "delapouite/cheese-slice" "delapouite/sliced-bread"

try_slugs "Hortelã" \
  "delapouite/three-leaves" "delapouite/oak-leaf" "lorc/leaf-iron" "delapouite/lotus"

try_slugs "Tomilho" \
  "delapouite/three-leaves" "delapouite/oak-leaf" "lorc/leaf-iron"

try_slugs "Orégano" \
  "delapouite/three-leaves" "delapouite/oak-leaf" "lorc/leaf-iron"

try_slugs "Açúcar" \
  "delapouite/sugar-cube" "delapouite/sugar" "lorc/cubes"

try_slugs "Tabaco" \
  "delapouite/pipe" "delapouite/peace-pipe" "delapouite/smoking-pipe" \
  "delapouite/cigar" "delapouite/cigarette"

try_slugs "Fertilizante" \
  "delapouite/dung" "lorc/dung" "lorc/wooden-crate" "delapouite/wooden-crate"

try_slugs "Giseng Americano" \
  "delapouite/ginseng" "lorc/ginseng" "delapouite/lotus-flower" "delapouite/yarn"

try_slugs "Giseng-do-Alaska" \
  "delapouite/ginseng" "lorc/ginseng" "delapouite/lotus-flower" \
  "delapouite/yarn" "lorc/branch-arrow" "delapouite/snowing" \
  "delapouite/snowflake-1" "lorc/medicines"

try_slugs "Maçã" \
  "delapouite/apple" "lorc/apple" "delapouite/apple-core"

try_slugs "Banana" \
  "delapouite/banana" "lorc/banana" "delapouite/banana-peeled"

try_slugs "Pêssego" \
  "delapouite/peach" "delapouite/apricot"

try_slugs "Carne de Porco" \
  "delapouite/pork" "delapouite/sausage" "lorc/sausages" "delapouite/wild-boar" "delapouite/pig"

try_slugs "Carne de Vaca" \
  "delapouite/meat-cleaver" "lorc/meat" "delapouite/steak" "delapouite/cow"

try_slugs "Cana-de-açúcar" \
  "lorc/sugar-cane" "delapouite/sugar-cane" "lorc/wheat"

try_slugs "Algodão" \
  "lorc/cotton-flower" "delapouite/cotton-flower" "delapouite/wool"

try_slugs "Lúpulo" \
  "delapouite/hops" "lorc/hops" "delapouite/wheat" "delapouite/grain-bundle"

# Sacos: tenta vários candidatos e aplica a TODOS os "Saco de X"
echo "  Sacos (Saco de %)"
for slug in "lorc/sack" "delapouite/swap-bag" "lorc/swap-bag" "delapouite/sack" "lorc/jute-bag" "delapouite/grain-bundle"; do
  author="${slug%/*}"
  icon="${slug##*/}"
  url="${BASE}/${author}/${icon}.svg"
  out="public/icons/${author}__${icon}.svg"
  if [ -f "$out" ] || curl -fsSL "$url" -o "$out" 2>/dev/null; then
    echo "    -> $slug ✓ (aplicando a todos os 'Saco de %')"
    printf "update products set icon = '%s' where nome like 'Saco de %%';\n" "$slug" >> "$SQL_OUT"
    break
  else
    rm -f "$out"
  fi
done

echo ""
echo "Concluído. SQL gerado em: $SQL_OUT"
echo "Para aplicar: copie o conteúdo de $SQL_OUT e rode no Supabase SQL Editor."
