# Requirements Document

## Introduction

Replace the imperative AWS CLI Makefile targets that manage Lightsail service lifecycle (creation, TLS certificate, domain attachment, DNS records, destruction) with declarative Terragrunt/Terraform modules. The new modules follow the existing `terraform/` project structure (root `terragrunt.hcl` with S3 backend, `globals.hcl` for shared locals, child directories per resource). Stale ECS/ALB/VPC modules are removed. Imperative operations (build, push, deploy) remain in the Makefile.

## Glossary

- **Terragrunt**: A thin wrapper around Terraform that provides DRY configuration, remote state management, and dependency orchestration between Terraform modules.
- **Lightsail_Service**: An `aws_lightsail_container_service` resource representing the Lightsail container service named `scion-chargen` running in `us-east-2`.
- **Lightsail_Certificate**: An `aws_lightsail_certificate` resource providing TLS for the custom domain `scion-chargen.tulta-munille.com`.
- **Lightsail_Domain_Attachment**: The `public_domain_names` configuration on the Lightsail container service that binds a validated certificate to a custom domain.
- **Route53_Record**: An `aws_route53_record` CNAME pointing `scion-chargen.tulta-munille.com` to the Lightsail service endpoint.
- **Root_Terragrunt**: The top-level `terraform/terragrunt.hcl` file that configures the S3 remote state backend and generates the AWS provider block.
- **Globals**: The `terraform/globals.hcl` file containing shared locals (region, account ID, project name, zone ID, domain names).
- **State_Bucket**: The existing S3 bucket `scion-chargen-terraform-state-us-east-2` used for Terraform remote state.
- **Lock_Table**: The existing DynamoDB table `scion-chargen-terraform-locks` used for state locking.

## Requirements

### Requirement 1: Lightsail Container Service Module

**User Story:** As a developer, I want the Lightsail container service defined as a Terraform resource in a dedicated Terragrunt child module, so that I can create, modify, and destroy the service declaratively.

#### Acceptance Criteria

1. THE Lightsail_Service module SHALL define an `aws_lightsail_container_service` resource with configurable `power` and `scale` inputs.
2. THE Lightsail_Service module SHALL default the `power` input to `nano` and the `scale` input to `1`.
3. THE Lightsail_Service module SHALL derive the service name from the `project_name` local in Globals.
4. THE Lightsail_Service module SHALL output the service name and the service URL for use by dependent modules.
5. THE Lightsail_Service module SHALL apply the `common_tags` from Globals as resource tags.

### Requirement 2: Lightsail TLS Certificate Module

**User Story:** As a developer, I want the Lightsail TLS certificate defined as a Terraform resource, so that certificate creation and lifecycle are managed declaratively and consistently.

#### Acceptance Criteria

1. THE Lightsail_Certificate module SHALL define an `aws_lightsail_certificate` resource for the domain `scion-chargen.tulta-munille.com`.
2. THE Lightsail_Certificate module SHALL derive the domain name from Globals locals (`project_name` and `route53_zone_name`).
3. THE Lightsail_Certificate module SHALL output the certificate name for use by the domain attachment module.

### Requirement 3: Lightsail Domain Attachment Module

**User Story:** As a developer, I want the custom domain attachment managed as a Terraform resource, so that binding the certificate to the Lightsail service is declarative and repeatable.

#### Acceptance Criteria

1. THE Lightsail_Domain_Attachment module SHALL configure `public_domain_names` on the Lightsail container service linking the certificate to the custom domain.
2. THE Lightsail_Domain_Attachment module SHALL declare a dependency on both the Lightsail_Service module and the Lightsail_Certificate module.
3. WHEN the Lightsail_Certificate module output changes, THE Lightsail_Domain_Attachment module SHALL update the domain attachment to reference the new certificate name.

### Requirement 4: Route53 DNS Record Module

**User Story:** As a developer, I want the Route53 CNAME record managed by Terraform, so that DNS changes are tracked in state and can be planned, applied, and destroyed with the rest of the infrastructure.

#### Acceptance Criteria

1. THE Route53_Record module SHALL define an `aws_route53_record` of type CNAME for `scion-chargen.tulta-munille.com`.
2. THE Route53_Record module SHALL set the CNAME target to the Lightsail service URL output from the Lightsail_Service module.
3. THE Route53_Record module SHALL use the `route53_zone_id` from Globals to place the record in the correct hosted zone.
4. THE Route53_Record module SHALL declare a dependency on the Lightsail_Service module.
5. THE Route53_Record module SHALL set the TTL to 300 seconds.

### Requirement 5: Globals Update

