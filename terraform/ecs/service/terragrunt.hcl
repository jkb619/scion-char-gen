# ECS cluster + Fargate service (no RDS; FastAPI on container port from globals).
terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-ecs.git//?ref=v6.7.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "execution_role" {
  config_path = "../../iam/execution-role"

  mock_outputs = {
    arn = "arn:aws:iam::373055206579:role/scion-chargen-ecs-execution-role"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "task_role" {
  config_path = "../../iam/task-role"

  mock_outputs = {
    arn = "arn:aws:iam::373055206579:role/scion-chargen-ecs-task-role"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "vpc" {
  config_path = "../../vpc"

  mock_outputs = {
    vpc_id                 = "vpc-12345678"
    vpc_cidr_block         = "10.0.0.0/16"
    public_subnets         = ["subnet-11111111", "subnet-22222222"]
    private_subnets        = ["subnet-33333333", "subnet-44444444"]
    fargate_subnet_ids     = ["subnet-33333333", "subnet-44444444"]
    fargate_assign_public_ip = false
    public_subnet_arns = [
      "arn:aws:ec2:us-east-2:373055206579:subnet/subnet-11111111",
      "arn:aws:ec2:us-east-2:373055206579:subnet/subnet-22222222"
    ]
    private_subnet_arns = [
      "arn:aws:ec2:us-east-2:373055206579:subnet/subnet-33333333",
      "arn:aws:ec2:us-east-2:373055206579:subnet/subnet-44444444"
    ]
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "alb" {
  config_path = "../../alb"

  mock_outputs = {
    alb_arn                   = "arn:aws:elasticloadbalancing:us-east-2:373055206579:loadbalancer/app/scion-chargen-alb/1234567890123456"
    alb_dns_name              = "scion-chargen-alb-1234567890.us-east-2.elb.amazonaws.com"
    alb_zone_id               = "Z3AADJGX6KTTL2"
    alb_hosted_zone_id        = "Z3AADJGX6KTTL2"
    target_group_arns         = ["arn:aws:elasticloadbalancing:us-east-2:373055206579:targetgroup/scion-chargen-tg/1234567890123456"]
    target_group_arn_suffixes = ["targetgroup/scion-chargen-tg/1234567890123456"]
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "alb_sg" {
  config_path = "../../security-groups/alb"

  mock_outputs = {
    security_group_id = "sg-12345678"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "ecs_sg" {
  config_path = "../../security-groups/ecs"

  mock_outputs = {
    security_group_id = "sg-12345679"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "secrets_manager" {
  config_path = "../../secrets-manager"

  mock_outputs = {
    secret_arn = "arn:aws:secretsmanager:us-east-2:373055206579:secret:scion-chargen-secrets-abcdef"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "vpc_endpoints" {
  config_path = "../../vpc/endpoints"

  mock_outputs = {}

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
  container_name   = local.global_variables.locals.container_name
  container_port   = local.global_variables.locals.container_port
  aws_account_id   = local.global_variables.locals.aws_account_id
  aws_region       = local.global_variables.locals.aws_region
}

inputs = {
  cluster_name = "${local.project_name}-cluster"

  cluster_configuration = {
    execute_command_configuration = {
      logging = "OVERRIDE"
      log_configuration = {
        cloud_watch_log_group_name = "/aws/ecs/${local.project_name}-cluster"
      }
    }
  }

  default_capacity_provider_strategy = {
    FARGATE_SPOT = {
      name   = "FARGATE_SPOT"
      weight = 100
      base   = 0
    }
  }

  services = {
    "${local.project_name}-service" = {
      cpu    = 512
      memory = 1024

      infrastructure_iam_role_arn = dependency.task_role.outputs.arn
      tasks_iam_role_arn          = dependency.task_role.outputs.arn

      subnet_ids       = dependency.vpc.outputs.fargate_subnet_ids
      assign_public_ip = dependency.vpc.outputs.fargate_assign_public_ip
      create_security_group = false
      security_group_ids    = [dependency.ecs_sg.outputs.security_group_id]

      load_balancer = {
        service = {
          target_group_arn = dependency.alb.outputs.target_group_arns[0]
          container_name   = local.container_name
          container_port   = local.container_port
        }
      }

      capacity_provider_strategy = {
        FARGATE_SPOT = {
          capacity_provider = "FARGATE_SPOT"
          weight            = 100
          base              = 0
        }
      }

      desired_count          = 1
      enable_execute_command = true
      task_exec_iam_role_arn = dependency.execution_role.outputs.arn
      task_role_arn          = dependency.task_role.outputs.arn

      create_task_exec_iam_role          = false
      create_tasks_iam_role              = false
      task_exec_iam_role_use_name_prefix = false
      iam_role_use_name_prefix           = false

      create_iam_role = false
      iam_role_arn    = dependency.task_role.outputs.arn

      create_iam_policy      = false
      create_iam_role_policy = false

      container_definitions = {
        "${local.container_name}" = {
          name      = local.container_name
          image     = "${local.aws_account_id}.dkr.ecr.${local.aws_region}.amazonaws.com/${local.project_name}:latest"
          cpu       = 512
          memory    = 1024
          essential = true

          portMappings = [
            {
              containerPort = local.container_port
              hostPort      = local.container_port
              protocol      = "tcp"
            }
          ]

          environment = [
            {
              name  = "SECRETS_MANAGER_ARN"
              value = dependency.secrets_manager.outputs.secret_arn
            }
          ]

          readonlyRootFilesystem = false
        }
      }
    }
  }

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-ecs"
    Type = "ecs"
  })
}
