# 複数 Issue / worktree 並列開発ガイド

複数 Issue を同時に進める場合は、ファイル競合、DB スキーマ競合、TDD 確認漏れを防ぐためにフェーズを分ける。
この文書は Codex / Claude Code 共通の判断基準をまとめる。

## 基本方針

- 1 Issue につき 1 ブランチを作る
- 同じファイルを変更する Issue は同じ並列フェーズに入れない
- DB スキーマ変更を含む Issue は原則として順次実行する
- テスト項目作成後にユーザー確認を挟む
- PR の承認とマージはユーザーが実施する

## フェーズ設計

1. Issue 本文を読み、実装に関係するレイヤを見積もる
2. 変更候補ファイルを洗い出す
3. ファイル競合がない Issue を同一フェーズにまとめる
4. 基盤変更を先に、依存する UI や追加機能を後に置く
5. スキーマ変更を含む Issue は別フェーズに分ける

影響範囲の確認先:

| レイヤ | 主な確認先 |
|---|---|
| DB | `db/schema.hcl`, `atlas.hcl` |
| Server | `packages/server/src/routes/`, `packages/server/src/services/`, `packages/server/src/socket/` |
| Client | `packages/client/src/components/`, `packages/client/src/pages/`, `packages/client/src/hooks/` |
| Shared | `packages/shared/src/types/` |
| Tests | `packages/server/src/__tests__/`, `packages/client/src/__tests__/` |

## worktree 運用

worktree を使う場合は、各作業ディレクトリでブランチ、差分、テスト結果を独立して管理する。
依存関係の追加が必要な場合は勝手に `npm install` せず、ユーザーに確認する。

worktree 間でローカル DB を共有している場合、Atlas の宣言モードによる `atlas schema apply` を並列実行しない。
後発の作業が先発の未マージスキーマを消す可能性がある。

## テスト実行

実装中は対象ワークスペースと対象ファイルに絞って確認する。
最終確認では変更したワークスペースのテストとビルドを実行する。

PR 作成前は `AGENTS.md` のチェックリストに従い、以下を通す。

```bash
npm run build
npm run test
```

`it.todo` や空ボディの `it` が残っている場合は PR を作成しない。

## 並列化してよい例

- 片方が `ChannelList.tsx`、もう片方が `ProfilePage.tsx` だけを触る
- API 追加と独立したフロントエンド表示改善で共有ファイルがない
- テストファイル、サービス、コンポーネントが完全に分離している

## 並列化しない例

- 複数 Issue が `db/schema.hcl` を変更する
- 複数 Issue が `MessageItem.tsx` や `ChatPage.tsx` を変更する
- 片方の型定義変更にもう片方の実装が依存する
- Socket.IO のイベント設計や認可処理を複数 Issue が同時に触る

## 計画報告フォーマット

```md
## 実行計画

### Phase 1（並列）
| Issue | ブランチ | 影響範囲 | 競合リスク |
|---|---|---|---|
| #123 | feature/example/#123 | Clientのみ | 低 |

### Phase 2（順次）
| Issue | ブランチ | 理由 |
|---|---|---|
| #124 | feature/schema-change/#124 | DBスキーマ変更を含むため |

この計画で進めてよいですか？
```

