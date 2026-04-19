#!/bin/bash
# PostToolUse フック（Edit|Write）: 編集された TS/TSX ファイルに prettier と eslint を適用する
# - prettier --write と eslint --fix で自動修正
# - 修正不能なエラーが残る場合は exit 2 で stderr を返し、Claude に修正を促す
set -uo pipefail

# stdin の JSON から対象ファイルパスを抽出
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# file_path が取れない場合は何もしない
[ -z "$FILE" ] && exit 0

# プロジェクトのソースファイル（TS/TSX）のみ対象
if [[ ! "$FILE" =~ packages/[^/]+/src/.+\.(ts|tsx)$ ]]; then
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# 相対パスの場合はプロジェクトルートからの絶対パスに解決
if [[ "$FILE" != /* ]]; then
  FILE="$REPO_ROOT/$FILE"
fi

# ファイルが実在しなければ（削除直後など）スキップ
[ ! -f "$FILE" ] && exit 0

cd "$REPO_ROOT" || exit 0

# 自動整形・自動修正
npx --no-install prettier --write "$FILE" > /dev/null 2>&1 || true
npx --no-install eslint --fix "$FILE" > /dev/null 2>&1 || true

# 残った lint エラーを確認
LINT_OUTPUT=$(npx --no-install eslint "$FILE" 2>&1)
LINT_EXIT=$?

if [ "$LINT_EXIT" -ne 0 ]; then
  {
    echo "ESLint エラーが自動修正後も残っています: $FILE"
    echo "以下を修正してください。"
    echo ""
    echo "$LINT_OUTPUT"
  } >&2
  exit 2
fi

exit 0
