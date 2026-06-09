# The aws_lightsail_container_service_public_domain_names resource was removed
# in AWS provider v6.x. Public domain names are now configured directly on the
# aws_lightsail_container_service resource via the public_domain_names block.
#
# This module is retained as a no-op for Terragrunt dependency graph compatibility.
# The actual domain attachment is handled by the lightsail-service module.

resource "terraform_data" "domain_note" {
  input = "Domain '${var.domain_name}' is attached via the lightsail-service module's public_domain_names block."
}
