#!/usr/bin/env bash
# Publica concepmi-vi/ en GitHub Pages (rama gh-pages) SIN borrar lo que ya esté allí.
# Uso (desde la carpeta PAGINA WEB, después de hacer commit y push de main):
#   bash herramientas/publicar.sh "Mensaje del cambio"
set -e
msg="${1:-Actualizar página}"
wt="$(mktemp -d)"
git fetch -q origin gh-pages
git worktree add -q --detach "$wt" origin/gh-pages
git archive HEAD:concepmi-vi | tar -x -C "$wt"
cd "$wt"
git add -A
if git diff --cached --quiet; then echo "Nada nuevo que publicar"; else
  git commit -q -m "$msg" && git push -q origin HEAD:gh-pages && echo "Publicado: https://andyferaldo.github.io/concepmi-vi/"
fi
cd - >/dev/null
git worktree remove --force "$wt"
