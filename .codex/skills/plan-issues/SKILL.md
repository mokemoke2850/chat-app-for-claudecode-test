---
name: plan-issues
description: 複数 Issue の並列開発計画と Issue 別注意点ドキュメントを生成するときに使う。手順本体は .claude/commands/plan-issues.md を正本として参照する。
---

# Plan Issues

`.claude/commands/plan-issues.md` を読み、その手順に従う。

## Codex での読み替え

- Claude Code の `allowed-tools` は Codex で利用可能なツールに読み替える。
- `$ARGUMENTS` はユーザーが `$plan-issues` 呼び出し時に指定した Issue 番号の範囲またはリストとして扱う。
- `AGENTS.md` と現在の Codex/developer 指示を優先する。
- 参照先 command の制約どおり、コード変更は行わず計画ドキュメント生成に限定する。
