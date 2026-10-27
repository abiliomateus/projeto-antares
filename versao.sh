#!/bin/bash
set -e

# Tag de versão a ser criada
TAG="1.0.1"

# Cria a tag se ela ainda não existir
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    echo "Tag $TAG já existe; ignorando."
else
    git tag "$TAG"
    echo "Tag $TAG criada."
fi

# Obtém a versão e o hash do commit
VERSAO=$(git describe --tags --always 2>/dev/null)
COMMIT=$(git rev-parse --short HEAD)

# Gera o arquivo JavaScript
cat > js/version.js <<EOF
document.getElementById('versao').textContent =
  'Versão ${VERSAO} (${COMMIT})';
EOF

echo "Versão gerada: $VERSAO ($COMMIT)"