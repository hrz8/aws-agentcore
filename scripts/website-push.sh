#!/usr/bin/env bash
set -euo pipefail

# Build apps/website (Astro SSG) and ship it to the S3 bucket fronted by the
# CloudFront distribution that `cdk deploy` provisions. Reads CFN outputs by
# ExportName for:
#   - WebsiteBucketName     → s3 sync target
#   - WebsiteDistributionId → cache invalidation target
#   - WebsiteDistributionUrl → for the final "open this" line
#
# Run this AFTER `cdk deploy` and ANY time the website source changes.
# No CDK redeploy needed for content-only changes.
#
# Usage:
#   ./scripts/website-push.sh [stage]

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
WEBSITE_DIR="$REPO_ROOT/apps/website"
DIST_DIR="$WEBSITE_DIR/dist"

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

# Match by ExportName — deterministic `${stage}-nd8-<Name>` strings set in the
# CDK construct. CDK mangles OutputKey with a hash so filtering by ExportName
# is the stable path.
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

BUCKET_NAME="$(get_output WebsiteBucketName)"
DISTRIBUTION_ID="$(get_output WebsiteDistributionId)"
DISTRIBUTION_URL="$(get_output WebsiteDistributionUrl)"

echo "Bucket          : $BUCKET_NAME"
echo "Distribution ID : $DISTRIBUTION_ID"
echo "Distribution URL: $DISTRIBUTION_URL"
echo

echo "==> building website"
if [[ "$STAGE" == "Dev" ]]; then
  export INCLUDE_DESIGN_TOKENS=1
fi
pnpm --filter website run build

if [[ ! -d "$DIST_DIR" ]]; then
  echo "build did not produce $DIST_DIR" >&2
  exit 1
fi

echo "==> syncing $DIST_DIR → s3://$BUCKET_NAME"
# Long-cache hashed asset files; never-cache HTML so a fresh index.html
# always resolves the latest /_astro/* hash.
aws s3 sync "$DIST_DIR" "s3://$BUCKET_NAME" \
  --delete \
  --exclude '*.html' \
  --cache-control 'public, max-age=31536000, immutable'
aws s3 sync "$DIST_DIR" "s3://$BUCKET_NAME" \
  --exclude '*' \
  --include '*.html' \
  --cache-control 'no-cache, no-store, must-revalidate' \
  --content-type 'text/html; charset=utf-8'

echo "==> invalidating CloudFront $DISTRIBUTION_ID"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' \
  --output json \
  | jq -r '.Invalidation | "  id=\(.Id) status=\(.Status)"'

echo
echo "Done. Open: $DISTRIBUTION_URL"
