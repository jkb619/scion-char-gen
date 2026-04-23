# Shared locals for child terragrunt.hcl files (read via read_terragrunt_config).
# aws_region must stay us-east-2 for this project (ACM, remote state bucket, Makefile AWS_REGION).
# Adjust route53_* and acm_certificate_domain to match your public zone and issued ACM cert.
locals {
  aws_region = "us-east-2"
  aws_account_id = "373055206579"
  project_name   = "scion-chargen"
  environment    = "production"

  # Existing VPC (same as Makefile VPC_ID); subnets are discovered by modules/existing-vpc.
  existing_vpc_id = "vpc-08abca3842f01b511"

  # Optional: two+ subnet IDs for the internet-facing ALB (different AZs). Empty = auto-pick from the VPC.
  # If curl to the ALB DNS times out on :443, subnets must have 0.0.0.0/0 -> Internet Gateway (AWS "public subnet"). NAT-only default routes do not accept inbound internet to the ALB — set subnet IDs here (public tier). Fargate uses public subnets when the VPC has any; app traffic should use the ALB (ECS security group allows the app port only from the ALB security group).
  alb_subnet_ids = []

  common_tags = {
    Project     = "scion-chargen"
    Environment = "production"
    ManagedBy   = "terragrunt"
  }

  ecs_cluster_name = "scion-chargen-cluster"
  ecs_service_name = "scion-chargen-service"
  container_name   = "scion-chargen-app"
  container_port   = 8000

  alb_name = "scion-chargen-alb"

  alb_sg_name = "scion-chargen-alb-sg"
  ecs_sg_name = "scion-chargen-ecs-sg"

  # ACM for ALB HTTPS: set acm_certificate_arn (no AWS lookup) and/or acm_certificate_domain (ISSUED cert lookup).
  # When arn is set, domain is ignored by the certificate module.
  acm_certificate_domain = ""
  acm_certificate_arn      = "arn:aws:acm:us-east-2:373055206579:certificate/2d6cd592-76a3-458f-b5c2-d09c5536eca6"

  # Route53: route53_zone_id must be the *public* hosted zone for this domain (delegated at registrar), or the alias won’t match public DNS.
  route53_zone_id     = "Z04505901JV6BMGXU7TJT"
  route53_zone_name   = "tulta-munille.com"
  route53_record_name = "scion-chargen"
}
