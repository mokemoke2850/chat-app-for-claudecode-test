/**
 * テスト対象: チャンネルピン留め機能（サーバーサイド）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層・API層を直接テストする。
 *       pinned_channels テーブルへの CRUD 操作と、ユーザーごとの永続化を検証する。
 */

describe('ピン留めチャンネル: サービス層', () => {
  describe('pinChannel', () => {
    it('チャンネルをピン留めできる', async () => {
      // TODO
    });

    it('存在しないチャンネルのピン留めはエラーになる', async () => {
      // TODO
    });

    it('同じチャンネルを同じユーザーが二重にピン留めしようとするとエラーになる', async () => {
      // TODO
    });
  });

  describe('unpinChannel', () => {
    it('ピン留めを解除できる', async () => {
      // TODO
    });

    it('ピン留めされていないチャンネルの解除はエラーになる', async () => {
      // TODO
    });
  });

  describe('getPinnedChannels', () => {
    it('ユーザーのピン留めチャンネル一覧を返す', async () => {
      // TODO
    });

    it('ピン留めが存在しないユーザーでは空配列を返す', async () => {
      // TODO
    });

    it('ピン留めは created_at の昇順（登録順）で返される', async () => {
      // TODO
    });

    it('別のユーザーのピン留め状態は返さない（ユーザーごとに独立）', async () => {
      // TODO
    });
  });
});

describe('REST API: GET /api/channels/pinned', () => {
  it('200 でログインユーザーのピン留めチャンネル一覧を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });
});

describe('REST API: POST /api/channels/:id/pin', () => {
  it('ピン留め成功で 201 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    // TODO
  });

  it('既にピン留め済みで 409 を返す', async () => {
    // TODO
  });
});

describe('REST API: DELETE /api/channels/:id/pin', () => {
  it('ピン留め解除成功で 204 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('ピン留めが存在しない場合 404 を返す', async () => {
    // TODO
  });
});
