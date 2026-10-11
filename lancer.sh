#!/bin/sh
# Lance Coda en local sur http://localhost:8080 (Linux / macOS)
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"
URL="http://localhost:$PORT"

echo "✦ Coda démarre sur $URL  (Ctrl+C pour arrêter)"
if command -v curl >/dev/null 2>&1 && curl -s -m 2 http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "  ✓ Ollama détecté : les IA locales sont disponibles sans compte."
else
  echo "  ℹ Ollama n'est pas lancé. Pour des IA gratuites et sans compte : https://ollama.com/download"
fi

( sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v open >/dev/null 2>&1; then open "$URL"
  fi ) >/dev/null 2>&1 &

if command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then exec python -m http.server "$PORT" --bind 127.0.0.1
elif command -v npx >/dev/null 2>&1; then exec npx --yes http-server -p "$PORT" -a 127.0.0.1 -c-1 -s
else
  echo "Python ou Node.js est nécessaire : https://www.python.org/downloads/"
  exit 1
fi
