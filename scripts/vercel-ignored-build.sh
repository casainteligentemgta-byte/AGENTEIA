#!/usr/bin/env bash
# Ignored Build Step de Vercel (cwd = Root Directory del proyecto).
# Exit 0 = saltar build. Exit 1 = construir.
# Evita quemar el tope Hobby (100 deploys / 24 h) con previews de cada PR.

set -u

echo "VERCEL_ENV=${VERCEL_ENV:-unset}"
echo "VERCEL_GIT_COMMIT_REF=${VERCEL_GIT_COMMIT_REF:-unset}"
echo "cwd=$(pwd)"

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "skip: preview (solo se construye production en Hobby)"
  exit 0
fi

if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  if git diff --quiet HEAD^ HEAD -- .; then
    echo "skip: sin cambios en el Root Directory"
    exit 0
  fi
  echo "proceed: hay cambios en el Root Directory"
  git diff --stat HEAD^ HEAD -- . | head -n 20
else
  echo "proceed: no hay HEAD^ (primer commit)"
fi

exit 1
