# Implementation Plan: Lightsail Migration

## Overview

Migrate the Scion Character Creator deployment from the destroyed ECS Fargate infrastructure to AWS Lightsail Containers. This plan covers rewriting the Makefile/docker.mk targets, setting up DNS/TLS, removing stale infrastructure references, and verifying the deployment end-to-end.

## Tasks

- [x] 1. Rewrite docker.mk with Lightsail Targets
  - [x] 1.1 Remove all ECR/ECS targets from `docker.mk` (login, tag, push, create-repo, create-repo-deploy, restart-service)
    - _Requirements: 5.1, 5.3, 9.1_
  - [x] 1.2 Add `LIGHTSAIL_SERVICE` variable (default: `scion-chargen`) and `LIGHTSAIL_POWER` variable (default: `nano`) to the Makefile
    - _Requirements: 5.5, 1.1_
  - [x] 1.3 Add `ls-create-service` target: runs `aws lightsail create-container-service --service-name $(LIGHTSAIL_SERVICE) --power $(LIGHTSAIL_POWER) --scale 1 --region $(AWS_REGION)`
    - _Requirements: 1.1, 1.2_
  - [x] 1.4 Add `ls-push` target: runs `aws lightsail push-container-image --service-name $(LIGHTSAIL_SERVICE) --label app --image $(APP_NAME):$(IMAGE_TAG) --region $(AWS_REGION)` and captures the image reference
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 1.5 Add `ls-deploy` target: creates a container deployment JSON with the latest pushed image, port 8000, health check (path `/`, interval 30s, timeout 5s, unhealthy threshold 3, healthy threshold 2, success codes `200`), and calls `aws lightsail create-container-service-deployment`
    - _Requirements: 3.1, 3.2, 8.1, 8.2, 8.4_
  - [x] 1.6 Add `deploy` target: depends on `build` then `ls-push` then `ls-deploy` in sequence
    - _Requirements: 5.2_
  - [x] 1.7 Add `ls-status` target: runs `aws lightsail get-container-services --service-name $(LIGHTSAIL_SERVICE)` and displays current state and URL
    - _Requirements: 1.3_
  - [x] 1.8 Add `ls-logs` target: runs `aws lightsail get-container-log --service-name $(LIGHTSAIL_SERVICE) --container-name app`
    - _Requirements: 1.3_
  - [x] 1.9 Retain `build`, `build-no-cache`, `run-docker`, `stop-docker`, and `clean` targets (adjust `clean` to remove only local image tags)
    - _Requirements: 5.4_

- [x] 2. Update Makefile (Remove ECS/Terraform, Add Lightsail Variables)
  - [x] 2.1 Remove `ECR_REPOSITORY`, `VPC_ID`, `ECS_CLUSTER`, `ECS_SERVICE`, and `TERRAFORM_DIR` variables from `Makefile`
    - _Requirements: 9.2_
  - [x] 2.2 Remove `plan`, `plan-all`, `apply`, `destroy`, and `secrets-purge` targets from `Makefile`
    - _Requirements: 9.1_
  - [x] 2.3 Add `LIGHTSAIL_SERVICE` and `LIGHTSAIL_POWER` variables to `Makefile` (before `include docker.mk`)
    - _Requirements: 5.5_
  - [x] 2.4 Update the `help` target to show Lightsail deployment targets instead of ECS/Terraform targets
    - _Requirements: 9.4_
  - [x] 2.5 Update the `info` target to show Lightsail service name, power tier, and region instead of ECR/ECS info
    - _Requirements: 9.4_
  - [x] 2.6 Remove `deploy` from `.PHONY` list and add Lightsail targets: `deploy`, `ls-create-service`, `ls-push`, `ls-deploy`, `ls-status`, `ls-logs`, `ls-create-cert`, `ls-attach-domain`, `ls-dns-setup`
    - _Requirements: 5.1, 5.3_

