---
name: doc-pr
description: ドキュメント変更のみの PR 作成や差分確認を進めるときに使う。手順本体は .claude/commands/doc-pr.md を正本として参照する。
---

# Doc PR

`.claude/commands/doc-pr.md` を読み、その手順に従う。

## Codex での読み替え

- Claude Code の `allowed-tools` は Codex で利用可能なツールに読み替える。
- `AGENTS.md` と現在の Codex/developer 指示を優先する。
- PR 作成前チェック、PR テンプレート、コミット規約は `AGENTS.md` に従う。
- マージ操作は、ユーザーが明示的に依頼・承認した場合を除き実行しない。
