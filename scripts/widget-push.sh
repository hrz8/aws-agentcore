#!/usr/bin/env bash
set -euo pipefail

# Build apps/frontend widget and ship it to the S3 bucket fronted by the
# CloudFront distribution that `cdk deploy` provisions. Reads CFN outputs
# by ExportName for:
#   - PublicAssetsBucketName     → s3 sync target
#   - PublicAssetsDistributionId → cache invalidation target
#   - PublicAssetsDistributionUrl → for the final "open this" line
#
# Run this AFTER `cdk deploy` (which is what creates/updates those resources)
# and ANY time the widget source changes. No CDK redeploy needed for
# widget-only changes.
#
# Usage:
#   ./scripts/widget-push.sh [stage]
#
# Env overrides (defaults shown):
#   STAGE=Dev
#   STACK_NAME=${STAGE}-Nd8Stack
#   AWS_PROFILE=twhirzi          (only set when running locally; CI env creds win)
#   AWS_REGION=us-east-1

STAGE="${1:-${STAGE:-Dev}}"
STACK_NAME="${STACK_NAME:-${STAGE}-Nd8Stack}"
: "${AWS_REGION:=us-east-1}"
export AWS_REGION

# Only default to a named profile when running locally. In CI,
# aws-actions/configure-aws-credentials provides AWS_ACCESS_KEY_ID +
# AWS_SESSION_TOKEN via env — forcing AWS_PROFILE would clobber that.
if [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  : "${AWS_PROFILE:=twhirzi}"
  export AWS_PROFILE
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIDGET_DIR="$REPO_ROOT/apps/frontend"
DIST_DIR="$WIDGET_DIR/dist-widget"

for cmd in aws jq pnpm; do
  command -v "$cmd" >/dev/null || { echo "missing dependency: $cmd" >&2; exit 1; }
done

echo "Stage   : $STAGE"
echo "Stack   : $STACK_NAME"
echo "Profile : ${AWS_PROFILE:-<env credentials>} ($AWS_REGION)"
echo

outputs_json="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output json)"

# Match by ExportName — those are deterministic `${stage}-nd8-<Name>` strings
# set explicitly in the CDK constructs.
get_output() {
  local name="$1"
  local export_name="${STAGE}-nd8-${name}"
  local value
  value="$(jq -r --arg e "$export_name" \
    '.[] | select(.ExportName == $e) | .OutputValue' \
    <<<"$outputs_json" | head -n1)"
  if [[ -z "$value" || "$value" == "null" ]]; then
    echo "stack $STACK_NAME has no output with ExportName '$export_name'" >&2
    exit 1
  fi
  printf '%s' "$value"
}

BUCKET_NAME="$(get_output PublicAssetsBucketName)"
DISTRIBUTION_ID="$(get_output PublicAssetsDistributionId)"
DISTRIBUTION_URL="$(get_output PublicAssetsDistributionUrl)"

echo "Bucket          : $BUCKET_NAME"
echo "Distribution ID : $DISTRIBUTION_ID"
echo "Distribution URL: $DISTRIBUTION_URL"
echo

echo "==> building widget"
pnpm --filter frontend run build:widget

if [[ ! -d "$DIST_DIR" ]]; then
  echo "build did not produce $DIST_DIR" >&2
  exit 1
fi

# --- Upload each file explicitly so cache-control + content-type are exact ---
#
# Widget JS files → /libs/chat-widget/latest/, 5-minute browser+edge cache.
# Source map is intentionally omitted (bulky, and widget.js unminified is
# already published alongside — devtools can read that directly).
echo "==> uploading widget JS → s3://$BUCKET_NAME/libs/chat-widget/latest/"
for f in widget.min.js widget.js; do
  if [[ ! -f "$DIST_DIR/$f" ]]; then
    echo "error: $DIST_DIR/$f not found — did build:widget succeed?" >&2
    exit 1
  fi
  aws s3 cp "$DIST_DIR/$f" "s3://$BUCKET_NAME/libs/chat-widget/latest/$f" \
    --cache-control 'public, max-age=300, s-maxage=300' \
    --content-type 'application/javascript; charset=utf-8'
done

# Root pages → bucket root, never cache (both are small; latest content wins).
# No pruning — root prefix is shared with future uploads/.
echo "==> uploading root pages → s3://$BUCKET_NAME/ (widget-demo.html, index.html)"
for f in widget-demo.html index.html; do
  if [[ ! -f "$DIST_DIR/$f" ]]; then
    echo "warning: $DIST_DIR/$f not found — skipped" >&2
    continue
  fi
  aws s3 cp "$DIST_DIR/$f" "s3://$BUCKET_NAME/$f" \
    --cache-control 'no-cache, no-store, must-revalidate' \
    --content-type 'text/html; charset=utf-8'
done

echo "==> invalidating CloudFront $DISTRIBUTION_ID"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/libs/chat-widget/latest/*' '/widget-demo.html' '/index.html' '/' \
  --output json \
  | jq -r '.Invalidation | "  id=\(.Id) status=\(.Status)"'

echo
echo "Done."
echo "  Widget:      $DISTRIBUTION_URL/libs/chat-widget/latest/widget.min.js"
echo "  Playground:  $DISTRIBUTION_URL/widget-demo.html   (basic-auth gated)"
