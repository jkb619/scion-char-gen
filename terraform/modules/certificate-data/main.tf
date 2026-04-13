locals {
  # Lookup by domain only when no explicit ARN is provided.
  lookup_by_domain = var.acm_certificate_arn == "" && var.domain_name != ""
}

resource "terraform_data" "require_cert_source" {
  lifecycle {
    precondition {
      condition = var.acm_certificate_arn != "" || (
        trimspace(var.domain_name) != "" &&
        !startswith(trimspace(var.domain_name), "REPLACE_")
      )
      error_message = "Set acm_certificate_arn or a real acm_certificate_domain (not the REPLACE_* placeholder) in terraform/globals.hcl before planning/applying the certificate stack."
    }
  }
}

data "aws_acm_certificate" "this" {
  count = local.lookup_by_domain ? 1 : 0

  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate (from lookup or input)"
  value       = local.lookup_by_domain ? data.aws_acm_certificate.this[0].arn : var.acm_certificate_arn
}

output "acm_certificate_domain" {
  description = "Domain on the certificate when resolved via lookup; empty when acm_certificate_arn was set directly"
  value       = local.lookup_by_domain ? data.aws_acm_certificate.this[0].domain : ""
}
