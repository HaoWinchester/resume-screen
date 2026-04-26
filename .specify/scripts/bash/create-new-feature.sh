#!/bin/bash
# Create a new feature branch and spec directory

set -e

# Parse arguments
JSON_OUTPUT=false
NUMBER=""
SHORT_NAME=""
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    --number)
      NUMBER="$2"
      shift 2
      ;;
    --short-name)
      SHORT_NAME="$2"
      shift 2
      ;;
    *)
      DESCRIPTION="$1"
      shift
      ;;
  esac
done

if [[ -z "$NUMBER" || -z "$SHORT_NAME" || -z "$DESCRIPTION" ]]; then
  echo "Usage: create-new-feature.sh --number N --short-name name \"description\""
  exit 1
fi

BRANCH_NAME="${NUMBER}-${SHORT_NAME}"
SPEC_DIR="specs/${BRANCH_NAME}"
SPEC_FILE="${SPEC_DIR}/spec.md"

# Create branch
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Create spec directory
mkdir -p "$SPEC_DIR"
mkdir -p "${SPEC_DIR}/checklists"

# Initialize spec file
cat > "$SPEC_FILE" << SPEC_EOF
# Feature Specification: ${DESCRIPTION}

**Branch**: \`${BRANCH_NAME}\`
**Created**: $(date +%Y-%m-%d)
**Status**: Draft

---

*Spec content to be generated.*
SPEC_EOF

# Output
if [[ "$JSON_OUTPUT" == true ]]; then
  echo "{\"branch_name\": \"${BRANCH_NAME}\", \"spec_file\": \"${SPEC_FILE}\", \"spec_dir\": \"${SPEC_DIR}\"}"
else
  echo "Branch: ${BRANCH_NAME}"
  echo "Spec file: ${SPEC_FILE}"
fi
