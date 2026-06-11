# Docker + Lightsail Container deployment targets.

# Lightsail configuration (override via parent Makefile or command line)
LIGHTSAIL_SERVICE ?= scion-chargen
LIGHTSAIL_POWER   ?= nano

build: ## Build the Docker image
	@echo "$(GREEN)Building Docker image: $(APP_NAME):$(IMAGE_TAG)$(NC)"
	@echo "  Site asset version (header upper-right): $(ASSET_VERSION)"
	docker build --build-arg ASSET_VERSION=$(ASSET_VERSION) -t $(APP_NAME):$(IMAGE_TAG) -f $(DOCKERFILE) $(DOCKER_BUILD_CONTEXT)
	@echo "$(GREEN)Docker image built successfully$(NC)"
	@echo "  Site asset version (header upper-right): $(ASSET_VERSION)"

build-no-cache: ## Build the Docker image without cache
	@echo "$(GREEN)Building Docker image (no cache): $(APP_NAME):$(IMAGE_TAG)$(NC)"
	@echo "  Site asset version (header upper-right): $(ASSET_VERSION)"
	docker build --no-cache --build-arg ASSET_VERSION=$(ASSET_VERSION) -t $(APP_NAME):$(IMAGE_TAG) -f $(DOCKERFILE) $(DOCKER_BUILD_CONTEXT)
	@echo "$(GREEN)Docker image built successfully$(NC)"
	@echo "  Site asset version (header upper-right): $(ASSET_VERSION)"

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

ls-deploy: ## Deploy latest pushed image to Lightsail
	@echo "$(GREEN)Deploying to Lightsail service $(LIGHTSAIL_SERVICE)...$(NC)"
	@echo "  Site asset version (header upper-right): $(ASSET_VERSION)"
	$(eval LATEST_IMAGE := $(shell aws lightsail get-container-images --service-name $(LIGHTSAIL_SERVICE) --region $(AWS_REGION) --query 'containerImages[0].image' --output text))
	@echo "  Lightsail image: $(LATEST_IMAGE)"
	aws lightsail create-container-service-deployment \
		--service-name $(LIGHTSAIL_SERVICE) \
		--region $(AWS_REGION) \
		--containers '{"app": {"image": "$(LATEST_IMAGE)", "ports": {"8000": "HTTP"}, "environment": {"PORT": "8000"}}}' \
		--public-endpoint '{"containerName": "app", "containerPort": 8000, "healthCheck": {"path": "/", "intervalSeconds": 30, "timeoutSeconds": 5, "unhealthyThreshold": 3, "healthyThreshold": 2, "successCodes": "200"}}' \
		--no-cli-pager
	@echo "$(GREEN)Deployment created. Run 'make ls-status' to monitor.$(NC)"

deploy: ## Build, push, and deploy to Lightsail (full workflow)
	@echo "$(GREEN)=== Full deploy: build → push → deploy ===$(NC)"
	@echo "  Site asset version (header upper-right): $(ASSET_VERSION)"
	$(MAKE) build
	$(MAKE) ls-push
	$(MAKE) ls-deploy
	@echo "$(GREEN)=== Deploy complete! Run 'make ls-status' to monitor. ===$(NC)"
	@echo "  Verify live site header shows version: $(ASSET_VERSION)"

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


