terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-kms.git//?ref=v4.1.1"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
  aws_region       = local.global_variables.locals.aws_region
  aws_account_id   = local.global_variables.locals.aws_account_id
  common_tags      = local.global_variables.locals.common_tags
}

inputs = {
  description             = "KMS key for ${local.project_name} encryption (Secrets Manager, etc.)"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  aliases = ["${local.project_name}-key"]

  key_usage                = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"

  key_policy_statements = [
    {
      sid    = "Enable IAM User Permissions"
      effect = "Allow"
      principals = [
        {
          type        = "AWS"
          identifiers = ["arn:aws:iam::${local.aws_account_id}:root"]
        }
      ]
      actions   = ["kms:*"]
      resources = ["*"]
    },
    {
      sid    = "Allow Secrets Manager"
      effect = "Allow"
      principals = [
        {
          type        = "Service"
          identifiers = ["secretsmanager.amazonaws.com"]
        }
      ]
      actions = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      resources = ["*"]
      condition = [
        {
          test     = "StringEquals"
          variable = "kms:ViaService"
          values   = ["secretsmanager.${local.aws_region}.amazonaws.com"]
        }
      ]
    }
  ]

  tags = merge(local.common_tags, {
    Name = "${local.project_name}-kms-key"
  })
}
