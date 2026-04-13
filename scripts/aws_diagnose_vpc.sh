#!/usr/bin/env bash
# Print subnets, route tables (incl. 0.0.0.0/0), IGW, and NAT for one VPC.
# Usage: AWS_PROFILE=... ./scripts/aws_diagnose_vpc.sh
#        VPC_ID=vpc-xxx AWS_REGION=us-east-2 ./scripts/aws_diagnose_vpc.sh

set -euo pipefail

VPC_ID="${VPC_ID:-vpc-08abca3842f01b511}"
REGION="${AWS_REGION:-us-east-2}"
export AWS_DEFAULT_REGION="$REGION"

echo "========== VPC =========="
aws ec2 describe-vpcs --vpc-ids "$VPC_ID" \
  --query 'Vpcs[0].{VpcId:VpcId,CidrBlock:CidrBlock,State:State,DnsHostnames:DnsHostnames,DnsSupport:DnsSupport}' \
  --output table

echo
echo "========== Internet gateways (attached to this VPC) =========="
aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
  --query 'InternetGateways[*].InternetGatewayId' --output text | tr '\t' '\n' | sed '/^$/d' || true
IGW_COUNT=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'length(InternetGateways)' --output text)
echo "(count: ${IGW_COUNT:-0})"

echo
echo "========== NAT gateways =========="
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" \
  --query 'NatGateways[*].{NatId:NatGatewayId,State:State,Subnet:SubnetId,PublicIp:NatGatewayAddresses[0].PublicIp,PrivateIp:NatGatewayAddresses[0].PrivateIp}' \
  --output table 2>/dev/null || echo "(none or error)"

echo
echo "========== Subnets =========="
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]' \
  --output table

echo
echo "========== Route tables (all in VPC) — 0.0.0.0/0 must be igw-* for public/ALB tier, nat-* for private tier =========="
for rtb in $(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[].RouteTableId' --output text); do
  [[ -z "$rtb" ]] && continue
  echo "--- RouteTable $rtb ---"
  aws ec2 describe-route-tables --route-table-ids "$rtb" \
    --query 'RouteTables[0].Associations[*].[SubnetId,Main]' --output table 2>/dev/null || true
  aws ec2 describe-route-tables --route-table-ids "$rtb" \
    --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0`]' --output table 2>/dev/null || true
done

echo
echo "========== Per-subnet effective route table (explicit association only) =========="
while read -r sid; do
  [[ -z "$sid" ]] && continue
  echo "--- Subnet $sid ---"
  RT=$(aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$sid" --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || true)
  if [[ -z "$RT" || "$RT" == "None" ]]; then
    echo "  (no explicit association shown — subnet may use the VPC main route table; check 'main' table above)"
  else
    echo "  RouteTableId: $RT"
    aws ec2 describe-route-tables --route-table-ids "$RT" \
      --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0`]' --output table 2>/dev/null || true
  fi
done < <(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text | tr '\t' '\n')

echo
echo "========== What to verify =========="
echo "1) Internet-facing ALB subnets: route table must have 0.0.0.0/0 -> igw-* (not only nat-*)."
echo "2) Private ECS subnets: 0.0.0.0/0 -> nat-* is normal; NAT must sit in a subnet with 0.0.0.0/0 -> igw-*."
echo "3) IGW count should be >= 1 and attached to this VPC."
