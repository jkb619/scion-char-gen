terraform {
  source = "../modules/lightsail-service"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

dependencies {
  paths = ["../lightsail-certificate"]
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  gv               = local.global_variables.locals
}

inputs = {
  service_name     = local.gv.lightsail_service_name
  power            = local.gv.lightsail_power
  scale            = local.gv.lightsail_scale
  tags             = local.gv.common_tags
  certificate_name = local.gv.lightsail_certificate_name
  domain_name      = local.gv.lightsail_domain
}
