.PHONY: run run-http run-https

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
PORT ?= 8000
HOST ?= 0.0.0.0
PY ?= python3
DEV_TLS_CRT := $(ROOT)/.certs/dev.crt
DEV_TLS_KEY := $(ROOT)/.certs/dev.key

# Default: HTTPS with repo-local dev cert (scripts/dev_tls_cert.sh).
run run-https:
	cd "$(ROOT)" && bash scripts/dev_tls_cert.sh
	cd "$(ROOT)" && HOST=$(HOST) PORT=$(PORT) SSL_CERTFILE=$(DEV_TLS_CRT) SSL_KEYFILE=$(DEV_TLS_KEY) $(PY) -m app

run-http:
	cd "$(ROOT)" && HOST=$(HOST) PORT=$(PORT) $(PY) -m app
