# Docker + ECR + ECS (adapted from magic-castle/hrmobile api.mk; names → scion-chargen).

build: ## Build the Docker image
	@echo "$(GREEN)Building Docker image: $(APP_NAME):$(IMAGE_TAG)$(NC)"
	docker build -t $(APP_NAME):$(IMAGE_TAG) -f $(DOCKERFILE) $(DOCKER_BUILD_CONTEXT)
	@echo "$(GREEN)Docker image built successfully$(NC)"

build-no-cache: ## Build the Docker image without cache
	@echo "$(GREEN)Building Docker image (no cache): $(APP_NAME):$(IMAGE_TAG)$(NC)"
	docker build --no-cache -t $(APP_NAME):$(IMAGE_TAG) -f $(DOCKERFILE) $(DOCKER_BUILD_CONTEXT)
	@echo "$(GREEN)Docker image built successfully$(NC)"

tag: ## Tag the image for ECR
	@echo "$(GREEN)Tagging image for ECR: $(ECR_REPOSITORY):$(IMAGE_TAG)$(NC)"
	docker tag $(APP_NAME):$(IMAGE_TAG) $(ECR_REPOSITORY):$(IMAGE_TAG)
	@echo "$(GREEN)Image tagged successfully$(NC)"

login: ## Login to AWS ECR
	@echo "$(GREEN)Logging in to AWS ECR$(NC)"
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
	@echo "$(GREEN)Logged in to ECR successfully$(NC)"

push: tag login ## Push the image to ECR (then optional ECS rolling deploy)
	@echo "$(GREEN)Pushing image to ECR: $(ECR_REPOSITORY):$(IMAGE_TAG)$(NC)"
	docker push $(ECR_REPOSITORY):$(IMAGE_TAG)
	@echo "$(GREEN)Image pushed successfully$(NC)"
	@echo "$(YELLOW)Checking ECS service for rolling deploy…$(NC)"
	@if aws ecs describe-clusters --clusters "$(ECS_CLUSTER)" --region "$(AWS_REGION)" --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then \
		aws ecs update-service --cluster "$(ECS_CLUSTER)" --service "$(ECS_SERVICE)" --force-new-deployment --region "$(AWS_REGION)" --query 'service.serviceName' --output text && \
		echo "$(GREEN)ECS service update triggered$(NC)"; \
	else \
		echo "$(YELLOW)ECS cluster '$(ECS_CLUSTER)' not active or missing — skipped. Push finished.$(NC)"; \
	fi

restart-service: ## Force new ECS deployment (no rebuild)
	@if aws ecs describe-clusters --clusters "$(ECS_CLUSTER)" --region "$(AWS_REGION)" --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then \
		aws ecs update-service --cluster "$(ECS_CLUSTER)" --service "$(ECS_SERVICE)" --force-new-deployment --region "$(AWS_REGION)" --query 'service.serviceName' --output text && \
		echo "$(GREEN)ECS service update triggered$(NC)"; \
	else \
		echo "$(RED)Error: ECS cluster '$(ECS_CLUSTER)' not found or not active.$(NC)"; \
		exit 1; \
	fi

run-docker: ## Run the container locally (foreground, rm on exit)
	@echo "$(GREEN)Running $(APP_NAME):$(IMAGE_TAG) on http://localhost:$(DOCKER_PUBLISH_PORT)$(NC)"
	docker run --rm -p $(DOCKER_PUBLISH_PORT):8000 --name $(APP_NAME)-run $(APP_NAME):$(IMAGE_TAG)

stop-docker: ## Stop local container started with a fixed name (if any)
	-docker stop $(APP_NAME)-container 2>/dev/null || true
	-docker rm $(APP_NAME)-container 2>/dev/null || true

create-repo: ## Create ECR repository $(APP_NAME)
	@echo "$(GREEN)Creating ECR repository$(NC)"
	aws ecr create-repository --repository-name $(APP_NAME) --region $(AWS_REGION) || echo "$(YELLOW)Repository may already exist$(NC)"

create-repo-deploy: create-repo build push ## Create ECR repo if needed, then build and push to ECR

clean: ## Remove local image tag
	-docker rmi $(APP_NAME):$(IMAGE_TAG) 2>/dev/null || true
	-docker rmi $(ECR_REPOSITORY):$(IMAGE_TAG) 2>/dev/null || true
