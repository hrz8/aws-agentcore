#!/usr/bin/env bash
set -euo pipefail

# Publish apps/public-files/ (bucket mirror) to the public files S3 bucket +
# invalidate the CloudFront distribution. Reads CFN outputs by ExportName for:
#   - PublicAssetsBucketName     → s3 sync target
#   - PublicAssetsDistributionId → cache invalidation target
#   - PublicAssetsDistributionUrl → for the final "open this" line
#
# The widget is built (via `pnpm --filter frontend build:widget`) INTO
# `apps/public-files/libs/chat-widget/latest/`, so this script just mirrors
# the folder to S3 — no separate widget/pages/favicons steps.
#
# Non-destructive: per-file `aws s3 cp` — untouched objects in the bucket
# (e.g. future /uploads/) are safe. To ship a new file, add it to a loop below.
#
# Run this AFTER `cdk deploy` and ANY time public-files content changes.
# No CDK redeploy needed for public-files-only changes.
#
# Usage:
#   ./scripts/files-push.sh [stage]

STAGE="${1:-${STAGE:-Dev}}"
STACK_NAME="${STACK_NAME:-${STAGE}-Nd8Stack}"
: "${AWS_REGION:=us-east-1}"
export AWS_REGION

if [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  : "${AWS_PROFILE:=twhirzi}"
  export AWS_PROFILE
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/apps/public-files"

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

echo "==> building widget → $SRC_DIR/libs/chat-widget/latest/"
pnpm --filter frontend run build:widget

if [[ ! -d "$SRC_DIR" ]]; then
  echo "$SRC_DIR does not exist" >&2
  exit 1
fi

# HTML → no-cache (small, always want the latest).
echo "==> uploading HTML pages"
for f in index.html widget-demo.html; do
  if [[ ! -f "$SRC_DIR/$f" ]]; then continue; fi
  aws s3 cp "$SRC_DIR/$f" "s3://$BUCKET_NAME/$f" \
    --cache-control 'no-cache, no-store, must-revalidate' \
    --content-type 'text/html; charset=utf-8'
done

# Favicons → /public/, 1-day cache.
echo "==> uploading favicons"
for f in favicon-32x32.png favicon-180x180.png favicon-192x192.png; do
  path="public/$f"
  if [[ ! -f "$SRC_DIR/$path" ]]; then continue; fi
  aws s3 cp "$SRC_DIR/$path" "s3://$BUCKET_NAME/$path" \
    --cache-control 'public, max-age=86400, s-maxage=86400' \
    --content-type 'image/png'
done

# favicon.ico → bucket root (browsers auto-request /favicon.ico as fallback).
if [[ -f "$SRC_DIR/favicon.ico" ]]; then
  echo "==> uploading favicon.ico"
  aws s3 cp "$SRC_DIR/favicon.ico" "s3://$BUCKET_NAME/favicon.ico" \
    --cache-control 'public, max-age=86400, s-maxage=86400' \
    --content-type 'image/vnd.microsoft.icon'
fi

# Widget JS → 5-min cache. Sourcemap omitted (bulky, unmin ships alongside).
echo "==> uploading widget JS"
for f in widget.min.js widget.js; do
  path="libs/chat-widget/latest/$f"
  if [[ ! -f "$SRC_DIR/$path" ]]; then
    echo "error: $SRC_DIR/$path not found — did build:widget succeed?" >&2
    exit 1
  fi
  aws s3 cp "$SRC_DIR/$path" "s3://$BUCKET_NAME/$path" \
    --cache-control 'public, max-age=300, s-maxage=300' \
    --content-type 'application/javascript; charset=utf-8'
done

echo "==> invalidating CloudFront $DISTRIBUTION_ID"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' \
  --output json \
  | jq -r '.Invalidation | "  id=\(.Id) status=\(.Status)"'

echo
echo "Done."
echo "  Widget:      $DISTRIBUTION_URL/libs/chat-widget/latest/widget.min.js"
echo "  Playground:  $DISTRIBUTION_URL/widget-demo.html   (basic-auth gated)"
