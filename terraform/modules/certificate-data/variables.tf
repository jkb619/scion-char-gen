variable "domain_name" {
  description = "Primary domain (or SAN) of an ISSUED ACM cert in this region; ignored when acm_certificate_arn is set."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "Optional: use this ARN directly instead of data.aws_acm_certificate (no AWS lookup)."
  type        = string
  default     = ""

  validation {
    condition     = var.acm_certificate_arn == "" || can(regex("^arn:aws:acm:", var.acm_certificate_arn))
    error_message = "acm_certificate_arn must be empty or a valid ACM certificate ARN."
  }
}
