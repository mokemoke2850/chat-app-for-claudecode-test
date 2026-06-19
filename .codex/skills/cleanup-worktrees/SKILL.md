---
name: cleanup-worktrees
description: worktree と作業ブランチを整理するときに使う。手順本体は .claude/commands/cleanup-worktrees.md を正本として参照する。
---

# Cleanup Worktrees

`.claude/commands/cleanup-worktrees.md` を読み、その手順に従う。

## Codex での読み替え

- Claude Code の `allowed-tools` は Codex で利用可能なツールに読み替える。
- `AGENTS.md` と現在の Codex/developer 指示を優先する。
- 削除操作は、参照先 command の確認手順どおり、ユーザーの明示的な承認後にだけ実行する。
