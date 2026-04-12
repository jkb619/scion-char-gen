#!/usr/bin/env bash
# Dev TLS material for `make run`. Prefers mkcert (locally trusted CA); else openssl self-signed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/.certs"
KEY="$CERT_DIR/dev.key"
CRT="$CERT_DIR/dev.crt"
mkdir -p "$CERT_DIR"

if [[ -f "$KEY" && -f "$CRT" && -z "${FORCE_TLS_REGEN:-}" ]]; then
  echo "TLS files already present: $CRT"
  echo "To switch to mkcert: install mkcert, run mkcert -install, remove .certs/, then make run again."
  exit 0
fi

rm -f "$KEY" "$CRT"

if command -v mkcert >/dev/null 2>&1; then
  if mkcert -key-file "$KEY" -cert-file "$CRT" localhost 127.0.0.1 ::1 2>/dev/null \
    || mkcert -key-file "$KEY" -cert-file "$CRT" localhost 127.0.0.1; then
    echo "Wrote $KEY and $CRT (mkcert — trusted in browsers on this machine after mkcert -install)."
    exit 0
  fi
  echo "mkcert failed (often fixed with: mkcert -install). Falling back to openssl." >&2
  rm -f "$KEY" "$CRT"
fi

if ! openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY" -out "$CRT" -days 825 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null; then
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" -out "$CRT" -days 825 \
    -subj "/CN=localhost"
fi
echo "Wrote $KEY and $CRT (openssl self-signed)."
echo "" >&2
echo "Browsers show \"Not secure\" for self-signed certs — that is normal for this fallback." >&2
echo "For a green lock locally: install mkcert (https://github.com/FiloSottile/mkcert), run mkcert -install," >&2
echo "remove the .certs/ directory, then make run again. Or use: make run-http" >&2
