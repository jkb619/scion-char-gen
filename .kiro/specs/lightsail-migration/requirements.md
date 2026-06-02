# Requirements Document

## Introduction

Migrate the Scion Character Creator application from the destroyed ECS Fargate + ALB + VPC endpoints infrastructure to AWS Lightsail Containers. The goal is to reduce hosting costs from $400+/month to approximately $7–10/month while maintaining equivalent functionality (with Playwright/Chromium PDF export gracefully degraded to the existing PyMuPDF Story fallback). The app is a stateless Python 3.12 FastAPI application serving a character creation wizard for the Scion 2e tabletop RPG. It serves static JS/CSS, Jinja2-rendered templates with inlined game data, and PDF export endpoints.

## Glossary

- **Lightsail_Service**: The AWS Lightsail Container Service hosting the application container
- **Deployment_Pipeline**: The local Makefile-driven workflow that builds, pushes, and deploys the container image to Lightsail
- **Container_Image**: The Docker image built from `docker/Dockerfile` containing the FastAPI application and its runtime dependencies
- **DNS_Configuration**: The Route53 records that route the custom domain to the Lightsail service endpoint
- **Health_Check**: The HTTP probe Lightsail uses to determine container readiness
- **PDF_Export_Engine**: The subsystem that renders character sheet HTML to PDF (PyMuPDF Story in the Lightsail deployment)
- **Custom_Domain**: The domain `tulta-munille.com` served via Lightsail's managed TLS certificate
- **TLS_Certificate**: The Lightsail-managed certificate providing HTTPS for the Custom_Domain

## Requirements

### Requirement 1: Create Lightsail Container Service

**User Story:** As a developer, I want a Lightsail Container Service provisioned in us-east-2, so that I have a low-cost compute target for the application.

#### Acceptance Criteria

1. THE Deployment_Pipeline SHALL create a Lightsail Container Service named `scion-chargen` in the `us-east-2` region with the nano power tier (512 MB RAM, 0.25 vCPU) and a scale of 1 node
2. WHEN the nano tier proves insufficient for the application's memory footprint, THE Deployment_Pipeline SHALL support upgrading to the micro power tier (1 GB RAM, 0.5 vCPU) by changing a single variable
3. THE Lightsail_Service SHALL expose port 8000 as the container's public endpoint

### Requirement 2: Build and Push Container Image to Lightsail

**User Story:** As a developer, I want a single Makefile target that builds and pushes my Docker image directly to Lightsail, so that I can deploy without managing a separate container registry.

#### Acceptance Criteria

1. THE Deployment_Pipeline SHALL build the Container_Image using the existing `docker/Dockerfile`
2. THE Deployment_Pipeline SHALL push the Container_Image to the Lightsail_Service using the `aws lightsail push-container-image` CLI command
3. THE Deployment_Pipeline SHALL tag the pushed image with the service name `scion-chargen` and label `app`
4. WHEN the push completes, THE Deployment_Pipeline SHALL output the Lightsail image identifier (e.g., `:scion-chargen.app.N`)

### Requirement 3: Deploy Container to Lightsail Service

**User Story:** As a developer, I want a Makefile target that creates a new deployment on my Lightsail service using the most recently pushed image, so that I can release changes with one command.

#### Acceptance Criteria

1. THE Deployment_Pipeline SHALL create a Lightsail container deployment specifying the most recently pushed image, container port 8000, and the environment variable `PORT=8000`
2. THE Deployment_Pipeline SHALL configure the deployment's public endpoint to reference container port 8000 with the Health_Check path set to `/`
3. WHEN the deployment succeeds, THE Lightsail_Service SHALL serve HTTP traffic on its default `*.amazonaws.com` domain within 5 minutes
4. IF the deployment fails health checks, THEN THE Lightsail_Service SHALL retain the previous healthy deployment (Lightsail default rollback behavior)

### Requirement 4: Configure Custom Domain with Managed TLS

**User Story:** As a developer, I want my Lightsail service reachable at `tulta-munille.com` over HTTPS with an auto-renewed TLS certificate, so that users access the app on a memorable domain securely.

#### Acceptance Criteria

