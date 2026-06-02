terraform {
  source = "../modules/lightsail-certificate"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
  gv               = local.global_variables.locals
}

inputs = {
  certificate_name = local.gv.lightsail_certificate_name
  domain_name      = local.gv.lightsail_domain
}
