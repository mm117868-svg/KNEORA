#!/bin/zsh
set -eu
GUIDES_DIRECTORY="$(cd -- "$(dirname -- "$0")" && pwd)"
GUIDES_PYTHON="$GUIDES_DIRECTORY/../../voice-tools/venv/bin/python"
if [[ ! -x "$GUIDES_PYTHON" ]]; then
  GUIDES_PYTHON="$(command -v python3)"
fi
"$GUIDES_PYTHON" "$GUIDES_DIRECTORY/source/make-openai-audio.py" --prompt-key
printf '\nPress Return to close.\n'
read -r
