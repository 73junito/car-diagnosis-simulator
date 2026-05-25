#!/usr/bin/env bash
# Retry wrapper for smoke tests to reduce transient CI failures
set -euo pipefail
attempts=3
delay=5
cmd="npm run test:smoke"
echo "Running smoke tests with up to ${attempts} attempts"
for i in $(seq 1 ${attempts}); do
  echo "Attempt ${i}/${attempts} -> ${cmd}"
  if ${cmd}; then
    echo "Smoke tests passed on attempt ${i}"
    exit 0
  fi
  if [ ${i} -lt ${attempts} ]; then
    echo "Smoke tests failed on attempt ${i}, retrying after ${delay}s..."
    sleep ${delay}
    delay=$((delay * 2))
  else
    echo "Smoke tests failed after ${attempts} attempts"
    exit 1
  fi
done
