output "service_name" {
  description = "Name of the container service"
  value       = aws_lightsail_container_service.this.name
}

output "url" {
  description = "Public URL of the service"
  value       = aws_lightsail_container_service.this.url
}
