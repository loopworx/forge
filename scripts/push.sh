#!/usr/bin/env bash
set -euo pipefail

# Forge push routine: run all CI checks locally, push, then watch the pipeline.
# Usage: ./scripts/push.sh [commit message]
# If no message provided, commits only staged changes. If message provided,
# stages all changes first.

cd "$(git rev-parse --show-toplevel)"

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: Not on main branch (on $BRANCH). Switch to main first."
  exit 1
fi

COMMIT_MSG="${1:-}"
if [ -n "$COMMIT_MSG" ]; then
  echo "=== Staging changes ==="
  git add -A
  echo "=== Committing ==="
  git commit -m "$COMMIT_MSG"
fi

echo ""
echo "=== Running CI checks locally ==="
echo ""

echo "--- bun install ---"
bun install --frozen-lockfile 2>&1 | tail -5

echo ""
echo "--- bun run build ---"
bun run build 2>&1

echo ""
echo "--- bun run typecheck (tsc --noEmit) ---"
bun run typecheck 2>&1

echo ""
echo "--- bun run lint (oxlint src/ tests/) ---"
bun run lint 2>&1

echo ""
echo "--- bun test ---"
bun test 2>&1

echo ""
echo "=== All local checks passed ==="
echo ""

echo "=== Pushing to origin/main ==="
git push origin main

echo ""
echo "=== Waiting for GitHub Actions pipeline... ==="
sleep 5

MAX_WAIT=300
WAITED=0
RUN_ID=""

while [ -z "$RUN_ID" ] && [ $WAITED -lt $MAX_WAIT ]; do
  RUN_ID=$(gh run list --branch main --limit 1 --json databaseId,status,conclusion --jq '.[0].databaseId' 2>/dev/null || echo "")
  if [ -z "$RUN_ID" ]; then
    sleep 5
    WAITED=$((WAITED + 5))
  fi
done

if [ -z "$RUN_ID" ]; then
  echo "WARNING: Could not find a pipeline run after $MAX_WAIT seconds."
  echo "Check manually: gh run list --branch main"
  exit 0
fi

echo "Pipeline run #$RUN_ID found. Watching..."

while true; do
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '.status + ":" + .conclusion' 2>/dev/null || echo "unknown:")

  CURRENT_STATUS=$(echo "$STATUS" | cut -d: -f1)
  CONCLUSION=$(echo "$STATUS" | cut -d: -f2)

  if [ "$CURRENT_STATUS" = "completed" ]; then
    echo ""
    echo "=== Pipeline completed: $CONCLUSION ==="
    if [ "$CONCLUSION" = "success" ]; then
      echo "✓ CI green"
      exit 0
    else
      echo "✗ CI failed — showing details:"
      gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -50 || gh run view "$RUN_ID" 2>&1
      exit 1
    fi
  fi

  echo "  Status: $CURRENT_STATUS (waited ${WAITED}s)..."
  sleep 10
  WAITED=$((WAITED + 10))

  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "TIMEOUT: Pipeline still running after $MAX_WAIT seconds."
    echo "Check manually: gh run view $RUN_ID"
    exit 1
  fi
done
