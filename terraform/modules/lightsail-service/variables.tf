variable "service_name" {
  description = "Lightsail container service name"
  type        = string
}

variable "power" {
  description = "Container service power tier"
  type        = string
  default     = "nano"
}

variable "scale" {
  description = "Number of running instances"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

variable "certificate_name" {
  description = "Certificate name for public domain attachment (omit to skip domain config)"
  type        = string
  default     = null
}

variable "domain_name" {
  description = "Public domain name to attach (requires certificate_name)"
  type        = string
  default     = null
}
