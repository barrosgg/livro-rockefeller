#!/usr/bin/env bash
# Baixa todos os ícones usados pelo Caderno da Fazenda Rockefeller
# de game-icons.net (CC BY 3.0). Salva em public/icons/.
#
# Uso: bash scripts/download-icons.sh

set -e
mkdir -p public/icons

# Lista de slugs no formato <author>/<icon> usados nos produtos
SLUGS=(
  "lorc/apple"
  "lorc/banana"
  "lorc/cotton-flower"
  "lorc/dung-pile"
  "lorc/egg"
  "lorc/herbs-bundle"
  "lorc/horse-head"
  "lorc/sack"
  "lorc/sugar-cane"
  "lorc/wheat"
  "delapouite/carrot"
  "delapouite/cheese-wedge"
  "delapouite/cherry"
  "delapouite/coffee-beans"
  "delapouite/corn"
  "delapouite/cow"
  "delapouite/garlic"
  "delapouite/grain-bundle"
  "delapouite/milk-carton"
  "delapouite/mint-leaf"
  "delapouite/orange-slice"
  "delapouite/pig"
  "delapouite/potato"
  "delapouite/sheep"
  "delapouite/strawberry"
)

BASE_URL="https://game-icons.net/icons/000000/transparent/1x1"

for slug in "${SLUGS[@]}"; do
  author="${slug%/*}"
  icon="${slug##*/}"
  out="public/icons/${author}__${icon}.svg"

  if [ -f "$out" ]; then
    echo "  [skip] $out (já existe)"
    continue
  fi

  url="${BASE_URL}/${author}/${icon}.svg"
  echo "  [baixando] $slug -> $out"
  if curl -fsSL "$url" -o "$out"; then
    echo "             OK"
  else
    echo "             FALHOU (ícone não existe — fallback automatico)"
    rm -f "$out"
  fi
done

echo ""
echo "Concluído. ${#SLUGS[@]} ícones processados em public/icons/."
echo "Atribuição: game-icons.net (autores: Lorc & Delapouite, CC BY 3.0)."
