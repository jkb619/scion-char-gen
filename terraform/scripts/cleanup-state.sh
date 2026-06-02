#!/usr/bin/env bash
set -euo pipefail

# AWS Authentication
export AWS_SHARED_CREDENTIALS_FILE=~/.aws/credentials-composite
export AWS_PROFILE=tulta-admin

# Configuration
STATE_BUCKET="scion-chargen-terraform-state-us-east-2"
LOCK_TABLE="scion-chargen-terraform-locks"
AWS_REGION="us-east-2"

# State paths for removed modules
STATE_PATHS=(
  "alb/terraform.tfstate"
  "certificate/terraform.tfstate"
  "ecs/service/terraform.tfstate"
  "vpc/terraform.tfstate"
  "vpc/endpoints/terraform.tfstate"
  "security-groups/terraform.tfstate"
  "iam/execution-role/terraform.tfstate"
  "iam/task-role/terraform.tfstate"
  "kms/terraform.tfstate"
  "secrets-manager/terraform.tfstate"
)

# Show what will be deleted and prompt for confirmation
echo "This script will delete the following state files from S3 and their DynamoDB lock entries:"
for path in "${STATE_PATHS[@]}"; do echo "  - s3://$STATE_BUCKET/$path"; done
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then echo "Aborted."; exit 1; fi

# Delete each S3 state object and its DynamoDB lock entry
for path in "${STATE_PATHS[@]}"; do
  echo "Deleting s3://$STATE_BUCKET/$path ..."
  aws s3 rm "s3://$STATE_BUCKET/$path" --region "$AWS_REGION" || true

  # DynamoDB lock key is the full bucket/key path
  LOCK_KEY="scion-chargen-terraform-state-us-east-2/$path"
  echo "Removing DynamoDB lock entry: $LOCK_KEY ..."
  aws dynamodb delete-item \
    --table-name "$LOCK_TABLE" \
    --key "{\"LockID\": {\"S\": \"$LOCK_KEY\"}}" \
    --region "$AWS_REGION" || true
done

echo ""
echo "State cleanup complete. All orphaned state files and lock entries have been removed."
