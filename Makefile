# Scion Character Creator — local dev, Docker image, AWS ECR/ECS deploy
# Based on magic-castle/hrmobile layout (Dockerfile under docker/, api.mk → docker.mk).
#
# AWS: region pinned to us-east-2 (exported as AWS_REGION + AWS_DEFAULT_REGION). Override: `make push AWS_REGION=…`.
#   Account 373055206579, VPC vpc-08abca3842f01b511 — Terraform/OpenTofu + aws CLI use the same region.
#
.PHONY: help info plan plan-all apply destroy destory run run-http build push login tag create-repo create-repo-deploy restart-service clean

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
PORT ?= 8000
HOST ?= 0.0.0.0
PY ?= python3
DEV_TLS_CRT := $(ROOT)/.certs/dev.crt
DEV_TLS_KEY := $(ROOT)/.certs/dev.key

APP_NAME := scion-chargen
AWS_ACCOUNT_ID ?= 373055206579
# Pin region for Makefile-driven aws/terragrunt (exported to recipe shells; override with `make AWS_REGION=…`).
AWS_REGION := us-east-2
export AWS_REGION
AWS_DEFAULT_REGION := $(AWS_REGION)
export AWS_DEFAULT_REGION
# Documented for ECS/ALB/security-group wiring (Terraform or console); not consumed by docker build.
VPC_ID ?= vpc-08abca3842f01b511

ECR_REPOSITORY := $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(APP_NAME)
IMAGE_TAG ?= latest
DOCKER_BUILD_CONTEXT := .
DOCKERFILE := docker/Dockerfile
DOCKER_PUBLISH_PORT ?= 8000
ECS_CLUSTER ?= $(APP_NAME)-cluster
ECS_SERVICE ?= $(APP_NAME)-service
# Terragrunt root (hrmobile-style layout: `terraform/` with nested terragrunt.hcl files).
TERRAFORM_DIR ?= terraform

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
	@echo ""
	@echo "$(YELLOW)Docker / AWS:$(NC)"
	@echo "  make build            — docker build ($(DOCKERFILE))"
	@echo "  make push             — tag, ECR login, push, optional ECS force deploy"
	@echo "  make create-repo      — aws ecr create-repository"
	@echo "  make create-repo-deploy — create-repo + build + push"
	@echo "  make run-docker       — run image locally on port $(DOCKER_PUBLISH_PORT)"
	@echo ""
	@echo "$(YELLOW)Infrastructure:$(NC)"
	@echo "  make plan / plan-all  — terragrunt run-all plan (set ACM + Route53 in terraform/globals.hcl)"
	@echo "  make apply            — terragrunt run-all apply"
	@echo "  make destroy          — terragrunt run-all destroy (same as: make destory)"
	@echo ""
	@echo "$(YELLOW)Defaults:$(NC) APP_NAME=$(APP_NAME) AWS_ACCOUNT_ID=$(AWS_ACCOUNT_ID) AWS_REGION=$(AWS_REGION) AWS_DEFAULT_REGION=$(AWS_DEFAULT_REGION)"
	@echo "           VPC_ID=$(VPC_ID)  ECS_CLUSTER=$(ECS_CLUSTER) ECS_SERVICE=$(ECS_SERVICE)"

info: ## Show Docker / AWS settings
	@echo "$(GREEN)Configuration$(NC)"
	@echo "  App name:        $(APP_NAME)"
	@echo "  AWS account:     $(AWS_ACCOUNT_ID)"
	@echo "  AWS region:      $(AWS_REGION) (AWS_DEFAULT_REGION=$(AWS_DEFAULT_REGION))"
	@echo "  VPC (for ECS):   $(VPC_ID)"
	@echo "  ECR repository:  $(ECR_REPOSITORY):$(IMAGE_TAG)"
	@echo "  ECS cluster:     $(ECS_CLUSTER)"
	@echo "  ECS service:     $(ECS_SERVICE)"
	@echo "  Terraform dir:   $(ROOT)/$(TERRAFORM_DIR)"

plan plan-all: ## terragrunt run-all plan for all modules under $(TERRAFORM_DIR)/
	@test -d "$(ROOT)/$(TERRAFORM_DIR)" || (echo "$(RED)No directory $(TERRAFORM_DIR)/ — add Terragrunt modules or set TERRAFORM_DIR=...$(NC)" >&2 && exit 1)
	@echo "$(GREEN)Terragrunt run-all plan in $(TERRAFORM_DIR)/$(NC)"
	cd "$(ROOT)/$(TERRAFORM_DIR)" && terragrunt run-all plan
	@echo "$(GREEN)plan completed$(NC)"

apply: ## terragrunt run-all apply for all modules under $(TERRAFORM_DIR)/
	@test -d "$(ROOT)/$(TERRAFORM_DIR)" || (echo "$(RED)No directory $(TERRAFORM_DIR)/ — add Terragrunt modules or set TERRAFORM_DIR=...$(NC)" >&2 && exit 1)
	@echo "$(YELLOW)Terragrunt run-all apply in $(TERRAFORM_DIR)/$(NC)"
	cd "$(ROOT)/$(TERRAFORM_DIR)" && terragrunt run-all apply
	@echo "$(GREEN)apply completed$(NC)"

# `destory` alias: common typo — same as destroy.
destroy destory: ## Tear down all Terragrunt-managed resources (terragrunt run-all destroy)
	@test -d "$(ROOT)/$(TERRAFORM_DIR)" || (echo "$(RED)No directory $(TERRAFORM_DIR)/ — add Terragrunt modules or set TERRAFORM_DIR=...$(NC)" >&2 && exit 1)
	@echo "$(RED)Terragrunt run-all destroy in $(TERRAFORM_DIR)/ — this removes managed AWS resources (not the existing VPC).$(NC)"
	cd "$(ROOT)/$(TERRAFORM_DIR)" && terragrunt run-all destroy
	@echo "$(GREEN)destroy completed$(NC)"

# Default: HTTPS with repo-local dev cert (src/scripts/dev_tls_cert.sh).
run run-https:
	cd "$(ROOT)" && bash src/scripts/dev_tls_cert.sh
	cd "$(ROOT)" && PYTHONPATH="$(ROOT)/src" HOST=$(HOST) PORT=$(PORT) SSL_CERTFILE=$(DEV_TLS_CRT) SSL_KEYFILE=$(DEV_TLS_KEY) $(PY) -m app

run-http:
	cd "$(ROOT)" && PYTHONPATH="$(ROOT)/src" HOST=$(HOST) PORT=$(PORT) $(PY) -m app
