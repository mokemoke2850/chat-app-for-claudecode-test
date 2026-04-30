# Issue #146〜#154 実装計画サマリー

> 本ドキュメントは経過記録として更新する運用とする。各 Issue の詳細注意点は同フォルダ内の `issue-XXX.md` を参照。

最終更新: 2026-04-30（Phase 2 全マージ完了）

---

## 全体方針

- **デグレを抑える観点**: 同一ファイル（特に `UserAvatar` / `MessageInput` / 認証ミドルウェア / メッセージ送信パス / `ChatPage`）を複数 Issue で同時に編集しないようにフェーズ分割する
- **手戻りを抑える観点**: 後続 UI が乗る予定の基盤（プレゼンス基盤・ヘッダー圧縮）は先に着地させる
- **並列性を確保する観点**: 各フェーズ内では「触るファイルが重ならない Issue」を 2〜3 本同時に進められるようにグループ化する

## 想定マージ順 / 並列グループ

| Phase | Issue | 難易度 | 並列可否 | 主な触るレイヤ |
|---|---|---|---|---|
| 1 | **#154** チャットヘッダーのコンパクト化 | 低 | 並列OK | `ChatPage.tsx` / `ChannelTopicBar.tsx` のみ |
| 1 | **#146** オンライン/オフラインステータス | 低 | 並列OK | Socket / `UserAvatar` 周辺 / プレゼンス Service 新規 |
| 1 | **#148** 下書き保存 | 中 | 並列OK | DB 新テーブル / `MessageInput` / サイドバー識別 |
| 2 | **#147** カスタムステータス | 低 | 並列OK | DB 拡張 / `UserAvatar` 表示 / プロフィール |
| 2 | **#150** 保存ビュー | 中 | 並列OK | DB 新テーブル / 検索ダイアログ / サイドバー |
| 2 | **#151** タスク管理ボード | 中 | 並列OK | DB 新テーブル / 新ページ / `MessageActions` |
| 3 | **#149** ゲスト閲覧リンク | 中 | 並列OK | 認証 / 認可 / 公開モードの新ページ |
| 3 | **#152** カレンダー / 予定調整 | 中 | 並列OK | DB 新テーブル / 新ページ / 既存リマインダー連動 |
| 3 | **#153** レート制限 | 低 | 並列OK | 送信パス全体への横断ミドルウェア |

### Phase 並列グループの根拠

**Phase 1（#154 / #146 / #148）**
- #154 は `ChatPage.tsx`（ヘッダー領域）と `ChannelTopicBar.tsx` のみ。
- #146 は `UserAvatar.tsx` / メンバー一覧 / Socket 層に集中し、ヘッダーや入力欄には触らない。
- #148 は `MessageInput`（編集中本文の保存）/ サイドバーでの下書きインジケータ。`UserAvatar` も `ChannelTopicBar` も触らない。
- → 3 本並列で衝突せず着地できる。後続フェーズで触る `UserAvatar` / `MessageActions` / `ChatPage` の状態を先に整えておくとリベースが楽。

**Phase 2（#147 / #150 / #151）**
- #147 は `UserAvatar`・`UserProfilePopover` を触るが、#146 の表示基盤の上にステータス絵文字を追加する形。Phase 1 の #146 が main に入ってからスタートするのが安全。
- #150 は `SearchFilterPanel` / `SearchResults` / サイドバー（保存ビュー一覧）。
- #151 は `MessageActions`（コンテキストメニュー） / 新ページ `TaskBoardPage` / サイドバーリンク。
- → サイドバーの追加リンクは追記中心で衝突しにくい。`MessageActions` を触るのは #151 だけ。

**Phase 3（#149 / #152 / #153）**
- #149 は認証ミドルウェアと認可レイヤを大きく触り、公開ビュー用の新ページを足す。
- #152 は新ページ + 新ジョブ。既存の `eventService`（#108 由来）と概念が異なる点を仕様確認した上で別テーブルにする想定。
- #153 は送信パス（HTTP `/messages`、`/dm`、`/scheduled-messages`、Socket `messageHandler` / `dmHandler`）に横断的にレート制限フックを入れる。Phase 1〜2 で入る送信系の小修正がすべて main に乗ってから入れることでマージ衝突を最小化する。
- → 3 本同時着手可だが、#153 だけは Phase 2 のマージ完了を待ってから始めるのが望ましい。

## 依存関係

