resource "aws_lightsail_container_service_public_domain_names" "this" {
  service_name = var.service_name

  public_domain_names {
    certificate {
      certificate_name = var.certificate_name
      domain_names     = [var.domain_name]
    }
  }
}
