#!/usr/bin/env bash
# Remove an AWS Secrets Manager secret so the name can be reused immediately.
# - Active secret: force-delete without recovery window.
# - Secret scheduled for deletion (pending recovery): restore, then force-delete.
# Idempotent: succeeds if the secret does not exist.
#
# Usage: purge-secrets-manager-secret.sh <secret-id-or-name>
# Env:   AWS_REGION / AWS_DEFAULT_REGION (optional; uses AWS CLI default if unset)

set -euo pipefail

SECRET_ID="${1:?usage: $0 <secret-id-or-name>}"

if ! out="$(aws secretsmanager describe-secret --secret-id "$SECRET_ID" 2>&1)"; then
  if [[ "$out" == *"ResourceNotFoundException"* ]] || [[ "$out" == *"Secrets Manager can't find the specified secret"* ]]; then
    echo "purge-secrets-manager-secret: '$SECRET_ID' not found (already gone)."
    exit 0
  fi
  echo "$out" >&2
  exit 1
fi

deleted_date="$(aws secretsmanager describe-secret --secret-id "$SECRET_ID" --query 'DeletedDate' --output text 2>/dev/null || true)"
if [[ -n "$deleted_date" && "$deleted_date" != "None" && "$deleted_date" != "null" ]]; then
  echo "purge-secrets-manager-secret: '$SECRET_ID' is pending deletion; restoring then force-deleting."
  aws secretsmanager restore-secret --secret-id "$SECRET_ID" >/dev/null
fi

echo "purge-secrets-manager-secret: force-deleting '$SECRET_ID' (no recovery window)."
aws secretsmanager delete-secret --secret-id "$SECRET_ID" --force-delete-without-recovery >/dev/null
echo "purge-secrets-manager-secret: done."
