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

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
}

inputs = {
  name        = "${local.project_name}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = dependency.vpc.outputs.vpc_id

  ingress_cidr_blocks = ["0.0.0.0/0"]
  ingress_rules       = ["http-80-tcp", "https-443-tcp"]

  egress_rules = ["all-all"]

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-alb-sg"
    Type = "alb"
  })
}
