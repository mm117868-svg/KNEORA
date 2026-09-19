#!/bin/bash
# Double-click to take one capture. Runs in Terminal so macOS can ask for
# camera permission, which Claude Code's own shell cannot be granted.
cd "$(dirname "$0")" || exit 1
PY=".venv/bin/python"
[ -x "$PY" ] || { echo "No virtual environment yet. See README.md."; read -r; exit 1; }
read -r -p "Patient ID: " PATIENT
read -r -p "Operation date (YYYY-MM-DD): " OPDATE
read -r -p "Operated side (left/right): " SIDE
read -r -p "Movement (bend/straighten) [bend]: " MOTION
MOTION=${MOTION:-bend}
read -r -p "Jig reference angle in degrees, or blank for a patient: " REF
ARGS=(--patient "$PATIENT" --op-date "$OPDATE" --side "$SIDE" --motion "$MOTION")
[ -n "$REF" ] && ARGS+=(--reference "$REF")
"$PY" -m depth_bench.capture "${ARGS[@]}"
echo
read -r -p "Press Enter to close. "
