# Design Document

## Overview

This design describes the migration of the Scion Character Creator from the destroyed ECS Fargate infrastructure to AWS Lightsail Containers. The approach uses the AWS CLI directly from Makefile targets (no Terraform/Terragrunt) to provision, deploy, and manage a single Lightsail Container Service. The Docker image is pushed directly to Lightsail (no ECR), and Lightsail's managed TLS handles HTTPS for the custom domain.

## Architecture

### Deployment Model

```
Developer workstation
  │
  ├─ make build          → docker build (existing Dockerfile)
  ├─ make push           → aws lightsail push-container-image
  └─ make deploy         → aws lightsail create-container-service-deployment
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  Lightsail Container     │
                    │  Service: scion-chargen  │
                    │  Power: nano (512MB)     │
                    │  Scale: 1                │
                    │  Port: 8000              │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  Lightsail Managed TLS   │
                    │  + Custom Domain         │
                    │  tulta-munille.com       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  Route53 Hosted Zone     │
                    │  Z04505901JV6BMGXU7TJT  │
                    │  CNAME → *.amazonaws.com │
                    └─────────────────────────┘
```

### Container Configuration

- **Base image**: python:3.12-slim-bookworm (unchanged)
- **Runtime deps**: fastapi, uvicorn, jinja2, pypdf, pymupdf (no Playwright)
- **Entrypoint**: uvicorn on port 8000 with proxy headers
- **Health check**: GET / → 200 (interval 30s, timeout 5s)

### Key Design Decisions

1. **No Terraform** — The previous Terraform/Terragrunt setup was over-engineered for a single-container stateless app. AWS CLI commands in Makefile targets are sufficient and more transparent.

2. **No ECR** — Lightsail has its own image registry. `aws lightsail push-container-image` handles tagging and storage.

3. **No Playwright in production** — Chromium + Playwright adds ~400MB and requires >512MB RAM. The existing PyMuPDF Story fallback produces functional PDFs. The `docker/requirements.txt` already excludes Playwright.

4. **Lightsail managed TLS over ACM** — Lightsail doesn't support importing ACM certificates. Its own cert manager provides free auto-renewed certificates for attached custom domains.

5. **CNAME for apex domain** — Lightsail doesn't support Route53 ALIAS records for its container endpoints. A CNAME from `tulta-munille.com` to the Lightsail `*.amazonaws.com` domain works because Route53 supports CNAME-like behavior at zone apex via ALIAS records that point to the CNAME target.

## Components and Interfaces

### 1. Lightsail Service Provisioning (one-time setup)

**File**: `docker.mk` (new targets)

Create the Lightsail container service:
```bash
aws lightsail create-container-service \
  --service-name scion-chargen \
  --power nano \
  --scale 1 \
  --region us-east-2
```

### 2. Image Push Workflow

**File**: `docker.mk`

```bash
aws lightsail push-container-image \
  --service-name scion-chargen \
  --label app \
  --image scion-chargen:latest \
  --region us-east-2
```

This outputs the Lightsail image reference (e.g., `:scion-chargen.app.42`) which is captured for the deployment step.

### 3. Deployment Creation

**File**: `docker.mk`

The deployment uses a JSON structure:
```json
{
  "containers": {
    "app": {
      "image": ":scion-chargen.app.N",
      "ports": {"8000": "HTTP"},
      "environment": {"PORT": "8000"}
    }
  },
  "publicEndpoint": {
    "containerName": "app",
    "containerPort": 8000,
    "healthCheck": {
      "path": "/",
      "intervalSeconds": 30,
      "timeoutSeconds": 5,
      "unhealthyThreshold": 3,
      "healthyThreshold": 2,
      "successCodes": "200"
    }
  }
}
```

### 4. TLS and Custom Domain Setup (one-time)

**File**: `docker.mk` (setup targets)

```bash
# Create certificate
aws lightsail create-certificate \
  --certificate-name tulta-munille-cert \
  --domain-name tulta-munille.com \
  --subject-alternative-names www.tulta-munille.com

# After DNS validation, attach to service
aws lightsail update-container-service \
  --service-name scion-chargen \
  --public-domain-names '{"tulta-munille-cert": ["tulta-munille.com", "www.tulta-munille.com"]}'
```

