#!/bin/sh
set -e

# Entrypoint for server container
# - loads JWT keys from multiple sources: mounted secrets/files, base64 env vars, or raw PEM
# - runs alembic upgrade head if alembic is available
# - starts the app with uvicorn

# Priority 1: Load from mounted secret files (JWT_PRIVATE_KEY_FILE, JWT_PUBLIC_KEY_FILE)
if [ -n "${JWT_PRIVATE_KEY_FILE}" ] && [ -f "${JWT_PRIVATE_KEY_FILE}" ]; then
  export JWT_PRIVATE_KEY="$(cat "${JWT_PRIVATE_KEY_FILE}")"
fi

if [ -n "${JWT_PUBLIC_KEY_FILE}" ] && [ -f "${JWT_PUBLIC_KEY_FILE}" ]; then
  export JWT_PUBLIC_KEY="$(cat "${JWT_PUBLIC_KEY_FILE}")"
fi

# Priority 2: Decode from base64 env vars (JWT_PRIVATE_KEY_B64, JWT_PUBLIC_KEY_B64)
# Useful for Render/Cloud Run/etc where multiline strings may be problematic
if [ -n "${JWT_PRIVATE_KEY_B64}" ] && [ -z "${JWT_PRIVATE_KEY}" ]; then
  export JWT_PRIVATE_KEY="$(echo "${JWT_PRIVATE_KEY_B64}" | base64 -d)"
fi

if [ -n "${JWT_PUBLIC_KEY_B64}" ] && [ -z "${JWT_PUBLIC_KEY}" ]; then
  export JWT_PUBLIC_KEY="$(echo "${JWT_PUBLIC_KEY_B64}" | base64 -d)"
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
exec uvicorn main:app --host 0.0.0.0 --port 8001

