terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-route53.git//modules/records?ref=v3.1.0"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependency "alb" {
  config_path = "../alb"

  mock_outputs = {
    lb_dns_name = "example-alb-123.us-east-2.elb.amazonaws.com"
    lb_zone_id  = "Z3AADJGX6KTTL2"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  gv               = local.global_variables.locals
  zone_id_raw      = try(local.gv.route53_zone_id, "")
  use_zone_id      = trimspace(local.zone_id_raw) != ""
}

inputs = {
  zone_id   = local.use_zone_id ? trimspace(local.zone_id_raw) : null
  zone_name = local.use_zone_id ? null : local.gv.route53_zone_name

  records = [
    {
      name = local.gv.route53_record_name
      type = "A"
      alias = {
        name                   = dependency.alb.outputs.lb_dns_name
        zone_id                = dependency.alb.outputs.lb_zone_id
        evaluate_target_health = true
      }
      ttl = null
    }
  ]

  tags = local.global_variables.locals.common_tags
}