**User Story:** As a developer, I want `globals.hcl` updated with Lightsail-specific variables, so that all child modules can reference consistent domain, certificate, and service configuration.

#### Acceptance Criteria

1. THE Globals file SHALL contain a `lightsail_service_name` local set to `scion-chargen`.
2. THE Globals file SHALL contain a `lightsail_power` local set to `nano`.
3. THE Globals file SHALL contain a `lightsail_scale` local set to `1`.
4. THE Globals file SHALL contain a `lightsail_domain` local set to `scion-chargen.tulta-munille.com`.
5. THE Globals file SHALL contain a `lightsail_certificate_name` local set to `tulta-munille-cert`.
6. THE Globals file SHALL retain existing values for `aws_region`, `aws_account_id`, `route53_zone_id`, `route53_zone_name`, and `common_tags`.

### Requirement 6: Stale Module Removal

**User Story:** As a developer, I want the obsolete ECS/ALB/VPC Terraform modules removed, so that the `terraform/` directory accurately reflects the active infrastructure and avoids confusion.

#### Acceptance Criteria

1. THE project SHALL delete the `terraform/alb/`, `terraform/ecs/`, `terraform/vpc/`, `terraform/security-groups/`, `terraform/iam/`, `terraform/kms/`, `terraform/secrets/`, `terraform/secrets-manager/`, `terraform/certificate/`, and `terraform/modules/` directories.
2. THE project SHALL retain `terraform/terragrunt.hcl`, `terraform/globals.hcl`, and `terraform/scripts/` (if scripts are still referenced).

### Requirement 10: Remote State Cleanup

**User Story:** As a developer, I want orphaned Terraform state files for the deleted modules purged from the S3 state bucket, so that `terragrunt run-all` commands do not reference non-existent stacks and the state bucket stays clean.

#### Acceptance Criteria

1. THE project SHALL provide a script or documented commands to delete the S3 state objects for each removed module (paths: `alb/terraform.tfstate`, `certificate/terraform.tfstate`, `ecs/service/terraform.tfstate`, `vpc/terraform.tfstate`, `vpc/endpoints/terraform.tfstate`, `security-groups/terraform.tfstate`, `iam/execution-role/terraform.tfstate`, `iam/task-role/terraform.tfstate`, `kms/terraform.tfstate`, `secrets-manager/terraform.tfstate`).
2. THE project SHALL provide commands to remove the corresponding DynamoDB lock entries from the Lock_Table for each deleted state path.
3. WHEN state cleanup completes, THE `terragrunt run-all plan` command SHALL execute without referencing any removed module paths.

### Requirement 7: Makefile Integration

**User Story:** As a developer, I want the Makefile to provide `plan`, `apply`, and `destroy` targets that invoke Terragrunt, so that infrastructure operations are a single command away.

#### Acceptance Criteria

1. THE Makefile SHALL define a `plan` target that runs `terragrunt run-all plan` from the `terraform/` directory.
2. THE Makefile SHALL define an `apply` target that runs `terragrunt run-all apply` from the `terraform/` directory.
3. THE Makefile SHALL define a `destroy` target that runs `terragrunt run-all destroy` from the `terraform/` directory.
4. THE Makefile SHALL remove the `ls-create-service`, `ls-create-cert`, `ls-attach-domain`, and `ls-dns-setup` targets that are now managed by Terraform.
5. THE Makefile SHALL retain the `build`, `ls-push`, `ls-deploy`, `deploy`, `ls-status`, and `ls-logs` targets for imperative operations.

### Requirement 8: State Import

**User Story:** As a developer, I want existing Lightsail resources imported into Terraform state, so that the first `apply` does not attempt to recreate resources that already exist.

#### Acceptance Criteria

1. THE project SHALL provide documentation or a script listing `terraform import` commands for the existing Lightsail container service, Lightsail certificate, and Route53 CNAME record.
2. WHEN `terragrunt run-all plan` is executed after import, THE plan output SHALL show no resource creation or destruction for already-existing resources.
3. THE import process SHALL use the existing State_Bucket and Lock_Table for remote state storage.

### Requirement 9: Remote State Configuration

**User Story:** As a developer, I want the new modules to reuse the existing S3 state bucket and DynamoDB lock table, so that no new backend infrastructure is needed.

#### Acceptance Criteria

1. THE Root_Terragrunt SHALL configure remote state using the S3 bucket `scion-chargen-terraform-state-us-east-2`.
2. THE Root_Terragrunt SHALL configure state locking using the DynamoDB table `scion-chargen-terraform-locks`.
3. THE Root_Terragrunt SHALL set the state key to `{module_path}/terraform.tfstate` where `{module_path}` is the relative path from the terraform root to each child module.
