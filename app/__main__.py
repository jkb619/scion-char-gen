"""Dev server entrypoint: `python -m app` from repo root. Binds 0.0.0.0 (override with HOST).

HTTPS: set both SSL_CERTFILE and SSL_KEYFILE (PEM paths). Uvicorn terminates TLS; the app
still sees HTTP semantics. `make run` uses scripts/dev_tls_cert.sh; use `make run-http` for plain HTTP.
"""

from __future__ import annotations

import os
import sys

import uvicorn

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    cert = os.environ.get("SSL_CERTFILE", "").strip()
    key = os.environ.get("SSL_KEYFILE", "").strip()
    ssl_kwargs: dict[str, str] = {}
    if cert and key:
        ssl_kwargs["ssl_certfile"] = cert
        ssl_kwargs["ssl_keyfile"] = key
    elif cert or key:
        print(
            "error: set both SSL_CERTFILE and SSL_KEYFILE for HTTPS, or clear both for HTTP.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        **ssl_kwargs,
    )
