terraform {
  source = "../modules/certificate-data//"
}

include "root" {
  path = find_in_parent_folders()
}

include "globals" {
  path = find_in_parent_folders("globals.hcl")
}

locals {
  global_variables = read_terragrunt_config(find_in_parent_folders("globals.hcl"))
}

inputs = {
  domain_name          = local.global_variables.locals.acm_certificate_domain
  acm_certificate_arn  = try(local.global_variables.locals.acm_certificate_arn, "")
}
