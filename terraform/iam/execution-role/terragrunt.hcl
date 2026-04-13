terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-iam.git//modules/iam-role?ref=v6.2.2"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependency "kms" {
  config_path = "../../kms"

  mock_outputs = {
    key_arn = "arn:aws:kms:us-east-2:373055206579:key/12345678-1234-1234-1234-123456789012"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
  aws_account_id   = local.global_variables.locals.aws_account_id
  aws_region       = local.global_variables.locals.aws_region
}

inputs = {
  name            = "${local.project_name}-ecs-execution-role"
  description     = "ECS execution role for ${local.project_name} application"
  use_name_prefix = false

  trust_policy_permissions = {
    ECSAssumeRole = {
      actions = ["sts:AssumeRole"]
      principals = [
        {
          type        = "Service"
          identifiers = ["ecs-tasks.amazonaws.com"]
        }
      ]
    }
  }

  create_inline_policy = true
  attach_policies      = true

  policies = {
    EcsTaskExecution = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  }

  inline_policy_permissions = {
    SecretsManagerAccess = {
      sid    = "SecretsManagerAccess"
      effect = "Allow"
      actions = [
        "secretsmanager:GetSecretValue"
      ]
      resources = [
        "arn:aws:secretsmanager:${local.aws_region}:${local.aws_account_id}:secret:${local.project_name}-secrets-*"
      ]
    }
    KMSAccess = {
      sid    = "KMSAccess"
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey"
      ]
      resources = [
        dependency.kms.outputs.key_arn,
        "arn:aws:kms:${local.aws_region}:${local.aws_account_id}:key/*"
      ]
    }
    ECRAccess = {
      sid    = "ECRAccess"
      effect = "Allow"
      actions = [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ]
      resources = ["*"]
    }
    CloudWatchLogs = {
      sid    = "CloudWatchLogs"
      effect = "Allow"
      actions = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      resources = ["*"]
    }
  }

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-ecs-execution-role"
    Type = "iam"
  })
}
