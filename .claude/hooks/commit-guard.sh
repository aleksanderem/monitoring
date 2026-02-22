#!/bin/bash
# commit-guard.sh — PreToolUse hook for Bash
# Blocks git commit if session tracking files weren't updated recently.
#
# Hook receives tool input as JSON on stdin.
# Exit 0 = allow, Exit 2 = block (stdout shown to AI as reason).

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || echo "")

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE '^\s*git commit'; then
  exit 0
fi

PROJECT_ROOT="/Users/alex/projects/monitoring2/monitoring"

# Find actual working directory (could be worktree)
WORK_DIR=$(pwd)

# Check if session_state.json exists and was modified in last 30 minutes
SESSION_FILE="$WORK_DIR/session_state.json"
if [ ! -f "$SESSION_FILE" ]; then
  SESSION_FILE="$PROJECT_ROOT/session_state.json"
fi

if [ -f "$SESSION_FILE" ]; then
  # Check modification time (last 30 minutes = 1800 seconds)
  FILE_AGE=$(( $(date +%s) - $(stat -f %m "$SESSION_FILE") ))
  if [ "$FILE_AGE" -gt 1800 ]; then
    echo "BLOCKED: session_state.json not updated in last 30 minutes ($FILE_AGE seconds ago)."
    echo "Before committing, update session_state.json and tasks_progress.json with current state."
    echo "This is a hard gate — you CANNOT skip this."
    exit 2
  fi
else
  echo "BLOCKED: session_state.json not found. Create it before committing."
  echo "This is a hard gate — you CANNOT skip this."
  exit 2
fi

# All checks passed
exit 0
