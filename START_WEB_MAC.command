#!/bin/zsh
# Double-click this file on macOS to open the shipyard before the animated harbor game.
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 was not found. Install Python 3.10+ and try again."
  read -r '?Press Enter to close...'
  exit 1
fi
python3 main.py --web --shipyard --open
result=$?
if (( result != 0 )); then
  echo "Web game stopped with an error (code $result)."
  read -r '?Press Enter to close...'
fi
