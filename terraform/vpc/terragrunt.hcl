# Existing VPC — subnets discovered in modules/existing-vpc (replaces hrmobile's new VPC module).
terraform {
  source = "../modules/existing-vpc//"
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
  vpc_id         = local.global_variables.locals.existing_vpc_id
  alb_subnet_ids = try(local.global_variables.locals.alb_subnet_ids, [])
}
