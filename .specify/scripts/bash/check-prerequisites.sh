#!/bin/bash
# Check prerequisites for task generation

set -e

BRANCH=$(git branch --show-current)

if [[ -z "$BRANCH" ]]; then
  echo "Error: Not on a feature branch"
  exit 1
fi

FEATURE_DIR="specs/${BRANCH}"

if [[ ! -f "${FEATURE_DIR}/plan.md" ]]; then
  echo "Error: plan.md not found. Run speckit-plan first."
  exit 1
fi

# Build available docs list
DOCS="["
FIRST=true
for doc in spec.md research.md data-model.md quickstart.md; do
  if [[ -f "${FEATURE_DIR}/${doc}" ]]; then
    if [[ "$FIRST" == true ]]; then
      FIRST=false
    else
      DOCS="${DOCS}, "
    fi
    DOCS="${DOCS}\"${doc}\""
  fi
done

# Check contracts directory
if [[ -d "${FEATURE_DIR}/contracts" ]]; then
  if [[ "$FIRST" == false ]]; then
    DOCS="${DOCS}, "
  fi
  DOCS="${DOCS}\"contracts/\""
fi

DOCS="${DOCS}]"

# Check --require-tasks flag
if [[ " $* " == *" --require-tasks "* ]]; then
  if [[ ! -f "${FEATURE_DIR}/tasks.md" ]]; then
    echo "Error: tasks.md not found. Run speckit-tasks first."
    exit 1
  fi
fi

# Add tasks.md to docs if present and --include-tasks flag set
if [[ " $* " == *" --include-tasks "* ]] && [[ -f "${FEATURE_DIR}/tasks.md" ]]; then
  if [[ "$FIRST" == false ]]; then
    DOCS="${DOCS}, "
  fi
  DOCS="${DOCS}\"tasks.md\""
fi

DOCS="${DOCS}]"

if [[ " $* " == *" --json "* ]]; then
  echo "{\"feature_dir\": \"${FEATURE_DIR}\", \"branch\": \"${BRANCH}\", \"available_docs\": ${DOCS}}"
else
  echo "Feature dir: ${FEATURE_DIR}"
  echo "Branch: ${BRANCH}"
  echo "Available docs: ${DOCS}"
fi