### 5. Route53 DNS Records

**Managed via**: AWS CLI or console (one-time setup, documented in Makefile target)

- `tulta-munille.com` → CNAME to Lightsail public domain (e.g., `scion-chargen.abc123.us-east-2.cs.amazonlightsail.com`)
- `www.tulta-munille.com` → CNAME to `tulta-munille.com`

### 6. Makefile Refactoring

**Files**: `Makefile`, `docker.mk`

Remove:
- `ECR_REPOSITORY`, `VPC_ID`, `ECS_CLUSTER`, `ECS_SERVICE` variables
- `login`, `tag`, `push` (ECR version), `create-repo`, `create-repo-deploy`, `restart-service` targets
- `plan`, `plan-all`, `apply`, `destroy`, `secrets-purge` targets
- `TERRAFORM_DIR` variable

Add:
- `LIGHTSAIL_SERVICE` variable (default: `scion-chargen`)
- `LIGHTSAIL_POWER` variable (default: `nano`)
- `ls-push` — push image to Lightsail
- `ls-deploy` — create deployment with latest image
- `deploy` — build + ls-push + ls-deploy (full workflow)
- `ls-create-service` — one-time service creation
- `ls-create-cert` — one-time TLS certificate creation
- `ls-attach-domain` — attach custom domain after cert validation
- `ls-dns-setup` — create Route53 records
- `ls-status` — show current deployment state
- `ls-logs` — fetch container logs

Retain unchanged:
- `build`, `build-no-cache`, `run-docker`, `stop-docker`, `clean`
- `run`, `run-https`, `run-http`

## Data Models

This feature is an infrastructure migration with no application-level data model changes. The relevant "data" are the deployment configuration structures passed to AWS CLI commands:

### Deployment Configuration

```json
{
  "containers": {
    "app": {
      "image": ":scion-chargen.app.N",
      "ports": {"8000": "HTTP"},
      "environment": {"PORT": "8000"}
    }
  },
  "publicEndpoint": {
    "containerName": "app",
    "containerPort": 8000,
    "healthCheck": {
      "path": "/",
      "intervalSeconds": 30,
      "timeoutSeconds": 5,
      "unhealthyThreshold": 3,
      "healthyThreshold": 2,
      "successCodes": "200"
    }
  }
}
```

### Makefile Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LIGHTSAIL_SERVICE` | `scion-chargen` | Service name for all Lightsail CLI calls |
| `LIGHTSAIL_POWER` | `nano` | Container power tier (nano/micro) |
| `LIGHTSAIL_REGION` | `us-east-2` | AWS region |
| `LIGHTSAIL_DOMAIN` | `tulta-munille.com` | Custom domain |

## Correctness Properties

### Property 1: Deploy target executes build-push-deploy sequence

*For any* invocation of `make deploy`, the system SHALL execute build, then ls-push, then ls-deploy in sequence, and if any step fails, subsequent steps SHALL NOT execute.

**Validates: Requirements 5.2**

### Property 2: Container serves health check after deployment

*For any* successfully deployed container, an HTTP GET to `/` on port 8000 SHALL return status 200 with HTML content.

**Validates: Requirements 8.1, 8.2**

### Property 3: PDF export functions without Playwright

*For any* valid sheet HTML payload, when Playwright is not installed, POSTing to `/api/export/review-sheet-pdf` SHALL return a PDF response with renderer `story` and no ImportError.

**Validates: Requirements 6.3**

### Property 4: Image excludes Playwright binaries

*For any* build of the Container_Image, the image SHALL NOT contain the `playwright` pip package or `/usr/bin/chromium*` binaries, and its uncompressed size SHALL be below 500 MB.

**Validates: Requirements 6.1, 6.4**

### Property 5: Lightsail push outputs image reference

*For any* successful execution of `aws lightsail push-container-image`, stdout SHALL contain a string matching the pattern `:scion-chargen.app.\d+`.

**Validates: Requirements 2.4**

### Property 6: Makefile contains no ECS/ECR/Terraform references

