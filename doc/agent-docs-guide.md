# エージェント向けドキュメント構成

このプロジェクトでは Codex と Claude Code の両方で同じ開発規約を使う。
重複管理を避けるため、エージェント共通の規約と技術知識は `AGENTS.md` と `doc/` を正本にする。

## 正本

| ファイル | 役割 |
|---|---|
| `AGENTS.md` | Codex / Claude Code 共通の開発規約、TDD フロー、Git ワークフロー |
| `CLAUDE.md` | Claude Code が最初に読む薄い入口。共通規約は `AGENTS.md` / `doc/` に委譲する |
| `doc/*.md` | プロジェクト固有の仕様、設計ガイド、運用ガイド |
| `.claude/**` | Claude Code 固有の skill / command / hook / permission 設定 |

## Codex で作業するとき

1. 最初に `AGENTS.md` を読む
2. 実装対象に関係する `doc/` 配下の仕様を読む
3. フロントエンドで `use()` / `<Suspense>` を扱う場合は `doc/react19-suspense-guide.md` を読む
4. ブラウザ実機確認が必要な場合は `doc/browser-e2e-guide.md` を読む
5. 複数 Issue や worktree を扱う場合は `doc/parallel-dev-guide.md` を読む

Codex 専用に同じ内容の文書を複製しない。Codex 固有の補足が必要な場合も、本文は正本へリンクし、差分だけを書く。

## Claude Code で作業するとき

Claude Code は `CLAUDE.md` と `.claude/skills` / `.claude/commands` を入口として使える。
ただし、開発規約や技術仕様の本文は `AGENTS.md` / `doc/` に置き、`.claude/**` には Claude Code 固有の発火条件、ツール名、権限、実行手順だけを書く。

## 文書追加・更新ルール

- 開発規約を変える場合は `AGENTS.md` を更新する
- 実装仕様や技術ガイドを追加する場合は `doc/` に置く
- Claude Code の skill だけに有用な内容は `.claude/skills/` に置く
- 同じ説明を複数ファイルへ貼り付けない
- 参照先を変えた場合は `rg "古いファイル名|古い見出し"` で残存参照を確認する

