terraform {
  source = "../modules/lightsail-domain"
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
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
}

dependency "lightsail_certificate" {
  config_path = "../lightsail-certificate"

  mock_outputs = {
    certificate_name = "tulta-munille-cert"
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  gv               = local.global_variables.locals
}

inputs = {
  service_name     = dependency.lightsail_service.outputs.service_name
  certificate_name = dependency.lightsail_certificate.outputs.certificate_name
  domain_name      = local.gv.lightsail_domain
}
