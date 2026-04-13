terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-alb.git//?ref=v8.7.0"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependency "vpc" {
  config_path = "../vpc"

  mock_outputs = {
    vpc_id          = "vpc-12345678"
    vpc_cidr_block  = "10.0.0.0/16"
    public_subnets  = ["subnet-11111111", "subnet-22222222"]
    private_subnets = ["subnet-33333333", "subnet-44444444"]
    alb_subnet_ids  = ["subnet-11111111", "subnet-22222222"]
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

dependency "alb_sg" {
  config_path = "../security-groups/alb"

  mock_outputs = {
    security_group_id = "sg-12345678"
  }
}

dependency "certificate" {
  config_path = "../certificate"

  mock_outputs = {
    acm_certificate_arn = "arn:aws:acm:us-east-2:373055206579:certificate/12345678-1234-1234-1234-123456789012"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  project_name     = local.global_variables.locals.project_name
}

inputs = {
  name = "${local.project_name}-alb"

  load_balancer_type    = "application"
  internal              = false
  create_security_group = false
  security_groups       = [dependency.alb_sg.outputs.security_group_id]
  subnets               = dependency.vpc.outputs.alb_subnet_ids
  vpc_id                = dependency.vpc.outputs.vpc_id

  target_groups = [
    {
      name             = "${local.project_name}-tg"
      backend_protocol = "HTTP"
      backend_port     = local.global_variables.locals.container_port
      target_type      = "ip"
      vpc_id           = dependency.vpc.outputs.vpc_id

      health_check = {
        enabled             = true
        healthy_threshold   = 2
        unhealthy_threshold = 2
        timeout             = 5
        interval            = 30
        path                = "/"
        matcher             = "200"
        port                = "traffic-port"
        protocol            = "HTTP"
      }
    }
  ]

  https_listeners = [
    {
      port               = 443
      protocol           = "HTTPS"
      certificate_arn    = dependency.certificate.outputs.acm_certificate_arn
      target_group_index = 0
      ssl_policy         = "ELBSecurityPolicy-TLS13-1-2-2021-06"
    }
  ]

  http_tcp_listeners = [
    {
      port               = 80
      protocol           = "HTTP"
      target_group_index = 0
      action_type        = "redirect"
      redirect = {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  ]

  tags = merge(local.global_variables.locals.common_tags, {
    Name = "${local.project_name}-alb"
    Type = "alb"
  })
}
