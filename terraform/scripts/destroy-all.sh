#!/usr/bin/env bash
# Ordered terragrunt destroy — certificate last, after container service is gone or detached.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export AWS_REGION="${AWS_REGION:-us-east-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"

AUTO="${TERRAGRUNT_DESTROY_AUTO:-1}"
TG_DESTROY=(destroy --terragrunt-ignore-dependency-errors --terragrunt-non-interactive)
if [[ "$AUTO" == "1" ]]; then
  TG_DESTROY+=(-auto-approve)
fi

bash "$ROOT/scripts/pre-destroy-lightsail.sh"

cd "$ROOT"

MODULES=(
  route53
  lightsail-domain
  lightsail-service
  lightsail-certificate
  ssm-llm-keys
)

for mod in "${MODULES[@]}"; do
  if [[ ! -d "$ROOT/$mod" ]]; then
    continue
  fi
  echo ""
  echo "=== terragrunt destroy: $mod ==="
  (cd "$ROOT/$mod" && terragrunt "${TG_DESTROY[@]}")
done

echo ""
echo "Terragrunt destroy finished."
