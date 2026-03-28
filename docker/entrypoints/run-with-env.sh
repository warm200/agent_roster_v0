#!/bin/sh
set -eu

. /app/docker/entrypoints/load-env.sh

exec "$@"
