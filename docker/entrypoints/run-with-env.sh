#!/bin/sh
set -eu

if [ -f /app/.env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*)
        continue
        ;;
      export\ *)
        line=${line#export }
        ;;
    esac

    key=${line%%=*}
    value=${line#*=}

    if [ -n "$key" ] && [ "$key" != "$line" ]; then
      eval "already_set=\${$key+x}"
      if [ -z "$already_set" ]; then
        export "$key=$value"
      fi
    fi
  done < /app/.env
fi

export DATABASE_URL="${DATABASE_URL:-postgres://agent_roster:agent_roster@postgres:5432/agent_roster}"

exec "$@"
