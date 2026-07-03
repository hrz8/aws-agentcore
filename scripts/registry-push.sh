#!/usr/bin/env bash
set -euo pipefail

# Push local apps/agent/agentcore/agents.yaml → s3://$BUCKET/$REGISTRY_KEY.
#
# The S3 copy is the source of truth in deployed environments — the repo file
# can drift behind edits made through the dashboard. Prefer registry-pull.sh
# first if you're unsure which is newer, then diff, then push if intentional.
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
  echo "Error: BUCKET env var required (S3 uploads bucket, e.g. demoagent-dev-309789829970)." >&2
  echo "       Get it from CDK outputs (UploadsBucketName)." >&2
  exit 1
fi

if [[ ! -f "$REPO_YAML" ]]; then
  echo "Error: $REPO_YAML not found." >&2
  exit 1
fi

TARGET="s3://$BUCKET/$REGISTRY_KEY"

# If a remote copy exists, print a diff first so the user doesn't silently
# clobber changes made via the dashboard.
if aws s3api head-object \
     --profile "$AWS_PROFILE" --region "$AWS_REGION" \
     --bucket "$BUCKET" --key "$REGISTRY_KEY" >/dev/null 2>&1; then
  echo "Remote exists at $TARGET. Diff local -> remote:"
  TMP=$(mktemp)
  aws s3 cp "$TARGET" "$TMP" --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet
  if diff -u "$TMP" "$REPO_YAML" > /tmp/registry-diff.log; then
    echo "  (identical — nothing to push)"
    rm -f "$TMP"
    exit 0
  fi
  head -60 /tmp/registry-diff.log
  echo "..."
  echo "Full diff at /tmp/registry-diff.log"
  echo
  read -r -p "Overwrite remote with local? [y/N] " ans
  case "$ans" in [yY]|[yY][eE][sS]) ;; *) echo "aborted"; rm -f "$TMP"; exit 1 ;; esac
  rm -f "$TMP"
else
  echo "No remote copy at $TARGET yet — first-time seed."
fi

aws s3 cp "$REPO_YAML" "$TARGET" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --content-type application/yaml

echo "Pushed $REPO_YAML → $TARGET"
