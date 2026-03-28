#!/bin/sh
set -eu

. /app/docker/entrypoints/load-env.sh

wait_for_database() {
  attempts="${DB_WAIT_ATTEMPTS:-60}"
  sleep_seconds="${DB_WAIT_SLEEP_SECONDS:-2}"
  attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if node <<'EOF'
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('select 1')
  await client.end()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
EOF
    then
      return 0
    fi

    echo "Database not ready yet (${attempt}/${attempts}). Retrying in ${sleep_seconds}s..."
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done

  echo "Database did not become ready in time."
  exit 1
}

echo 'Waiting for database...'
wait_for_database

echo 'Running database migrations...'
pnpm db:migrate

echo "Starting: $*"
exec "$@"
