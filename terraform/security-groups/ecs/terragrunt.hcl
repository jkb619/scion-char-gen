terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-security-group.git//?ref=v5.1.0"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependency "vpc" {
  config_path = "../../vpc"

  mock_outputs = {
    vpc_id          = "vpc-12345678"
    vpc_cidr_block  = "10.0.0.0/16"
    public_subnets  = ["subnet-11111111", "subnet-22222222"]
    private_subnets = ["subnet-33333333", "subnet-44444444"]
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "alb_sg" {
  config_path = "../alb"

  mock_outputs = {
    security_group_id = "sg-12345678"
  }
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
  container_port   = local.global_variables.locals.container_port
}

inputs = {
  name        = "${local.project_name}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = dependency.vpc.outputs.vpc_id

  ingress_with_source_security_group_id = [
    {
      from_port                = local.container_port
      to_port                  = local.container_port
      protocol                 = "tcp"
      description              = "HTTP from ALB"
      source_security_group_id = dependency.alb_sg.outputs.security_group_id
    }
  ]

  egress_rules = ["all-all"]

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-ecs-sg"
    Type = "ecs"
  })
}