*For any* post-migration state of the repository, `grep -E 'ECR_REPOSITORY|ECS_CLUSTER|ECS_SERVICE|VPC_ID|TERRAFORM_DIR|terragrunt' Makefile docker.mk` SHALL return no matches.

**Validates: Requirements 9.1, 9.2**

## Error Handling

### Deployment Failures

- **Build failure**: `make deploy` aborts immediately; no image is pushed. Developer inspects Docker build output.
- **Push failure**: If `aws lightsail push-container-image` fails (auth, network, service not found), the deploy target exits non-zero. The previous deployment remains active.
- **Deployment health check failure**: Lightsail retains the last healthy deployment automatically. The new deployment enters `FAILED` state. Developer runs `make ls-status` to diagnose.

### Runtime Errors

- **Container crash/OOM**: Lightsail restarts the container automatically. If repeated failures occur, the service marks the node unhealthy. Developer upgrades `LIGHTSAIL_POWER` to `micro` and redeploys.
- **PDF export without Playwright**: The application catches `ImportError` for Playwright and falls back to PyMuPDF Story renderer. No user-facing error; the response returns a PDF with `X-Sheet-Pdf-Renderer: story`.
- **Health check timeout**: If the app fails to respond to `/` within 5 seconds for 3 consecutive checks, Lightsail marks the container unhealthy. Traffic continues to previous healthy deployment if available.

### DNS/TLS Errors

- **Certificate validation timeout**: If DNS validation records are not created within 72 hours, the certificate request expires. Developer re-runs `make ls-create-cert`.
- **Domain resolution failure**: If Route53 records are misconfigured, the custom domain returns NXDOMAIN. Developer verifies records with `dig tulta-munille.com` and corrects via `make ls-dns-setup`.

## Testing Strategy

### Approach

This feature is an infrastructure migration (IaC/CLI-driven), so property-based testing is not the primary strategy. Testing focuses on integration verification, smoke tests, and example-based checks.

### Unit Tests

- None required — the migration involves no application code changes. Existing application tests remain valid.

### Integration / Smoke Tests

| Test | Type | What it verifies |
|------|------|-----------------|
| `docker run` + `curl /` → 200 | Smoke | Health check endpoint works in built image |
| `docker run` + POST PDF endpoint | Integration | PDF export works without Playwright |
| `docker images` size check | Smoke | Image under 500MB |
| `pip list` in container | Smoke | Playwright not installed |
| `make -n deploy` dry run | Smoke | Target dependency chain is correct |
| Post-deploy `curl` to Lightsail URL | Integration | End-to-end deployment serves traffic |
| `dig tulta-munille.com` | Smoke | DNS resolves to Lightsail endpoint |

### Manual Verification Checklist

1. `make deploy` completes without errors
2. `make ls-status` shows `RUNNING` state
3. Lightsail default URL serves the application
4. Custom domain `https://tulta-munille.com` serves the application with valid TLS
5. PDF export returns valid PDF without errors in container logs

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `docker.mk` | Rewrite | Replace ECR/ECS targets with Lightsail targets |
| `Makefile` | Modify | Remove ECS/ECR/Terraform variables and targets, add Lightsail variables |
| `scripts/aws_diagnose_vpc.sh` | Delete | No longer relevant |
| `docker/Dockerfile` | No change | Already suitable for Lightsail |
| `docker/entrypoint.sh` | No change | Already suitable |
| `docker/requirements.txt` | No change | Already excludes Playwright |
| `src/app/routers/review_sheet_pdf.py` | No change | Fallback logic already handles missing Playwright |

## Deployment Runbook (One-Time Setup)

1. `make ls-create-service` — Create the Lightsail container service
2. `make deploy` — Build, push, and deploy the image
3. Verify: visit the `*.amazonaws.com` URL from `make ls-status`
4. `make ls-create-cert` — Create TLS certificate for custom domain
5. Add CNAME validation records to Route53 (output by cert command)
6. Wait for certificate to validate (check `make ls-cert-status`)
7. `make ls-attach-domain` — Attach validated cert + domain to service
8. `make ls-dns-setup` — Create Route53 CNAME records pointing to Lightsail
9. Verify: `https://tulta-munille.com` serves the app

## Subsequent Deployments

```bash
make deploy   # build → push → deploy (single command)
```
