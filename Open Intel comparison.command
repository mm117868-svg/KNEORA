#!/bin/bash
cd "$(dirname "$0")/depth-bench" || exit 1
PY=".venv/bin/python"
# Reuse the already installed Intel runtime from the adjacent KNEORA checkout.
if [ ! -x "$PY" ] && [ -x "../../KNEORA/depth-bench/.venv/bin/python" ]; then
  PY="../../KNEORA/depth-bench/.venv/bin/python"
fi
if [ ! -x "$PY" ]; then
  echo "Intel camera dependencies have not been installed. See depth-bench/README.md."
  read -r -p "Press Enter to close. "
  exit 1
fi
PORT=8010
while lsof -i ":$PORT" >/dev/null 2>&1; do PORT=$((PORT + 1)); done
(sleep 1; open "http://localhost:$PORT/intel-comparison.html") &
exec "$PY" -m depth_bench.server --port "$PORT"
