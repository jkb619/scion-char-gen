variable "vpc_id" {
  description = "Existing VPC ID (no new VPC is created)."
  type        = string
}

variable "alb_subnet_ids" {
  description = "Optional: at least two subnet IDs in different AZs for an internet-facing ALB. When empty, one subnet per AZ is chosen automatically: prefers map_public_ip_on_launch=false, else true. AWS decides internet-facing ALB suitability from each subnet's route table (0.0.0.0/0 to an Internet Gateway), which can hold even when map_public_ip_on_launch is false."
  type        = list(string)
  default     = []
}
