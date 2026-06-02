# Shared locals for child terragrunt.hcl files (read via read_terragrunt_config).
# aws_region must stay us-east-2 for this project (remote state bucket, Makefile AWS_REGION).
# Adjust route53_* and lightsail_* locals to match your public zone and Lightsail configuration.
locals {
  aws_region     = "us-east-2"
  aws_account_id = "373055206579"
  project_name   = "scion-chargen"
  environment    = "production"

  common_tags = {
    Project     = "scion-chargen"
    Environment = "production"
    ManagedBy   = "terragrunt"
  }

  # Lightsail container service configuration
  lightsail_service_name     = "scion-chargen"
  lightsail_power            = "nano"
  lightsail_scale            = 1
  lightsail_domain           = "scion-chargen.tulta-munille.com"
  lightsail_certificate_name = "tulta-munille-cert"

  # Route53: route53_zone_id must be the *public* hosted zone for this domain (delegated at registrar).
  route53_zone_id     = "Z04505901JV6BMGXU7TJT"
  route53_zone_name   = "tulta-munille.com"
  route53_record_name = "scion-chargen"
}
