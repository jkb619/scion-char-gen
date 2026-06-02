resource "aws_lightsail_container_service" "this" {
  name  = var.service_name
  power = var.power
  scale = var.scale
  tags  = var.tags
}
