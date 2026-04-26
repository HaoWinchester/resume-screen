#!/bin/bash
# Setup plan for the current feature branch

set -e

BRANCH=$(git branch --show-current)

if [[ -z "$BRANCH" ]]; then
  echo "Error: Not on a feature branch"
  exit 1
fi

SPEC_DIR="specs/${BRANCH}"
FEATURE_SPEC="${SPEC_DIR}/spec.md"
IMPL_PLAN="${SPEC_DIR}/plan.md"

# Copy plan template if plan doesn't exist yet
if [[ ! -f "$IMPL_PLAN" ]]; then
  if [[ -f ".specify/templates/plan-template.md" ]]; then
    cp .specify/templates/plan-template.md "$IMPL_PLAN"
  else
    echo "# Implementation Plan: ${BRANCH}" > "$IMPL_PLAN"
    echo "" >> "$IMPL_PLAN"
    echo "**Branch**: \`${BRANCH}\`" >> "$IMPL_PLAN"
    echo "**Created**: $(date +%Y-%m-%d)" >> "$IMPL_PLAN"
    echo "**Status**: Draft" >> "$IMPL_PLAN"
  fi
fi

if [[ "$1" == "--json" ]]; then
  echo "{\"branch\": \"${BRANCH}\", \"feature_spec\": \"${FEATURE_SPEC}\", \"impl_plan\": \"${IMPL_PLAN}\", \"specs_dir\": \"${SPEC_DIR}\"}"
else
  echo "Branch: ${BRANCH}"
  echo "Spec: ${FEATURE_SPEC}"
  echo "Plan: ${IMPL_PLAN}"
fi
