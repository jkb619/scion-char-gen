output "certificate_name" {
  description = "Name of the issued certificate"
  value       = aws_lightsail_certificate.this.name
}
