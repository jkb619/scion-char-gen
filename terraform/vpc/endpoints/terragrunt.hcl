# VPC interface endpoints for AWS APIs used at task startup (Secrets Manager, ECR, S3, CloudWatch Logs).
# Keeps that traffic on PrivateLink inside the VPC. Subnets follow fargate_subnet_ids (public when the VPC has public subnets). If tasks are on private subnets without a public IP, confirm those subnets have 0.0.0.0/0 -> NAT (or rely on these endpoints instead of the public internet).
terraform {
  # v5.8.1+ passes aws_vpc_endpoint.dns_options; S3 interface needs private_dns_only_for_inbound_resolver_endpoint=false unless a matching S3 gateway exists (AWS).
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-vpc.git//modules/vpc-endpoints?ref=v5.8.1"
}

include "root" {
  path = "../../terragrunt.hcl"
}

dependency "vpc" {
  config_path = ".."

  mock_outputs = {
    vpc_id                    = "vpc-12345678"
    vpc_cidr_block            = "10.0.0.0/16"
    private_subnets           = ["subnet-23456789", "subnet-98764321"]
    public_subnets            = ["subnet-11111111", "subnet-22222222"]
    fargate_subnet_ids                     = ["subnet-11111111", "subnet-22222222"]
    fargate_interface_endpoint_subnet_ids  = ["subnet-11111111", "subnet-22222222"]
    fargate_assign_public_ip               = true
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

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
}

inputs = {
  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.fargate_interface_endpoint_subnet_ids

  create_security_group = true
  security_group_name   = "${local.project_name}-vpc-endpoints-sg"
  security_group_rules = {
    ingress_https_from_ecs = {
      type                     = "ingress"
      from_port                = 443
      to_port                  = 443
      protocol                 = "tcp"
      source_security_group_id = dependency.ecs_sg.outputs.security_group_id
      description              = "HTTPS from ECS tasks"
    }
    ingress_https_from_vpc = {
      type        = "ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [dependency.vpc.outputs.vpc_cidr_block]
      description = "HTTPS from VPC (fallback)"
    }
    egress_all = {
      type        = "egress"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
      description = "All outbound traffic"
    }
  }

  endpoints = {
    # Interface endpoints only (S3 gateway can hit RouteNotSupported on some route tables; S3 PrivateLink avoids route table edits).
    secretsmanager = {
      service             = "secretsmanager"
      private_dns_enabled = true
    }
    ecr_api = {
      service             = "ecr.api"
      private_dns_enabled = true
    }
    ecr_dkr = {
      service             = "ecr.dkr"
      private_dns_enabled = true
    }
    # awslogs driver + ECS Exec validation reach logs.<region>.amazonaws.com over private network
    logs = {
      service             = "logs"
      private_dns_enabled = true
    }
    s3 = {
      service             = "s3"
      private_dns_enabled = true
      dns_options = {
        private_dns_only_for_inbound_resolver_endpoint = false
      }
    }
  }

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-vpc-endpoints"
    Type = "vpc-endpoints"
  })
}
