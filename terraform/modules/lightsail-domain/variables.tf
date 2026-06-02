variable "service_name" {
  description = "Lightsail container service name"
  type        = string
}

variable "certificate_name" {
  description = "Certificate name to use for domain attachment"
  type        = string
}

variable "domain_name" {
  description = "Domain to attach to the Lightsail container service"
  type        = string
}
