terraform {
  source = "../modules/ssm-llm-keys"
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
  parameter_name = "/scion-chargen/production/llm-env"
  tags           = local.gv.common_tags
}