1. THE Deployment_Pipeline SHALL provide a Makefile target to create a Lightsail TLS certificate for the domain `tulta-munille.com` with a subject alternative name of `www.tulta-munille.com`
2. WHEN the certificate is issued, THE Deployment_Pipeline SHALL attach the certificate and custom domain to the Lightsail_Service via `aws lightsail update-container-service`
3. THE DNS_Configuration SHALL include a Route53 ALIAS or CNAME record mapping `tulta-munille.com` to the Lightsail_Service default domain
4. THE DNS_Configuration SHALL include a Route53 CNAME record mapping `www.tulta-munille.com` to `tulta-munille.com`
5. WHEN a user navigates to `https://tulta-munille.com`, THE Lightsail_Service SHALL respond with a valid TLS certificate and serve the application

### Requirement 5: Update Makefile for Lightsail Workflow

**User Story:** As a developer, I want the Makefile updated to replace ECS/ECR targets with Lightsail equivalents, so that `make deploy` handles the full build-push-release cycle.

#### Acceptance Criteria

1. THE Deployment_Pipeline SHALL replace the `push` target in `docker.mk` with a Lightsail-oriented workflow (build, push-to-lightsail, deploy)
2. THE Deployment_Pipeline SHALL provide a `deploy` target that sequentially executes build, push, and create-deployment steps
3. THE Deployment_Pipeline SHALL remove or mark as deprecated all ECS-specific targets (`restart-service`, `login`, `tag`, `create-repo`, `create-repo-deploy`)
4. THE Deployment_Pipeline SHALL retain the `build`, `build-no-cache`, `run-docker`, `stop-docker`, and `clean` targets unchanged for local development use
5. THE Deployment_Pipeline SHALL define a `LIGHTSAIL_SERVICE` variable (default: `scion-chargen`) used by all Lightsail targets

### Requirement 6: Remove Playwright from Production Image

**User Story:** As a developer, I want Playwright and Chromium excluded from the production Docker image, so that the image fits within the Lightsail nano/micro tier memory constraints.

#### Acceptance Criteria

1. THE Container_Image SHALL NOT include the `playwright` Python package or Chromium browser binaries
2. THE Container_Image SHALL include `pymupdf` as the sole PDF_Export_Engine dependency
3. WHEN the `SCION_REVIEW_SHEET_PDF_ENGINE` environment variable is unset or set to `auto`, THE PDF_Export_Engine SHALL use PyMuPDF Story as the renderer without attempting Playwright import at request time
4. THE Container_Image built without Playwright SHALL have an uncompressed size below 500 MB

### Requirement 7: Configure Route53 DNS Records

**User Story:** As a developer, I want Route53 DNS records pointing my domain to the Lightsail endpoint, so that traffic reaches the new infrastructure after deployment.

#### Acceptance Criteria

1. THE DNS_Configuration SHALL create an A record (ALIAS) or CNAME for `tulta-munille.com` pointing to the Lightsail_Service public domain in hosted zone `Z04505901JV6BMGXU7TJT`
2. THE DNS_Configuration SHALL create a CNAME record for `www.tulta-munille.com` pointing to `tulta-munille.com` in the same hosted zone
3. WHEN the DNS records propagate, THE Custom_Domain SHALL resolve to the Lightsail_Service endpoint within the Route53 TTL period (300 seconds default)

### Requirement 8: Health Check Configuration

**User Story:** As a developer, I want Lightsail to verify my container is healthy before routing traffic, so that failed deployments do not serve errors to users.

#### Acceptance Criteria

1. THE Health_Check SHALL issue HTTP GET requests to path `/` on container port 8000
2. THE Health_Check SHALL consider a 200 status code as a healthy response
3. WHEN the container fails to return a 200 within 5 seconds for 3 consecutive checks, THE Lightsail_Service SHALL mark the container as unhealthy
4. THE Health_Check interval SHALL be 30 seconds with a timeout of 5 seconds, matching the existing `HEALTHCHECK` directive in the Dockerfile

### Requirement 9: Remove Stale Infrastructure References

**User Story:** As a developer, I want all references to the destroyed ECS/Fargate/ALB/VPC infrastructure removed from the codebase, so that the project accurately reflects its current deployment model.

#### Acceptance Criteria

1. THE Deployment_Pipeline SHALL remove or archive the `terraform/` directory references from the Makefile (`plan`, `plan-all`, `apply`, `destroy`, `secrets-purge` targets)
2. THE Deployment_Pipeline SHALL remove the `VPC_ID`, `ECS_CLUSTER`, `ECS_SERVICE`, and `ECR_REPOSITORY` variables from the Makefile
3. THE Deployment_Pipeline SHALL remove the `scripts/aws_diagnose_vpc.sh` file or move it to an `archive/` directory
4. THE Makefile help text SHALL reflect only Lightsail-based deployment targets
