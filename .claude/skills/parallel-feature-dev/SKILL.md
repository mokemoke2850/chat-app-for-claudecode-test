---
name: parallel-feature-dev
description: 複数のGitHub Issueを依存関係を考慮して並列worktreeで実装するオーケストレータースキル。ファイル競合を分析して並列グループを決定し、workerエージェントを並列起動してPR draft作成まで自動化する。テスト項目確認はGitHub PR画面で行う。
version: 0.3.0
model: opus
effort: xhigh
---

# Parallel Feature Dev（オーケストレーター）

複数Issueを並列で実装する。全フェーズで `isolation: "worktree"` を使用し、エージェント間のファイル競合を原理的に排除する。テスト項目の確認はGitHub PR draft画面で行う。

## 呼び出し方

```
/parallel-feature-dev #44 #45 #46 #43
/parallel-feature-dev #44 #46
```

---

## アーキテクチャ

```
オーケストレーター（メインスレッド）
  │
  ├── worker-A（worktree-A: 独立ディレクトリ）← コンフリクトなし
  └── worker-B（worktree-B: 独立ディレクトリ）← コンフリクトなし

各worktreeは完全に独立したファイルシステムを持つため、
並列書き込みによるコンフリクトは原理的に発生しない。
```

---

## 実行フロー

### Phase 0: 依存関係分析

各Issueについて以下を調査する:

1. `gh issue view {番号}` で要件を取得
2. 実装に影響するファイルを特定:
   - DBスキーマ (`db/schema.hcl`)
   - APIルートファイル (`packages/server/src/routes/`)
   - Socket.IO ハンドラ (`packages/server/src/socket/handler.ts`)
   - フロントエンドコンポーネント (`packages/client/src/components/`)
   - 共有型定義 (`packages/shared/src/types/`)

3. **並列グループを決定する**（マージ時のコンフリクトリスクを判定）:
   - 同じファイルを変更するIssueは同一グループに入れない
   - 依存関係があるIssueは順次実行にする

判定例:
```
Issue A と Issue B が両方 MessageItem.tsx を変更する → 順次実行
Issue A が MessageItem.tsx、Issue B が ChannelList.tsx → 並列実行可能
```

4. **各Issueの実装難易度を判定し、workerモデルを決定する**:

   **opus を使用する条件（いずれか1つ以上に該当）:**
   - DBスキーマの主キー変更 or 列削除の変更（`db/schema.hcl`）がある
   - 新規アーキテクチャの導入や既存設計の大きな変更
   - Socket.IO リアルタイム通信とフロントエンドUIの双方に実装が及ぶ
   - 共有型定義（`packages/shared/src/types/`）の変更を伴う複雑な型設計

   **sonnet を使用する条件（上記に該当しない場合）:**

分析結果を以下のフォーマットで提示してユーザーに確認を求める:

```
## 実行計画

### フェーズ1（並列）
| Issue | ブランチ | 難易度 | モデル |
|---|---|---|---|
| #44 ピン留め | feature/pin-message/#44 | 高（DBスキーマ+3層変更） | opus |
| #46 メンション通知バッジ | feature/mention-badge/#46 | 低（UIのみ） | sonnet |

### フェーズ2（順次・前フェーズのマージ後）
| Issue | ブランチ | 難易度 | モデル | 依存 |
|---|---|---|---|---|
| #45 ブックマーク | feature/bookmark/#45 | 中（2層変更） | sonnet | #44マージ後 |
| #43 DM | feature/direct-message/#43 | 高（Socket.IO+フロント） | opus | #46マージ後 |

この計画で進めてよいですか？
```

**ユーザーの確認を得てから次のPhaseに進む。**

---

### Phase 1: テスト項目作成（worktree並列）

並列グループのIssueごとに `isolation: "worktree"`, `mode: "bypassPermissions"` でworkerエージェントを**同時に**起動する。

**重要**: `mode: "bypassPermissions"` を必ず指定すること。指定しないとサブワーカーが権限確認でstopする。

**モデル指定**: Phase 0 で判定した難易度に基づき、Agent 起動時に `model` パラメータを指定する。
- 難易度「高」→ `model: "opus"`
- 難易度「低」〜「中」→ `model: "sonnet"`（省略可）

各workerへの指示:

```
プロジェクト: /Users/shoma/Code/claude-code-test
Issue: #{番号}
ブランチ名: feature/{機能名}/#{番号}

【実行内容】以下のステップのみ実行して停止してください:
- Step 0: 事前調査（Issue詳細・関連ファイルの把握）
- Step 1: ブランチ feature/{機能名}/#{番号} を作成
- Step 2: テスト項目ファイルを作成（describe/it構造のみ。アサーションは書かない）
- 作成したテストファイルをcommitしてブランチをpushする
- `gh pr create --draft --title "WIP: {機能名}" --body "テスト項目確認用のdraft PR"` でdraft PRを作成する

【禁止】
- テストロジック（アサーション）の実装
- プログラムの実装
- PRのマージ

【報告】draft PRのURLと番号を返答してください。
```

