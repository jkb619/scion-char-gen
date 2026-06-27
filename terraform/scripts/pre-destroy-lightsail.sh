#!/usr/bin/env bash
# Detach Lightsail TLS cert from the container service before Terraform deletes the certificate.
# AWS returns InvalidInputException ("Certificate which is in Use") if this step is skipped.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="${LIGHTSAIL_SERVICE:-scion-chargen}"
REGION="${AWS_REGION:-us-east-2}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found; skip Lightsail pre-destroy." >&2
  exit 0
fi

set +e
aws lightsail get-container-services --service-name "$SERVICE" --region "$REGION" --no-cli-pager >/dev/null 2>&1
found=$?
set -e

if [[ "$found" -ne 0 ]]; then
  echo "Lightsail service '$SERVICE' not found in $REGION (nothing to detach)."
  exit 0
fi

echo "Detaching custom domain / certificate from Lightsail service '$SERVICE'…"
if ! aws lightsail update-container-service \
  --service-name "$SERVICE" \
  --region "$REGION" \
  --public-domain-names '{}' \
  --no-cli-pager; then
  echo "Warning: could not clear public-domain-names (service may already be deleting)." >&2
fi

# Brief pause so DeleteCertificate succeeds after detach propagates.
sleep 8
echo "Lightsail pre-destroy detach complete."
