#!/usr/bin/env bash
set -euo pipefail

# Pull s3://$BUCKET/$REGISTRY_KEY → local apps/agent/agentcore/agents.yaml.
#
# Use this after edits made via the dashboard to re-sync the repo copy.
# `--dry-run` prints the diff and exits.
#
# Env:
#   AWS_PROFILE       (default: twhirzi)
#   AWS_REGION        (default: us-east-1)
#   BUCKET            (required — CDK output UploadsBucketName)
#   REGISTRY_KEY      (default: registry/agents.yaml)
#   REPO_YAML         (default: <repo>/apps/agent/agentcore/agents.yaml)

: "${AWS_PROFILE:=twhirzi}"
: "${AWS_REGION:=us-east-1}"
: "${REGISTRY_KEY:=registry/agents.yaml}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
: "${REPO_YAML:=$REPO_ROOT/apps/agent/agentcore/agents.yaml}"

if [[ -z "${BUCKET:-}" ]]; then
  echo "Error: BUCKET env var required (S3 uploads bucket)." >&2
  exit 1
fi

TARGET="s3://$BUCKET/$REGISTRY_KEY"
TMP=$(mktemp)
aws s3 cp "$TARGET" "$TMP" --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet

if diff -u "$REPO_YAML" "$TMP" > /tmp/registry-diff.log; then
  echo "No changes — $REPO_YAML is already in sync."
  rm -f "$TMP"
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  head -60 /tmp/registry-diff.log
  echo "..."
  echo "Full diff at /tmp/registry-diff.log"
  rm -f "$TMP"
  exit 0
fi

head -60 /tmp/registry-diff.log
echo "..."
echo "Full diff at /tmp/registry-diff.log"
echo
read -r -p "Overwrite local $REPO_YAML with remote? [y/N] " ans
case "$ans" in [yY]|[yY][eE][sS]) ;; *) echo "aborted"; rm -f "$TMP"; exit 1 ;; esac

mv "$TMP" "$REPO_YAML"
echo "Pulled $TARGET → $REPO_YAML"
