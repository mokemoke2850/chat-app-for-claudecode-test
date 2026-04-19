#!/bin/bash
# SessionStart フック（matcher: compact）: compact 後に CLAUDE.md / AGENTS.md を再注入する
# stdout はそのまま Claude のコンテキストへ追加される

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

echo "===== CLAUDE.md（compaction 後に再読み込み） ====="
if [ -f "$REPO_ROOT/CLAUDE.md" ]; then
  cat "$REPO_ROOT/CLAUDE.md"
fi
echo ""
echo "===== AGENTS.md（compaction 後に再読み込み） ====="
if [ -f "$REPO_ROOT/AGENTS.md" ]; then
  cat "$REPO_ROOT/AGENTS.md"
fi

exit 0
