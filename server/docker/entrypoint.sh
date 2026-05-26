#!/bin/sh
set -e

# Entrypoint for server container
# - loads JWT keys from mounted secrets/files into env vars
# - runs alembic upgrade head if alembic is available
# - starts the app with uvicorn

if [ -n "${JWT_PRIVATE_KEY_FILE}" ] && [ -f "${JWT_PRIVATE_KEY_FILE}" ]; then
  export JWT_PRIVATE_KEY="$(cat "${JWT_PRIVATE_KEY_FILE}")"
fi

if [ -n "${JWT_PUBLIC_KEY_FILE}" ] && [ -f "${JWT_PUBLIC_KEY_FILE}" ]; then
  export JWT_PUBLIC_KEY="$(cat "${JWT_PUBLIC_KEY_FILE}")"
fi

echo "Using JWT_ALGORITHM=${JWT_ALGORITHM:-HS256}"

# Run alembic migrations if alembic CLI is available
if command -v alembic >/dev/null 2>&1; then
  echo "Running alembic upgrade head..."
  alembic upgrade head || {
    echo "alembic upgrade failed" >&2
    exit 1
  }
fi

echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000

