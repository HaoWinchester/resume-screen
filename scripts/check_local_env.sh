#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"

echo "ResumeAssistant local environment check"
echo

if [[ -f "$BACKEND_ENV" ]]; then
  echo "backend/.env"
  grep -E '^(DATABASE_URL|REDIS_URL|CELERY_BROKER_URL|CELERY_RESULT_BACKEND|TASK_EXECUTION_MODE)=' "$BACKEND_ENV" || true
else
  echo "backend/.env not found"
fi

echo
echo "Docker containers"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || echo "docker is not available"

echo
echo "Backend health"
curl -fsS http://localhost:8001/health 2>/dev/null || echo "http://localhost:8001/health is not reachable"

echo
echo "Frontend"
curl -fsS -I http://localhost:3004 2>/dev/null | head -5 || echo "http://localhost:3004 is not reachable"
