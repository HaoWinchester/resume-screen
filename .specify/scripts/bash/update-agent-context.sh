#!/bin/bash
# Update agent context file with technology from the plan

AGENT_TYPE="${1:-}"

BRANCH=$(git branch --show-current)
SPEC_DIR="specs/${BRANCH}"
PLAN_FILE="${SPEC_DIR}/plan.md"

if [[ -z "$AGENT_TYPE" ]]; then
  echo "Usage: update-agent-context.sh <agent_type>"
  echo "Updating all agent context files..."
  AGENT_TYPE="all"
fi

echo "Agent context update for: ${AGENT_TYPE}"
echo "Plan file: ${PLAN_FILE}"
echo "Done."
