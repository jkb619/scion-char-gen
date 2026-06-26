# Docker + Lightsail Container deployment targets.

# Lightsail configuration (override via parent Makefile or command line)
LIGHTSAIL_SERVICE ?= scion-chargen
LIGHTSAIL_POWER   ?= nano

build: ## Build the Docker image
	@echo "$(GREEN)Building Docker image: $(APP_NAME):$(IMAGE_TAG)$(NC)"
	docker build -t $(APP_NAME):$(IMAGE_TAG) -f $(DOCKERFILE) $(DOCKER_BUILD_CONTEXT)
	@echo "$(GREEN)Docker image built successfully$(NC)"

build-no-cache: ## Build the Docker image without cache
	@echo "$(GREEN)Building Docker image (no cache): $(APP_NAME):$(IMAGE_TAG)$(NC)"
	docker build --no-cache -t $(APP_NAME):$(IMAGE_TAG) -f $(DOCKERFILE) $(DOCKER_BUILD_CONTEXT)
	@echo "$(GREEN)Docker image built successfully$(NC)"

run-docker: ## Run the container locally (foreground, rm on exit)
	@echo "$(GREEN)Running $(APP_NAME):$(IMAGE_TAG) on http://localhost:$(DOCKER_PUBLISH_PORT)$(NC)"
	docker run --rm -p $(DOCKER_PUBLISH_PORT):8000 --name $(APP_NAME)-run $(APP_NAME):$(IMAGE_TAG)

stop-docker: ## Stop local container started with a fixed name (if any)
	-docker stop $(APP_NAME)-container 2>/dev/null || true
	-docker rm $(APP_NAME)-container 2>/dev/null || true

clean: ## Remove local image tag
	-docker rmi $(APP_NAME):$(IMAGE_TAG) 2>/dev/null || true

ls-push: ## Push Docker image to Lightsail
	@echo "$(GREEN)Pushing $(APP_NAME):$(IMAGE_TAG) to Lightsail service $(LIGHTSAIL_SERVICE)$(NC)"
	aws lightsail push-container-image \
		--service-name $(LIGHTSAIL_SERVICE) \
		--label app \
		--image $(APP_NAME):$(IMAGE_TAG) \
		--region $(AWS_REGION)
	@LATEST_IMAGE=$$(aws lightsail get-container-images \
		--service-name $(LIGHTSAIL_SERVICE) \
		--region $(AWS_REGION) \
		--query 'containerImages[0].image' \
		--output text); \
	IMAGE_VERSION=$$(echo "$$LATEST_IMAGE" | sed -E 's/.*\.app\.([0-9]+).*/\1/'); \
	echo "  Lightsail image: $$LATEST_IMAGE"; \
	echo "  Header version (upper-right after deploy): $$IMAGE_VERSION"

ls-deploy: ## Deploy latest pushed image to Lightsail
	@echo "$(GREEN)Deploying to Lightsail service $(LIGHTSAIL_SERVICE)...$(NC)"
	@LATEST_IMAGE=$$(aws lightsail get-container-images \
		--service-name $(LIGHTSAIL_SERVICE) \
		--region $(AWS_REGION) \
		--query 'containerImages[0].image' \
		--output text); \
	IMAGE_VERSION=$$(echo "$$LATEST_IMAGE" | sed -E 's/.*\.app\.([0-9]+).*/\1/'); \
	echo "  Lightsail image: $$LATEST_IMAGE"; \
	echo "  Header version (upper-right): $$IMAGE_VERSION"; \
	if [ -z "$$IMAGE_VERSION" ] || [ "$$IMAGE_VERSION" = "$$LATEST_IMAGE" ]; then \
		echo "$(RED)Could not parse Lightsail image version from: $$LATEST_IMAGE$(NC)"; \
		exit 1; \
	fi; \
	LLM_ENV_JSON=$$(aws ssm get-parameter \
		--name /scion-chargen/production/llm-env \
		--with-decryption \
		--region $(AWS_REGION) \
		--query Parameter.Value \
		--output text 2>/dev/null || echo ""); \
	CONTAINER_ENV=$$(IMAGE_VERSION="$$IMAGE_VERSION" LLM_ENV_JSON="$$LLM_ENV_JSON" python3 -c 'import json,os; base={"PORT":"8000","ASSET_VERSION":os.environ["IMAGE_VERSION"]}; raw=os.environ.get("LLM_ENV_JSON","").strip(); base.update(json.loads(raw) if raw else {}); print(json.dumps(base))'); \
	if [ -z "$$CONTAINER_ENV" ]; then \
		echo "$(RED)Failed to build container environment JSON$(NC)"; \
		exit 1; \
	fi; \
	aws lightsail create-container-service-deployment \
		--service-name $(LIGHTSAIL_SERVICE) \
		--region $(AWS_REGION) \
		--containers "$$(printf '%s' "{\"app\": {\"image\": \"$$LATEST_IMAGE\", \"ports\": {\"8000\": \"HTTP\"}, \"environment\": $$CONTAINER_ENV}}")" \
		--public-endpoint '{"containerName": "app", "containerPort": 8000, "healthCheck": {"path": "/", "intervalSeconds": 30, "timeoutSeconds": 5, "unhealthyThreshold": 3, "healthyThreshold": 2, "successCodes": "200"}}' \
		--no-cli-pager; \
	echo "$(GREEN)Deployment created. Run 'make ls-status' to monitor.$(NC)"; \
	echo "  Verify live site header shows version: $$IMAGE_VERSION"

deploy: ## Build, push, and deploy to Lightsail (full workflow)
	@echo "$(GREEN)=== Full deploy: build → push → deploy ===$(NC)"
	$(MAKE) build
	$(MAKE) ls-push
	$(MAKE) ls-deploy

ls-status: ## Show Lightsail service status and URL
	aws lightsail get-container-services \
		--service-name $(LIGHTSAIL_SERVICE) \
		--region $(AWS_REGION) \
		--no-cli-pager

ls-logs: ## Fetch Lightsail container logs
	aws lightsail get-container-log \
		--service-name $(LIGHTSAIL_SERVICE) \
		--container-name app \
		--region $(AWS_REGION) \
		--no-cli-pager

