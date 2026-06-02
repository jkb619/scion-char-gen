# Implementation Plan: Lightsail Terragrunt

## Overview

Replace imperative AWS CLI Makefile targets with declarative Terragrunt/Terraform modules for the Lightsail container service, TLS certificate, domain attachment, and Route53 DNS. Remove stale ECS/ALB/VPC modules and clean up orphaned remote state. Import existing live resources into Terraform state.

## Tasks

- [x] 1. Update globals and create local Terraform modules
  - [x] 1.1 Update `terraform/globals.hcl` with Lightsail-specific locals
    - Add `lightsail_service_name = "scion-chargen"`, `lightsail_power = "nano"`, `lightsail_scale = 1`, `lightsail_domain = "scion-chargen.tulta-munille.com"`, `lightsail_certificate_name = "tulta-munille-cert"`
    - Remove stale ECS/ALB/VPC locals (`existing_vpc_id`, `alb_subnet_ids`, `ecs_cluster_name`, `ecs_service_name`, `container_name`, `container_port`, `alb_name`, `alb_sg_name`, `ecs_sg_name`, `acm_certificate_domain`, `acm_certificate_arn`)
    - Retain `aws_region`, `aws_account_id`, `project_name`, `environment`, `common_tags`, `route53_zone_id`, `route53_zone_name`, `route53_record_name`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 1.2 Create `terraform/modules/lightsail-service/` module
    - Create `main.tf` with `aws_lightsail_container_service` resource
    - Create `variables.tf` with inputs: `service_name` (string), `power` (string, default "nano"), `scale` (number, default 1), `tags` (map(string), default {})
    - Create `outputs.tf` with `service_name` and `url` outputs
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.3 Create `terraform/modules/lightsail-certificate/` module
    - Create `main.tf` with `aws_lightsail_certificate` resource
    - Create `variables.tf` with inputs: `certificate_name` (string), `domain_name` (string)
    - Create `outputs.tf` with `certificate_name` output
    - _Requirements: 2.1, 2.3_

  - [x] 1.4 Create `terraform/modules/lightsail-domain/` module
    - Create `main.tf` with `aws_lightsail_container_service_public_domain_names` resource
    - Create `variables.tf` with inputs: `service_name` (string), `certificate_name` (string), `domain_name` (string)
    - Create `outputs.tf` (empty, side-effect only module)
    - _Requirements: 3.1_

- [x] 2. Create Terragrunt child modules
  - [x] 2.1 Create `terraform/lightsail-service/terragrunt.hcl`
    - Use inline `terraform { source }` referencing `../modules/lightsail-service`
    - Include root and globals configs
    - Pass `service_name`, `power`, `scale`, `tags` from globals
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.2 Create `terraform/lightsail-certificate/terragrunt.hcl`
    - Use inline `terraform { source }` referencing `../modules/lightsail-certificate`
    - Include root and globals configs
    - Pass `certificate_name` and `domain_name` from globals
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Create `terraform/lightsail-domain/terragrunt.hcl`
    - Use inline `terraform { source }` referencing `../modules/lightsail-domain`
    - Include root and globals configs
    - Declare `dependency` blocks on `../lightsail-service` and `../lightsail-certificate`
    - Pass inputs from dependency outputs and globals
    - Include `mock_outputs` for validate/plan commands
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.4 Update `terraform/route53/terragrunt.hcl`
    - Change dependency from `../alb` to `../lightsail-service`
    - Change record type from `A` (alias) to `CNAME` with TTL 300
    - Set CNAME target to lightsail-service URL output (strip `https://` prefix)
    - Update `mock_outputs` to reflect the new dependency shape
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Checkpoint - Validate module syntax
  - Ensure all modules pass `terragrunt run-all validate`, ask the user if questions arise.

- [x] 4. Makefile changes and stale module removal
  - [x] 4.1 Add Terragrunt targets to Makefile and remove stale Lightsail setup targets
    - Add `plan` target: `cd terraform && terragrunt run-all plan`
    - Add `apply` target: `cd terraform && terragrunt run-all apply`
    - Add `destroy` target: `cd terraform && terragrunt run-all destroy`
    - Remove `ls-create-service`, `ls-create-cert`, `ls-cert-status`, `ls-attach-domain`, `ls-dns-setup` targets from `docker.mk`
    - Update `.PHONY` declarations accordingly
    - Retain `build`, `build-no-cache`, `run-docker`, `stop-docker`, `clean`, `ls-push`, `ls-deploy`, `deploy`, `ls-status`, `ls-logs`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.2 Delete stale ECS/ALB/VPC module directories
    - Delete `terraform/alb/`, `terraform/ecs/`, `terraform/vpc/`, `terraform/security-groups/`, `terraform/iam/`, `terraform/kms/`, `terraform/secrets/`, `terraform/secrets-manager/`, `terraform/certificate/`, `terraform/modules/` (old modules directory)
    - Delete `terraform/scripts/purge-secrets-manager-secret.sh`
    - Retain `terraform/terragrunt.hcl`, `terraform/globals.hcl`, `terraform/route53/`, and new child modules
    - _Requirements: 6.1, 6.2_

- [x] 5. State management scripts
  - [x] 5.1 Create `terraform/scripts/import.sh`
    - Write script with `terragrunt import` commands for each existing resource:
      - `lightsail-service`: `aws_lightsail_container_service.this` → `scion-chargen`
      - `lightsail-certificate`: `aws_lightsail_certificate.this` → `tulta-munille-cert`
      - `lightsail-domain`: `aws_lightsail_container_service_public_domain_names.this` → `scion-chargen`
      - `route53`: `module.records.aws_route53_record.this["scion-chargen CNAME"]` → `Z04505901JV6BMGXU7TJT_scion-chargen.tulta-munille.com_CNAME`
    - Include AWS auth environment variables (`AWS_SHARED_CREDENTIALS_FILE`, `AWS_PROFILE`)
    - Make script executable
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 5.2 Create `terraform/scripts/cleanup-state.sh`
    - Write script to delete S3 state objects for removed modules: `alb/`, `certificate/`, `ecs/service/`, `vpc/`, `vpc/endpoints/`, `security-groups/`, `iam/execution-role/`, `iam/task-role/`, `kms/`, `secrets-manager/`
    - Include DynamoDB lock entry removal for each deleted state path
    - Add confirmation prompt before destructive operations
    - Include AWS auth environment variables
    - Make script executable
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 6. Final checkpoint - Validate complete setup
  - Ensure all modules pass `terragrunt run-all validate` with no errors, ask the user if questions arise.

## Notes

- This is an IaC feature — no property-based tests apply. Correctness is validated through `terraform validate` and `terraform plan` output inspection.
- The existing S3 state bucket and DynamoDB lock table are reused (no bootstrap step needed).
- The Lightsail service, certificate, and DNS record are already live — `import.sh` must be run before the first `apply`.
- Stale module directories should be deleted AFTER running `cleanup-state.sh` to avoid Terragrunt errors referencing non-existent state.
- AWS CLI v2 is at `~/bin/aws`; auth requires `AWS_SHARED_CREDENTIALS_FILE=~/.aws/credentials-composite AWS_PROFILE=tulta-admin`.
- Checkpoints ensure incremental validation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["4.1", "4.2", "5.1", "5.2"] }
  ]
}
```
