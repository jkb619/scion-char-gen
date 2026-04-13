# Discover subnets in an existing VPC. "Public"/"private" lists here follow the subnet attribute
# map_public_ip_on_launch only—not route tables. Internet-facing ALB eligibility is decided by AWS
# from each subnet's associated route table (0.0.0.0/0 → Internet Gateway); subnets with
# map_public_ip_on_launch=false can still satisfy that if their routes point to an IGW.
data "aws_vpc" "this" {
  id = var.vpc_id
}

data "aws_subnets" "in_vpc" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.this.id]
  }
}

data "aws_subnet" "detail" {
  for_each = toset(data.aws_subnets.in_vpc.ids)
  id       = each.value
}

data "aws_route_tables" "vpc" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.this.id]
  }
}

data "aws_route_table" "by_id" {
  for_each       = toset(data.aws_route_tables.vpc.ids)
  route_table_id = each.value
}

locals {
  public_subnet_ids = sort([
    for id, s in data.aws_subnet.detail : id if s.map_public_ip_on_launch
  ])
  private_subnet_ids = sort([
    for id, s in data.aws_subnet.detail : id if !s.map_public_ip_on_launch
  ])

  public_subnet_arns = [
    for id in local.public_subnet_ids : data.aws_subnet.detail[id].arn
  ]
  private_subnet_arns = [
    for id in local.private_subnet_ids : data.aws_subnet.detail[id].arn
  ]

  # Fargate / interface endpoints: prefer private subnets; many account VPCs are public-only (no "private" by map_public_ip).
  fargate_subnet_ids = length(local.private_subnet_ids) > 0 ? local.private_subnet_ids : local.public_subnet_ids
  # Tasks in public subnets need a public IP for ECR pull unless you add interface endpoints for ECR.
  fargate_assign_public_ip = length(local.private_subnet_ids) == 0 && length(local.public_subnet_ids) > 0

  # Interface VPC endpoints: at most one subnet per AZ per endpoint (DuplicateSubnetsInSameZone if you pass two subnets in the same AZ).
  fargate_subnet_ids_by_az = {
    for az in distinct([for sid in local.fargate_subnet_ids : data.aws_subnet.detail[sid].availability_zone]) :
    az => sort([for sid in local.fargate_subnet_ids : sid if data.aws_subnet.detail[sid].availability_zone == az])[0]
  }
  fargate_interface_endpoint_subnet_ids = [for az in sort(keys(local.fargate_subnet_ids_by_az)) : local.fargate_subnet_ids_by_az[az]]

  # Internet-facing ALB: prefer subnets explicitly tied to a route table whose default route is 0.0.0.0/0 -> igw-*.
  # map_public_ip_on_launch alone is wrong when some "private" subnets use the main table (NAT) and others use an IGW table (same map_public flag).
  route_table_has_igw_internet = {
    for rt_id, rt in data.aws_route_table.by_id : rt_id => (
      length([
        for r in rt.routes : true
        if coalesce(try(r.cidr_block, null), try(r.destination_cidr_block, null), "") == "0.0.0.0/0"
        && startswith(trimspace(try(r.gateway_id, "")), "igw-")
      ]) > 0
    )
  }
  # Associations can include rows with subnet_id "" (e.g. gateway-only); skip those so we never index data.aws_subnet.detail[""].
  subnets_explicit_igw_internet = compact(distinct(flatten([
    for rt_id, rt in data.aws_route_table.by_id : [
      for a in rt.associations :
      a.subnet_id
      if try(trimspace(a.subnet_id), "") != "" && try(a.main, false) == false && local.route_table_has_igw_internet[rt_id]
    ]
  ])))
  az_to_igw_route_subnet_ids = {
    for az in distinct([for sid in local.subnets_explicit_igw_internet : data.aws_subnet.detail[sid].availability_zone]) :
    az => sort([for sid in local.subnets_explicit_igw_internet : sid if data.aws_subnet.detail[sid].availability_zone == az])[0]
  }
  alb_subnet_ids_from_igw_routes = length(keys(local.az_to_igw_route_subnet_ids)) >= 2 ? [for az in sort(keys(local.az_to_igw_route_subnet_ids)) : local.az_to_igw_route_subnet_ids[az]] : []

  az_to_public_ids = {
    for az in distinct([for id, s in data.aws_subnet.detail : s.availability_zone if s.map_public_ip_on_launch]) :
    az => sort([
      for id, s in data.aws_subnet.detail : id
      if s.availability_zone == az && s.map_public_ip_on_launch
    ])
  }
  alb_subnet_ids_from_public = length(keys(local.az_to_public_ids)) >= 2 ? [for az in sort(keys(local.az_to_public_ids)) : local.az_to_public_ids[az][0]] : []

  az_to_private_ids = {
    for az in distinct([for id, s in data.aws_subnet.detail : s.availability_zone if !s.map_public_ip_on_launch]) :
    az => sort([
      for id, s in data.aws_subnet.detail : id
      if s.availability_zone == az && !s.map_public_ip_on_launch
    ])
  }
  alb_subnet_ids_from_private = length(keys(local.az_to_private_ids)) >= 2 ? [for az in sort(keys(local.az_to_private_ids)) : local.az_to_private_ids[az][0]] : []

  alb_subnet_ids_auto = length(local.alb_subnet_ids_from_igw_routes) >= 2 ? local.alb_subnet_ids_from_igw_routes : (
    length(local.alb_subnet_ids_from_private) >= 2 ? local.alb_subnet_ids_from_private : local.alb_subnet_ids_from_public
  )

  alb_subnet_ids = length(var.alb_subnet_ids) >= 2 ? sort(var.alb_subnet_ids) : local.alb_subnet_ids_auto
}

resource "terraform_data" "require_subnets" {
  lifecycle {
    precondition {
      condition     = length(local.fargate_subnet_ids) > 0
      error_message = "VPC has no subnets; cannot place ECS or VPC endpoints."
    }
  }
}

resource "terraform_data" "require_alb_subnets" {
  lifecycle {
    precondition {
      condition     = length(local.alb_subnet_ids) >= 2
      error_message = <<-EOT
        Internet-facing ALB needs at least two subnets in two different Availability Zones. AWS checks each subnet's route table (not only map_public_ip_on_launch): the subnet must be able to use a default route to an Internet Gateway for an internet-facing load balancer.

        This VPC has ${length(local.public_subnet_ids)} subnet(s) with map_public_ip_on_launch=true and ${length(local.private_subnet_ids)} with map_public_ip_on_launch=false. Derived ALB subnet count: ${length(local.alb_subnet_ids)}.

        Fix: ensure at least two AZs each have a subnet the ALB can use (and that those subnets' route tables support internet-facing ALB per AWS), or set globals locals alb_subnet_ids to two explicit subnet IDs.
      EOT
    }
  }
}
