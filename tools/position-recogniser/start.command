#!/bin/zsh
set -e
cd "${0:A:h}"
repo_root="${PWD:h:h}"
tracker_home="${KNEE_TRACKER_HOME:-${repo_root:h}/knee-dis-evaluation}"
export EVAL_APP_ROOT="$repo_root"
export EVAL_PORT=8789
if curl -fsS --max-time 2 http://127.0.0.1:8789/app/tools/position-recogniser/index.html >/dev/null 2>&1; then
 open 'http://127.0.0.1:8789/app/tools/position-recogniser/index.html'
 exit 0
fi
print 'Open http://127.0.0.1:8789/app/tools/position-recogniser/index.html'
"$tracker_home/.venv-tapir/bin/python" "$tracker_home/server.py"
