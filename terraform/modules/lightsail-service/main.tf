resource "aws_lightsail_container_service" "this" {
  name  = var.service_name
  power = var.power
  scale = var.scale
  tags  = var.tags

  dynamic "public_domain_names" {
    for_each = var.certificate_name != null && var.domain_name != null ? [1] : []
    content {
      certificate {
        certificate_name = var.certificate_name
        domain_names     = [var.domain_name]
      }
    }
  }
}
