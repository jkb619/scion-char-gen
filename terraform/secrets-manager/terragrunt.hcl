# Application secret payload (JSON). Edit terraform/secrets/app-secret.json (gitignored copy) or this file pattern.
terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-secrets-manager.git//?ref=v1.1.2"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependency "kms" {
  config_path = "../kms"

  mock_outputs = {
    key_arn = "arn:aws:kms:us-east-2:373055206579:key/12345678-1234-1234-1234-123456789012"
  }
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
  _secret_file     = "${get_terragrunt_dir()}/../secrets/app-secret.json"
  _example_file    = "${get_terragrunt_dir()}/../secrets/app-secret.json.example"
  secret_path      = fileexists(local._secret_file) ? local._secret_file : local._example_file
  secret_json      = file(local.secret_path)
}

inputs = {
  name                    = "${local.project_name}-secrets"
  description             = "Secrets for ${local.project_name} application"
  recovery_window_in_days = 7
  kms_key_id              = dependency.kms.outputs.key_arn
  secret_string           = local.secret_json

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-secrets"
    Type = "secrets-manager"
  })
}
