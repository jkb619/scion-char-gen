# Scion Character Creator — local dev, Docker image, AWS Lightsail deploy
# Based on magic-castle/hrmobile layout (Dockerfile under docker/, api.mk → docker.mk).
#
# AWS: region pinned to us-east-2 (exported as AWS_REGION + AWS_DEFAULT_REGION). Override: `make deploy AWS_REGION=…`.
#
.PHONY: help info run run-https run-http build build-no-cache run-docker stop-docker clean deploy ls-push ls-deploy ls-status ls-logs disable enable plan apply destroy sync-llm-keys run-with-llm

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
PORT ?= 8000
HOST ?= 0.0.0.0
PY ?= python3
DEV_TLS_CRT := $(ROOT)/.certs/dev.crt
DEV_TLS_KEY := $(ROOT)/.certs/dev.key

APP_NAME := scion-chargen
AWS_ACCOUNT_ID ?= 373055206579
# Pin region for Makefile-driven aws CLI (exported to recipe shells; override with `make AWS_REGION=…`).
AWS_REGION := us-east-2
export AWS_REGION
AWS_DEFAULT_REGION := $(AWS_REGION)
export AWS_DEFAULT_REGION

IMAGE_TAG ?= latest
DOCKER_BUILD_CONTEXT := .
DOCKERFILE := docker/Dockerfile
DOCKER_PUBLISH_PORT ?= 8000

LIGHTSAIL_SERVICE := scion-chargen
LIGHTSAIL_POWER := nano

GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

include docker.mk

help: ## Show targets
	@echo "$(GREEN)Scion Character Creator$(NC)"
	@echo ""
	@echo "$(YELLOW)Local (no Docker):$(NC)"
	@echo "  make run / run-https  — uvicorn dev server (see src/app/__main__.py)"
	@echo "  make run-with-llm     — run with SOPS-decrypted secrets/llm-keys.yaml"
	@echo "                        (or use secrets/llm-keys.local.yaml — loaded on make run)"
	@echo ""
	@echo "$(YELLOW)Docker:$(NC)"
	@echo "  make build            — docker build ($(DOCKERFILE))"
	@echo "  make build-no-cache   — docker build without cache"
	@echo "  make run-docker       — run image locally on port $(DOCKER_PUBLISH_PORT)"
	@echo "  make stop-docker      — stop local container"
	@echo "  make clean            — remove local image tag"
	@echo ""
	@echo "$(YELLOW)Lightsail Deploy:$(NC)"
	@echo "  make deploy           — build + push + sync LLM keys + deploy"
	@echo "  make sync-llm-keys    — push SOPS LLM keys to AWS SSM only"
	@echo "  make ls-push          — push image to Lightsail"
	@echo "  make ls-deploy        — deploy latest image (reads SSM llm-env into container)"
	@echo "  make ls-status        — show current deployment state"
	@echo "  make ls-logs          — fetch container logs"
	@echo "  make disable          — stop containers (503; Lightsail service still billed)"
	@echo "  make enable           — turn containers back on after disable"
	@echo ""
	@echo "$(YELLOW)Teardown:$(NC)"
	@echo "  make destroy          — terragrunt destroy (Lightsail, DNS, cert, SSM — stops billing)"
	@echo ""
	@echo "$(YELLOW)Terraform:$(NC)"
	@echo "  make plan             — terragrunt run-all plan"
	@echo "  make apply            — terragrunt run-all apply"
	@echo ""
	@echo "$(YELLOW)Defaults:$(NC) APP_NAME=$(APP_NAME) AWS_REGION=$(AWS_REGION) LIGHTSAIL_SERVICE=$(LIGHTSAIL_SERVICE) LIGHTSAIL_POWER=$(LIGHTSAIL_POWER)"

info: ## Show Docker / AWS settings
	@echo "$(GREEN)Configuration$(NC)"
	@echo "  App name:          $(APP_NAME)"
	@echo "  Header version:    Lightsail image rev (e.g. 45) — set at deploy, shown upper-right"
	@echo "  AWS account:       $(AWS_ACCOUNT_ID)"
	@echo "  AWS region:        $(AWS_REGION)"
	@echo "  Lightsail service: $(LIGHTSAIL_SERVICE)"
	@echo "  Lightsail power:   $(LIGHTSAIL_POWER)"
	@echo "  Docker image:      $(APP_NAME):$(IMAGE_TAG)"
	@echo "  Dockerfile:        $(DOCKERFILE)"

plan: ## Run terragrunt plan for all modules
	cd terraform && terragrunt run-all plan

apply: ## Run terragrunt apply for all modules
	cd terraform && terragrunt run-all apply

destroy: ## Destroy all Terraform-managed AWS infrastructure (stops Lightsail billing)
	@echo "$(RED)=== destroy: terragrunt run-all destroy ===$(NC)"
	@echo "$(RED)Removes Lightsail service, certificate, Route53 records, SSM params, etc.$(NC)"
	cd terraform && terragrunt run-all destroy

# Default: HTTPS with repo-local dev cert (src/scripts/dev_tls_cert.sh).
run run-https:
	cd "$(ROOT)" && bash src/scripts/dev_tls_cert.sh
	cd "$(ROOT)" && PYTHONPATH="$(ROOT)/src" HOST=$(HOST) PORT=$(PORT) SSL_CERTFILE=$(DEV_TLS_CRT) SSL_KEYFILE=$(DEV_TLS_KEY) $(PY) -m app

run-http:
	cd "$(ROOT)" && PYTHONPATH="$(ROOT)/src" HOST=$(HOST) PORT=$(PORT) $(PY) -m app

run-with-llm: ## Run dev server with LLM keys from SOPS (secrets/llm-keys.yaml)
	cd "$(ROOT)" && sops exec-env secrets/llm-keys.yaml 'PYTHONPATH="$(ROOT)/src" HOST=$(HOST) PORT=$(PORT) $(PY) -m app'

sync-llm-keys: ## Push LLM keys from SOPS to AWS SSM (/scion-chargen/production/llm-env)
	"$(ROOT)/scripts/sync-llm-keys-to-ssm.sh"
