# Root terragrunt.hcl — derived from magic-castle/hrmobile/terraform (remote state + generated provider).
# Stack region: us-east-2 (see terraform/globals.hcl locals.aws_region; keep in sync with Makefile AWS_REGION).
# Bootstrap (once per account/region): create S3 bucket and DynamoDB table referenced below, then run-all apply.
remote_state {
  backend = "s3"
  config = {
    bucket         = "scion-chargen-terraform-state-${get_env("AWS_REGION", "us-east-2")}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = get_env("AWS_REGION", "us-east-2")
    encrypt        = true
    dynamodb_table = "scion-chargen-terraform-locks"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.0"
  backend "s3" {}
}

variable "aws_region" {
  description = "The AWS region to deploy resources in"
  type        = string
  default     = "us-east-2"
}

provider "aws" {
  region = var.aws_region
}
EOF
}

locals {
  aws_region = get_env("AWS_REGION", "us-east-2")

  common_tags = {
    Project     = "scion-chargen"
    Environment = "production"
    ManagedBy   = "terragrunt"
  }

  project_name = "scion-chargen"
}

inputs = {
  aws_region   = local.aws_region
  project_name = local.project_name
  environment  = "production"
  common_tags  = local.common_tags
}
