#!/bin/bash
# blast-radius-check.sh — PostToolUse hook for Edit
# After editing a Convex backend file, reminds AI to check all frontend consumers.
#
# Hook receives tool result as JSON on stdin.
# Stdout is shown to the AI as a reminder.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('filePath', json.load(sys.stdin) if isinstance(json.load(sys.stdin), str) else ''))" 2>/dev/null || echo "")

# Fallback: try to extract file_path from the input
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('file_path', data.get('filePath', '')))
" 2>/dev/null || echo "")
fi

# Only trigger for Convex backend files
if ! echo "$FILE_PATH" | grep -qE 'convex/.*\.(ts|js)$'; then
  exit 0
fi

# Skip test files and generated files
if echo "$FILE_PATH" | grep -qE '(\.test\.|_generated|node_modules)'; then
  exit 0
fi

# Extract the base filename for grep hints
BASENAME=$(basename "$FILE_PATH" .ts)

echo "BLAST RADIUS CHECK: You edited a Convex backend file ($BASENAME)."
echo ""
echo "Before saying 'done', answer these questions:"
echo "1. What queries/mutations did you change or add?"
echo "2. Which frontend components consume them? (grep for api.$BASENAME in src/)"
echo "3. Did you check ALL consumers, not just the one you were focused on?"
echo "4. Are there other queries that read the SAME data source you modified?"
echo "5. Did you remove dead code (old queries/mutations no longer used)?"

exit 0