- **#147 → #146**: ステータス絵文字の表示位置やプレゼンスドットとの併存設計を #146 で確定させた後の方が手戻りがない。
- **#153 → 他全機能の送信系**: 送信エンドポイントが安定してから一括でレート制限ミドルウェアを差し込みたい。
- **その他は相互独立**

```
Phase 1: [#154] [#146] [#148]   ← 並列着手
                  │
                  ▼
Phase 2: [#147] [#150] [#151]   ← #146 マージ後に並列着手
                                  ↓
Phase 3: [#149] [#152] [#153]   ← Phase 2 マージ後に並列着手（特に #153）
```

## 進捗ステータス（経過記録）

| Issue | 計画ドキュメント | ブランチ | PR | テスト項目確認 | マージ | 備考 |
|---|---|---|---|---|---|---|
| #146 | [issue-146.md](issue-146.md) | feature/presence-status/#146 | [#159](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/159) | 済 | 済 (2026-04-30) | 実機検証で MessageItem の結線漏れを発見、追加コミットで修正 |
| #147 | [issue-147.md](issue-147.md) | feature/custom-status/#147 | [#167](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/167) | 済 | 済 (2026-04-30) | 1 回目 worker は worktree-agent ブランチで作業し成果消失 → fresh worktree で再起動して復旧。マージ前に main の MessageItem 修正とコンフリクト → worker に解消委譲 |
| #148 | [issue-148.md](issue-148.md) | feature/draft-save/#148 | [#158](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/158) | 済 | 済 (2026-04-30) | クライアント結線（GET /drafts → draftMap → ChannelItem/RichEditor）の追加修正あり。マージ時に main と衝突→解消 |
| #149 | [issue-149.md](issue-149.md) | - | - | - | - | |
| #150 | [issue-150.md](issue-150.md) | feature/saved-views/#150 | [#166](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/166) | 済 | 済 (2026-04-30) | 1 回目 reject / 2 回目 watchdog タイムアウト（10分進捗なし）/ 3 回目 opus + 背景実行で完了。実機テストで SearchFilterPanel の結線漏れ発覚→修正コミット追加 |
| #151 | [issue-151.md](issue-151.md) | feature/task-board/#151 | [#168](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/168) | 済 | 済 (2026-04-30) | 1 回目 worker は worktree-agent ブランチで作業し成果消失 → fresh worktree + 背景実行で復旧。実機テストで多数のバグ・機能不足発覚（DnD 列ドロップ未実装・担当者選択肢空・チャネル紐付け未保存・編集 UI 欠落・非表示 Switch の再フェッチ漏れ）→ 4 回の追加修正コミットで対応 |
| #152 | [issue-152.md](issue-152.md) | - | - | - | - | |
| #153 | [issue-153.md](issue-153.md) | - | - | - | - | |
| #154 | [issue-154.md](issue-154.md) | feature/compact-chat-header/#154 | [#157](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/157) | 済 | 済 (2026-04-30) | 一発マージ、コンフリクトなし |

### Phase 1 振り返り（2026-04-30）

- **3 本並列実装に成功**：Phase 1 想定通り `parallel-feature-dev` で 3 worker 同時起動 → ファイル衝突なしで着地
- **ハマりどころ**：
  - **クライアント側の結線漏れ**：worker が「テストは通るが実機でデータが流れない」状態で PR 上げる事案が #146 / #148 の両方で発生。Vitest（jsdom）では検出できず、Playwright 実機検証で初めて発覚した
    - #148: 初期 `GET /drafts` 呼び出し / `draftMap` の prop 伝播 / `RichEditor.initialContent` 渡しの 3 箇所が抜けていた
    - #146: `MessageItem` のアバターと `UserProfilePopover` への state 伝播が抜けていた（usePresence 呼び出し自体は他 3 コンポーネントで実装済みだったが最も目に入る MessageItem を漏らしていた）
  - **worker の中途報告**：1 度 #146 worker が worktree マージ衝突で破損した状態で「completed」を返した。fresh worktree で再実装することで復旧
  - **マージ衝突**：#157 / #159 マージ後、#158 が `ChatPage.tsx` / `shared/index.ts` で衝突。worker に解消委譲して merge コミットで対応
- **教訓**：
  - 「テストカバレッジは結線まで届いていない」前提で **実機検証を Playwright で行う運用を Phase 2 以降も継続**
  - worker の途中中断パターンに備え、**完了通知後に PR 状態（draft 解除済みか・最新コミット内容）を必ずオーケストレーターが再確認する**

