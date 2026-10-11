#!/bin/sh
# Lance Coda Bureau (Linux / macOS). Nécessite Node.js : https://nodejs.org
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js est nécessaire. Installez la version LTS : https://nodejs.org"
  exit 1
fi
if [ ! -d node_modules/electron ]; then
  echo "Première installation (environ 100 Mo, une seule fois)…"
  npm install --no-fund --no-audit || exit 1
fi
exec npm start
