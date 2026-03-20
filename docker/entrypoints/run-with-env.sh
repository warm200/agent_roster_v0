#!/bin/sh
set -eu

if [ -f /app/.env ]; then
  set -a
  . /app/.env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgres://agent_roster:agent_roster@postgres:5432/agent_roster}"

exec "$@"
