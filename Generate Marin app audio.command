#!/bin/zsh
set -eu
COUNTDOWN_DIRECTORY="$(cd -- "$(dirname -- "$0")" && pwd)"
COUNTDOWN_PYTHON="$COUNTDOWN_DIRECTORY/../voice-tools/venv/bin/python"
if [[ ! -x "$COUNTDOWN_PYTHON" ]]; then
  COUNTDOWN_PYTHON="$(command -v python3)"
fi
"$COUNTDOWN_PYTHON" "$COUNTDOWN_DIRECTORY/tools/generate-countdown.py" --prompt-key
printf '\nPress Return to close.\n'
read -r
