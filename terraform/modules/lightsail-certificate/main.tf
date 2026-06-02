resource "aws_lightsail_certificate" "this" {
  name        = var.certificate_name
  domain_name = var.domain_name
}