- [x] 3. Checkpoint - Ensure Makefile targets are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add One-Time Domain/TLS Setup Targets
  - [x] 4.1 Add `ls-create-cert` target: runs `aws lightsail create-certificate --certificate-name tulta-munille-cert --domain-name tulta-munille.com --subject-alternative-names www.tulta-munille.com --region $(AWS_REGION)` and displays validation CNAME records
    - _Requirements: 4.1_
  - [x] 4.2 Add `ls-cert-status` target: runs `aws lightsail get-certificates --certificate-name tulta-munille-cert --region $(AWS_REGION)` to check validation status
    - _Requirements: 4.1_
  - [x] 4.3 Add `ls-attach-domain` target: runs `aws lightsail update-container-service --service-name $(LIGHTSAIL_SERVICE) --public-domain-names` with the cert-to-domain mapping JSON
    - _Requirements: 4.2_
  - [x] 4.4 Add `ls-dns-setup` target: uses `aws route53 change-resource-record-sets` to create CNAME records for `tulta-munille.com` and `www.tulta-munille.com` pointing to the Lightsail service domain in hosted zone `Z04505901JV6BMGXU7TJT`
    - _Requirements: 7.1, 7.2_

- [x] 5. Delete Stale Infrastructure Files
  - [x] 5.1 Delete `scripts/aws_diagnose_vpc.sh`
    - _Requirements: 9.3_
  - [x] 5.2 Verify no other files in `scripts/` depend on the deleted script
    - _Requirements: 9.3_
  - [x] 5.3 Remove the `scripts/` directory if empty after deletion (keep if other scripts exist)
    - _Requirements: 9.3_

- [x] 6. Checkpoint - Verify infrastructure cleanup
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Verify Docker Image Fitness
  - [x] 7.1 Build the Docker image locally with `make build` and confirm it succeeds
    - _Requirements: 2.1, 6.4_
  - [x] 7.2 Run `docker run --rm $(APP_NAME):latest pip list` and confirm `playwright` is NOT present and `pymupdf` IS present
    - _Requirements: 6.1, 6.2_
  - [x] 7.3 Run `docker images $(APP_NAME):latest --format '{{.Size}}'` and confirm size is below 500 MB
    - _Requirements: 6.4_
  - [x] 7.4 Run the container with `make run-docker` and confirm `curl http://localhost:8000/` returns HTTP 200
    - _Requirements: 8.1, 8.2_
  - [x] 7.5 POST a minimal HTML payload to `http://localhost:8000/api/export/review-sheet-pdf` and confirm a PDF response with renderer `story`
    - _Requirements: 6.3_

- [x] 8. End-to-End Deployment Verification
  - [x] 8.1 Run `make ls-create-service` and confirm the Lightsail service is created (or already exists)
    - _Requirements: 1.1_
  - [x] 8.2 Run `make deploy` and confirm build, push, and deployment succeed
    - _Requirements: 5.2, 3.3_
  - [x] 8.3 Run `make ls-status` and confirm deployment state is `ACTIVE` with a public URL
    - _Requirements: 3.3_
  - [x] 8.4 Curl the Lightsail public URL and confirm HTTP 200 with the app's HTML
    - _Requirements: 3.3, 8.2_
  - [x] 8.5 Run `make ls-create-cert` and note the CNAME validation records
    - _Requirements: 4.1_
  - [x] 8.6 Add validation CNAMEs to Route53, wait for cert validation, then run `make ls-attach-domain`
    - _Requirements: 4.2_
  - [x] 8.7 Run `make ls-dns-setup` to create the production DNS records
    - _Requirements: 7.1, 7.2_
  - [x] 8.8 Verify `https://scion-chargen.tulta-munille.com` serves the app with a valid TLS certificate
    - _Requirements: 4.5, 7.3_

- [x] 9. Final checkpoint - Ensure all verification passes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This is an infrastructure migration with no application code changes
- Tasks 7 and 8 are verification/smoke-test tasks that confirm the deployment works end-to-end
- The Docker image already excludes Playwright via `docker/requirements.txt`
- Lightsail handles rollback automatically if health checks fail on a new deployment
- One-time setup targets (ls-create-service, ls-create-cert, ls-attach-domain, ls-dns-setup) only need to be run once; subsequent deploys use `make deploy`
- Property tests are not applicable for this IaC migration feature

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.9", "2.1", "5.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.2", "2.3", "5.3"] },
    { "id": 3, "tasks": ["1.5", "1.6", "2.4", "2.5"] },
    { "id": 4, "tasks": ["1.7", "1.8", "2.6"] },
    { "id": 5, "tasks": ["4.1", "4.2"] },
    { "id": 6, "tasks": ["4.3", "4.4"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 9, "tasks": ["7.5"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2"] },
    { "id": 12, "tasks": ["8.3", "8.4"] },
    { "id": 13, "tasks": ["8.5"] },
    { "id": 14, "tasks": ["8.6"] },
    { "id": 15, "tasks": ["8.7"] },
    { "id": 16, "tasks": ["8.8"] }
  ]
}
```
