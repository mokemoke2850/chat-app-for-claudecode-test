/**
 * テスト対象: ピン留めチャンネル機能（クライアントサイド）
 * 戦略:
 *   - api.channels.pin / unpin を vi.mock で差し替えてネットワーク通信を排除
 *   - ChannelList コンポーネントのピン留めUI（ボタン表示・セクション分割・localStorage永続化）を検証
 *   - ピン留め状態はユーザーごとに localStorage に永続化されることを確認する
 *
 * ※ 既存の ChannelList.test.tsx にピン留め基本動作のテストがあるため、
 *   このファイルはAPIベースの永続化・ユーザー分離に関する追加ケースを担う
 */

describe('ChannelList: ピン留めチャンネルのUI表示', () => {
  describe('ピン留めセクションの表示', () => {
    it('ピン留めチャンネルが存在する場合、「ピン留め」セクションがサイドバー最上部に表示される', async () => {
      // TODO
    });

    it('ピン留めチャンネルが存在しない場合、「ピン留め」セクションは表示されない', async () => {
      // TODO
    });

    it('ピン留めセクションのチャンネルは通常セクション（all-channels）には表示されない', async () => {
      // TODO
    });
  });

  describe('ピン留め操作UI', () => {
    it('未ピン留めチャンネルにホバーすると「ピン留め」ボタン（PushPinOutlined）が表示される', async () => {
      // TODO
    });

    it('ピン留め済みチャンネルにホバーすると「ピン留めを解除」ボタン（PushPin）が表示される', async () => {
      // TODO
    });
  });
});

describe('ChannelList: ピン留め状態の永続化', () => {
  describe('localStorage による永続化', () => {
    it('ピン留めするとユーザーIDに紐づいたキーで localStorage に保存される', async () => {
      // TODO
    });

    it('コンポーネント再マウント後も localStorage からピン留め状態が復元される', async () => {
      // TODO
    });

    it('異なるユーザーのピン留め状態は独立して保存・復元される', async () => {
      // TODO
    });
  });
});

describe('ChannelList: 検索とピン留めの連携', () => {
  it('検索ワード入力時、ピン留めチャンネルも検索結果でフィルタリングされる', async () => {
    // TODO
  });

  it('検索ワードに一致しないピン留めチャンネルはピン留めセクションから非表示になる', async () => {
    // TODO
  });
});