全workerの完了後、ユーザーにdraft PRを提示して確認を求める:

```
## テスト項目確認

各PRのFilesタブでテスト構造を確認してください:

| Issue | Draft PR | ブランチ |
|---|---|---|
| #44 ピン留め | #XX  {URL} | feature/pin-message/#44 |
| #46 メンション通知バッジ | #XX  {URL} | feature/mention-badge/#46 |

修正があればお知らせください（ブランチ名と修正内容を教えていただければ対応します）。
問題なければ実装を開始します。
```

**ユーザーの承認を得てから Phase 2 に進む。**

---

### Phase 2: 実装・PR更新（worktree並列）

承認を得たIssueごとに `isolation: "worktree"`, `mode: "bypassPermissions"` でworkerエージェントを**同時に**再起動する。

**モデル指定**: Phase 0 で判定した難易度に基づき、Phase 1 と同じ `model` パラメータを指定する（難易度「高」→ `opus`、それ以外→ `sonnet`）。

各workerへの指示:

```
プロジェクト: /Users/shoma/Code/claude-code-test
Issue: #{番号}
ブランチ名: feature/{機能名}/#{番号}
Draft PR: #{PR番号}

ブランチはすでに存在し、テストファイルの構造（TODO構造）も作成済みです。
以下のステップを実行してください:
- Step 3: テストロジックの実装（アサーションを書く）
- Step 4: プログラム実装（DB→型定義→バックエンド→フロントエンドの順）
- Step 5: npm run build と npm run test を両方パスさせる
- Step 6: 全変更をcommitしてpushし、draft PRを通常PRに変換する
  1. `gh pr ready #{PR番号}` でdraftを解除する
  2. `gh pr edit #{PR番号} --title "..." --body "..."` でタイトルと本文を実装内容に合わせて更新する
     （"WIP: "プレフィックスを外し、.github/PULL_REQUEST_TEMPLATE.md の全セクションを埋めること）
     **`gh pr ready` だけで終わらせてはいけない。本文の更新は必須。**
     `gh pr edit` がエラーになる場合は `gh api repos/{owner}/{repo}/pulls/#{PR番号} --method PATCH --field title="..." --field body="..."` で代替すること。
- Step 7: 完了報告（AGENTS.mdフォーマット）

【テスト実行ルール】
- 実装中の動作確認は対象ファイルのみを指定して実行する:
  `npm run test -- --testPathPattern="{対象ファイル名}" --watchAll=false`
- テスト結果はファイルに保存してRead/Grepで確認する（再実行しない）:
  `npm run test -- --watchAll=false 2>&1 | tee /tmp/test-result.txt`
- フルテストスイートは実装が全ファイル完了してから1回のみ実行する
- 同じテストコマンドをgrepの引数だけ変えて繰り返すことを禁止する
- テスト失敗が3回試行しても解決しない場合はループせず中断して報告する

【禁止】PRのマージ、mainへの直接コミット
【報告】ビルド・テスト結果とPR URLを返答してください。
```

---

### Phase 3: 結果集約・報告

全workerの完了を待ち、以下のフォーマットで報告する:

```
## 並列実装完了

### 作成されたPR
| Issue | PR | ブランチ | ステータス |
|---|---|---|---|
| #44 ピン留め | #XX {URL} | feature/pin-message/#44 | レビュー待ち |
| #46 メンション通知バッジ | #XX {URL} | feature/mention-badge/#46 | レビュー待ち |

### ビルド・テスト結果
| Issue | ビルド | テスト |
|---|---|---|
| #44 | 成功 | 成功（XX件） |
| #46 | 成功 | 成功（XX件） |

### 推奨マージ順序
1. #44 をマージ → #45 の実装を開始
2. #46 をマージ → #43 の実装を開始

### 次のフェーズ
マージ完了後に `/parallel-feature-dev #45 #43` を実行してください。
```

---

## 注意事項

- **PRのマージはユーザーが実施する**。オーケストレーターもworkerもマージを実行しない
- **オーケストレーターは直接コードを修正しない**。バグや不具合を発見した場合は内容をユーザーに報告し、該当ブランチのworkerエージェントを起動して修正を委譲する
- workerが失敗した場合はエラー内容を報告し、再試行か手動対応かをユーザーに確認する
- **DBスキーマ（`db/schema.hcl`）の競合**: 複数workerが同じスキーマ変更を含む場合は別Phaseに分ける。worktreeはファイルを隔離するが、SQLiteのDBファイル（`packages/server/data/chat.db`）は共有されるため、`atlas schema apply` は並列実行しない
- workerが失敗した場合、そのworktreeのブランチは残るので次回再利用できる