### Phase 2 振り返り（2026-04-30）

- **3 本 PR レビュー待ち到達**：#147 / #150 / #151 すべて Draft 解除・通常 PR 化、テスト・ビルド成功（合計 3000 件超のテスト全パス）
- **ハマりどころ（Phase 1 を上回るトラブル多発）**：
  - **worker が feature ブランチへ切り替えない問題**：Phase 2 初回起動の 3 worker 全員が、worktree のデフォルトブランチ（`worktree-agent-XXX`）のまま作業を進め、feature ブランチに 1 コミットも push されない事態。プロンプトに「ブランチはすでに存在し」と書いたため worker が「自分の現在ブランチが正しい」と勘違いしたのが原因
  - **長時間 worker のフォアグラウンド起動 → ユーザー reject**：1 worker あたり 10〜15 分かかるが途中報告できないため、ユーザー側に「進捗が見えない」と判断されて 2 worker が停止された
  - **watchdog タイムアウト**：#150 worker（2 回目）がビルドエラー解消ループに陥り 10 分進捗なしで強制終了。中間成果物が commit されないまま消失
  - **メイン作業ディレクトリの汚染**：別 worktree で動いていた worker の変更（`saved_views` / `tasks` の schema.hcl 追加・各種新規ファイル）がメインの `chore/dependabot-updates` 作業ディレクトリにも混入。原因究明は別途
  - **DB スキーマ未適用**：worker に `atlas schema apply` 禁止指示を出したため、ユーザーが #147 をテストする際 `column "status_emoji" of relation "users" does not exist` で詰まった
- **教訓**：
  - **`run_in_background: true` を必須化**（`parallel-feature-dev` スキルに反映済み）。worker は完了通知まで途中報告不可のため、フォアグラウンド起動は reject 事故を招く
  - **feature ブランチ切替は明示的かつ複数回確認**（プロンプトに `git checkout` → `git branch --show-current` の手順を必須化、Step 3/5/6 の前にも再確認）
  - **ループ防止ルール（3 回リトライ → WIP commit + push + 中断）をプロンプトに必ず書く**：watchdog タイムアウト時の成果消失を防ぐ
  - **DB スキーマ apply のタイミング設計が必要**：worker に apply させない方針は維持しつつ、ユーザーが個別ブランチをテストする際の手順（worktree 内で `atlas schema apply --env local`）をスキルや手順書に追加すべき
  - **opus へのエスカレーション**：sonnet で失敗したケースを opus に切り替えると成功する事例あり（#150 が好例）。困ったら opus

## 共通注意事項

- **AGENTS.md の TDD フローを必ず遵守**: テスト項目作成 → ユーザー確認 → テスト実装 → プログラム実装 → テスト確認の順を守る。
- **DB スキーマ変更は `db/schema.hcl` を編集して `atlas schema apply --env local` を実行**。`database.ts:initializeSchema` は触らない。
- **PR テンプレ全セクションを埋める**（`.github/PULL_REQUEST_TEMPLATE.md`）。
- **既存テストの修正は理由必須**（仕様変更 / バグ修正 / テスト誤り）。
- **`UserAvatar` / `MessageInput` / `ChatPage.tsx` / `MessageActions.tsx` / `middleware/auth.ts` を編集する Issue は同時並行を避ける**（衝突危険ファイル）。
- 並列実行する場合は `parallel-feature-dev` スキルの利用を検討するが、テスト項目確認は GitHub PR 画面で実施する運用。

## 仕様確認事項（実装着手前にユーザー確認）

- **#149 ゲスト閲覧リンクのパスワード保護**: bcrypt 等のハッシュ保存の必要性、入力 UI の有無
- **#152 カレンダー**: 既存 `events` テーブル（#108 会話イベント投稿）とどう棲み分けるか。別テーブル推奨。
- **#153 レート制限**: 閾値はワークスペース全体で 1 設定なのか、ユーザー単位 / チャンネル単位で個別設定か。管理 UI の必要性。
- **#147 カスタムステータス**: `users` テーブル拡張で十分か（履歴を持たないので新テーブル不要と想定）。
- **#150 保存ビュー**: 「サイドバー」とは `ChannelList` 配下に保存ビュー専用セクションを足すのか、別領域なのか。

各論点は対応する `issue-XXX.md` の「仕様確認事項」節で詳細化している。
