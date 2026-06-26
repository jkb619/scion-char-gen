#!/usr/bin/env bash
# Push decrypted LLM keys from SOPS file to SSM for Lightsail deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOPS_FILE="${SOPS_FILE:-$ROOT/secrets/llm-keys.yaml}"
PARAM_NAME="${SSM_PARAM_NAME:-/scion-chargen/production/llm-env}"
AWS_REGION="${AWS_REGION:-us-east-2}"

if [[ ! -f "$SOPS_FILE" ]]; then
  echo "Missing $SOPS_FILE — copy secrets/llm-keys.yaml.example and encrypt with SOPS." >&2
  exit 1
fi

if ! command -v sops >/dev/null 2>&1; then
  echo "sops is required (https://github.com/getsops/sops)" >&2
  exit 1
fi

JSON="$(sops --decrypt "$SOPS_FILE" | python3 -c '
import json, sys
env = {}
for line in sys.stdin:
    line = line.strip()
    if not line or line.startswith("#") or ":" not in line:
        continue
    key, val = line.split(":", 1)
    key, val = key.strip(), val.strip().strip("\"'\''").strip()
    if key.startswith("SCION_LLM_"):
        env[key] = val
if not any(env.get(k) for k in ("SCION_LLM_OPENAI_API_KEY", "SCION_LLM_XAI_API_KEY")):
    sys.exit("No API keys found in SOPS file.")
print(json.dumps(env, separators=(",", ":")))
')"

aws ssm put-parameter \
  --region "$AWS_REGION" \
  --name "$PARAM_NAME" \
  --type SecureString \
  --value "$JSON" \
  --overwrite \
  --no-cli-pager

echo "Updated SSM parameter $PARAM_NAME"
