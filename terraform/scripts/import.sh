#!/usr/bin/env bash
set -euo pipefail

# AWS authentication
export AWS_SHARED_CREDENTIALS_FILE=~/.aws/credentials-composite
export AWS_PROFILE=tulta-admin

# Resolve script and terraform directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

echo "Importing lightsail-service..."
cd "$TERRAFORM_DIR/lightsail-service"
terragrunt import aws_lightsail_container_service.this scion-chargen

echo "Importing lightsail-certificate..."
cd "$TERRAFORM_DIR/lightsail-certificate"
terragrunt import aws_lightsail_certificate.this tulta-munille-cert

echo "Importing lightsail-domain..."
cd "$TERRAFORM_DIR/lightsail-domain"
terragrunt import aws_lightsail_container_service_public_domain_names.this scion-chargen

echo "Importing route53 CNAME record..."
cd "$TERRAFORM_DIR/route53"
terragrunt import 'module.records.aws_route53_record.this["scion-chargen CNAME"]' Z04505901JV6BMGXU7TJT_scion-chargen.tulta-munille.com_CNAME

echo "All imports completed successfully."
