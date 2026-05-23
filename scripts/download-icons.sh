#!/usr/bin/env bash
# Baixa os ícones usados pelo Livro da Fazenda Rockefeller
# de game-icons.net (CC BY 3.0). Salva em public/icons/.
#
# Apenas slugs CONFIRMADOS como existentes em game-icons.net.
# Se quiser adicionar mais, busque em https://game-icons.net e
# inclua na lista abaixo no formato <author>/<icon>.
#
# Uso: bash scripts/download-icons.sh

set -e
mkdir -p public/icons

SLUGS=(
  "lorc/horse-head"
  "lorc/wheat"
  "delapouite/carrot"
  "delapouite/cherry"
  "delapouite/coffee-beans"
  "delapouite/corn"
  "delapouite/cow"
  "delapouite/garlic"
  "delapouite/grain-bundle"
  "delapouite/orange-slice"
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
    echo "  [skip] $out"
    continue
  fi

  url="${BASE_URL}/${author}/${icon}.svg"
  echo "  [baixando] $slug"
  if curl -fsSL "$url" -o "$out"; then
    echo "             OK"
  else
    echo "             FALHOU"
    rm -f "$out"
  fi
done

echo ""
echo "Concluído. Atribuição: game-icons.net (Lorc & Delapouite, CC BY 3.0)."
