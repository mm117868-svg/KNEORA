#!/bin/bash
# Double-click to open the patient app from this folder in your browser.
# A camera only works on localhost or https, so a small web server is started for this folder.
# Close this window to stop it.
cd "$(dirname "$0")" || exit 1
PORT=8000
while lsof -i ":$PORT" >/dev/null 2>&1; do PORT=$((PORT + 1)); done
echo "Knee Recovery is on http://localhost:$PORT"
echo "Close this window to stop it."
( sleep 1; open "http://localhost:$PORT/" ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
