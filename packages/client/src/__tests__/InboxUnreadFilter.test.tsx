/**
 * テスト対象: 受信箱タブの未読／既読フィルタトグル機能
 *
 * 対象ファイル:
 *   - packages/client/src/pages/InboxPage.tsx （トグルスイッチ UI・localStorage 永続化）
 *   - packages/client/src/components/Inbox/MentionsList.tsx （unreadOnly prop）
 *   - packages/client/src/components/Inbox/ThreadsList.tsx  （unreadOnly prop）
 *   - packages/client/src/components/Inbox/RemindersList.tsx（unreadOnly prop）
 *   - packages/client/src/components/Inbox/DraftsList.tsx   （unreadOnly prop）
 *
 * 戦略:
 *   - InboxPage のトグル UI は MemoryRouter + vi.mock で Suspense を切り離して検証する
 *   - localStorage の読み書きは vi.spyOn(Storage.prototype, ...) で検証する
 *   - 各 List コンポーネントの unreadOnly prop は純粋コンポーネントに直接 prop を渡して検証する
 *   - 複数コンポーネントにまたがるためファイルを新規作成（AGENTS.md 方針に準拠）
 */

describe('受信箱 未読フィルタトグル - InboxPage', () => {
  describe('トグルスイッチの表示', () => {
    it.todo('メンションタブを開くとタブヘッダー右側にトグルスイッチが表示される');
    it.todo('スレッドタブを開くとタブヘッダー右側にトグルスイッチが表示される');
    it.todo('リマインダータブを開くとタブヘッダー右側にトグルスイッチが表示される');
    it.todo('下書きタブを開くとタブヘッダー右側にトグルスイッチが表示される');
    it.todo('すべてタブを開くとタブヘッダー右側にトグルスイッチが表示される');
  });

  describe('トグルスイッチの初期状態', () => {
    it.todo('localStorage に値がない場合は「未読のみ」がデフォルト状態になる');
    it.todo('localStorage に unreadOnly=false が保存されている場合は「全件」状態で開く');
    it.todo('localStorage に unreadOnly=true が保存されている場合は「未読のみ」状態で開く');
  });

  describe('トグルスイッチの操作', () => {
    it.todo('「未読のみ」→「全件」に切り替えると localStorage に false が保存される');
    it.todo('「全件」→「未読のみ」に切り替えると localStorage に true が保存される');
    it.todo('タブを切り替えてもトグルの状態が維持される');
  });

  describe('フィルタ状態と API 呼び出しの連携', () => {
    it.todo(
      'unreadOnly=true のときメンションタブで api.messages.search が unreadOnly:true で呼ばれる',
    );
    it.todo(
      'unreadOnly=false のときメンションタブで api.messages.search が unreadOnly:false で呼ばれる',
    );
    it.todo(
      'unreadOnly=true のときスレッドタブで api.threads.listSubscribed が unreadOnly:true で呼ばれる',
    );
    it.todo(
      'unreadOnly=false のときスレッドタブで api.threads.listSubscribed が unreadOnly:false で呼ばれる',
    );
  });
});

describe('受信箱 未読フィルタトグル - MentionsList', () => {
  describe('unreadOnly prop の受け取り', () => {
    it.todo('unreadOnly=true のとき「未読のみ表示中」などのラベルまたは表示件数が絞られる');
    it.todo('unreadOnly=false のときすべてのメンションが表示される');
    it.todo('unreadOnly prop が渡されない場合でも既存の動作が変わらない（後方互換）');
  });
});

describe('受信箱 未読フィルタトグル - ThreadsList', () => {
  describe('unreadOnly prop の受け取り', () => {
    it.todo('unreadOnly=true のとき未読フラグを持つスレッドのみ表示される');
    it.todo('unreadOnly=false のとき全スレッドが表示される');
    it.todo('unreadOnly prop が渡されない場合でも既存の動作が変わらない（後方互換）');
  });
});

describe('受信箱 未読フィルタトグル - RemindersList', () => {
  describe('unreadOnly prop の受け取り', () => {
    it.todo('unreadOnly=true のとき未読のリマインダーのみ表示される');
    it.todo('unreadOnly=false のとき全リマインダーが表示される');
    it.todo('unreadOnly prop が渡されない場合でも既存の動作が変わらない（後方互換）');
  });
});

describe('受信箱 未読フィルタトグル - DraftsList', () => {
  describe('unreadOnly prop の受け取り', () => {
    it.todo('unreadOnly=true のとき未読フラグを持つ下書きのみ表示される');
    it.todo('unreadOnly=false のとき全下書きが表示される');
    it.todo('unreadOnly prop が渡されない場合でも既存の動作が変わらない（後方互換）');
  });
});
