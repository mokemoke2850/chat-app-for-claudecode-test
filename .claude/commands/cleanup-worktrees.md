---
description: worktree と作業ブランチを整理する（マージ済みを優先的に削除）
allowed-tools: Bash(git:*), Bash(ls:*), Bash(cd:*), Read
---

# worktree とブランチの整理

以下の手順で現在の worktree / ブランチ状況を報告し、ユーザーの確認を得てから削除を実行する。

## Step 1: 現状把握

以下を並列で実行し、結果をまとめて報告すること。

- `git fetch --prune origin` — リモートの削除済みブランチ参照を掃除
- `git worktree list` — 現在の worktree 一覧
- `git branch --merged main` — main にマージ済みのローカルブランチ
- `git branch --no-merged main` — 未マージのローカルブランチ
- `git branch -vv` — ローカルブランチとリモートの追跡状況（`[gone]` の検出用）
- `git rev-parse --abbrev-ref HEAD` — 現在のブランチ（削除対象から除外するため）

## Step 2: 削除候補の提示

以下の3カテゴリに分類し、表形式でユーザーに提示する。

1. **マージ済みブランチ** — `main` にマージ済み、かつ `main` / 現在のブランチではないもの
2. **リモート削除済み（gone）ブランチ** — `git branch -vv` で `[gone]` マーカーが付いているもの
3. **マージ済み worktree** — 上記ブランチに紐づく worktree

出力フォーマット:

```
## 整理候補

### 削除可能なブランチ
| ブランチ | 最終コミット | 理由 |
|---|---|---|
| feature/xxx/#N | sha short msg | mainにマージ済み / リモート削除済み |

### 削除可能な worktree
| パス | ブランチ |
|---|---|
| .claude/worktrees/xxx | feature/xxx/#N |

### 削除しないもの（参考）
- `main`
- 現在のブランチ: `<現在のブランチ>`
- 未マージ: ...
```

## Step 3: ユーザー確認

「以下を削除してよいですか？個別に除外したいブランチ/worktree があれば指定してください」と質問する。

**ユーザーの明示的な承認を得るまで絶対に削除を実行しないこと。**

## Step 4: 削除実行

ユーザーの承認後、以下を順番に実行する。

1. worktree の削除: `git worktree remove <path>`（または `--force` が必要なら理由を説明してから）
2. ローカルブランチの削除: `git branch -d <branch>`（安全な削除のみ。`-D` は使わない）
3. 失敗したものがあれば内容を報告する

## Step 5: 結果報告

```
## 整理完了

- 削除した worktree: N件
- 削除したブランチ: N件
- スキップ: N件（理由付き）

現在の worktree:
<git worktree list の結果>
```

## 禁止事項

- `-D`（強制削除）や `--force` をユーザー確認なしに使わない
- `main` ブランチは絶対に削除しない
- 現在チェックアウト中のブランチ/worktree は削除しない
- 未マージブランチを確認なしに削除しない
