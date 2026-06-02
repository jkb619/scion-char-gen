terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-route53.git//modules/records?ref=v3.1.0"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependency "lightsail_service" {
  config_path = "../lightsail-service"

  mock_outputs = {
    service_name = "scion-chargen"
    url          = "https://scion-chargen.abcdef123.us-east-2.cs.amazonlightsail.com"
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
      name    = local.gv.route53_record_name
      type    = "CNAME"
      ttl     = 300
      records = [replace(dependency.lightsail_service.outputs.url, "https://", "")]
    }
  ]

  tags = local.global_variables.locals.common_tags
}
