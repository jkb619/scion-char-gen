# Output names mirror terraform-aws-modules/terraform-aws-vpc for drop-in compatibility with hrmobile stacks.
output "vpc_id" {
  description = "The ID of the VPC"
  value       = data.aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = data.aws_vpc.this.cidr_block
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = local.public_subnet_ids
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = local.private_subnet_ids
}

output "public_subnet_arns" {
  description = "List of ARNs of public subnets"
  value       = local.public_subnet_arns
}

output "private_subnet_arns" {
  description = "List of ARNs of private subnets"
  value       = local.private_subnet_arns
}

output "fargate_subnet_ids" {
  description = "Subnet IDs for Fargate and interface VPC endpoints: private subnets if any, else public"
  value       = local.fargate_subnet_ids
}

output "fargate_interface_endpoint_subnet_ids" {
  description = "One subnet per AZ derived from fargate_subnet_ids; required for interface VPC endpoints (no duplicate AZ)"
  value       = local.fargate_interface_endpoint_subnet_ids
}

output "fargate_assign_public_ip" {
  description = "Set true on ECS when tasks run in public subnets (no private subnets detected)"
  value       = local.fargate_assign_public_ip
}

output "alb_subnet_ids" {
  description = "Subnet IDs for an internet-facing ALB (>=2 AZs): explicit var.alb_subnet_ids if set, else subnets explicitly associated to a route table with 0.0.0.0/0->igw-* (one per AZ), else map_public heuristics."
  value       = local.alb_subnet_ids
}
