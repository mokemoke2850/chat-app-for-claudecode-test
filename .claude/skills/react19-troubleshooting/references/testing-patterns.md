# React 19 + Vitest テストパターン

このプロジェクト（`packages/client`）で `use()` + `<Suspense>` を含むコンポーネントを
テストするときのパターン集。

## 基本原則

React 19 の `use()` がサスペンドする際、`waitFor` だけではサスペンドを解消できない。
`act(async)` または `findBy` クエリ（内部で `waitFor` を使用）が必要。

## パターン1: 初期レンダリングで use() がサスペンドする場合

コンポーネントが**マウント時点**で `use()` を呼び、サスペンドするケース。

```tsx
// ✅ 正しいパターン
async function renderWithSuspense(ui: React.ReactNode) {
  await act(async () => {
    render(
      <Suspense fallback={<div data-testid="loading" />}>
        {ui}
      </Suspense>
    );
  });
  // act が完了した時点でサスペンドは解消されている
}

it('データを表示する', async () => {
  mockApi.mockResolvedValue({ data: [...] });
  await renderWithSuspense(<MyComponent />);
  expect(screen.getByText('expected')).toBeInTheDocument();
});
```

**なぜ `waitFor` ではなく `act(async)` か?**
`waitFor` は `setTimeout` ベースのポーリングで React の Suspense 解消を
トリガーできない。`act(async)` は React の非同期作業キューを完全にフラッシュする。

## パターン2: ユーザー操作後に use() がサスペンドする場合

ボタンクリックやトグルなど、**ユーザー操作**によって `useMemo` が新しいプロミスを
生成し、`use()` がサスペンドするケース（CreateChannelDialog のプライベートトグルなど）。

```tsx
// ✅ 正しいパターン: screen.findBy でサスペンド解消を待つ
it('プライベートトグルでメンバー一覧が表示される', async () => {
  mockUsers.mockResolvedValue({ users: [{ id: 1, username: 'alice' }] });

  render(<CreateChannelDialog open={true} ... />);
  await userEvent.click(screen.getByLabelText(/private/i));

  // findBy はサスペンドが解消されるまで待機する
  await screen.findByRole('list', { name: /members/i });

  expect(screen.getByText('alice')).toBeInTheDocument();
});
```

**なぜ `act(async () => {})` では不十分か?**
`userEvent.click` の後に続く `act(async () => {})` は、クリックによって
トリガーされた Suspense の解消を待たない。`findBy` のほうが確実。

## パターン3: open=true で即座に use() がサスペンドするダイアログ

`ChannelMembersDialog` のように、`open=true` の時点で API を呼んでサスペンドするケース。

```tsx
// ✅ 正しいパターン
async function renderDialog(props) {
  await act(async () => {
    render(<ChannelMembersDialog {...props} />);
  });
}

it('メンバー一覧を表示する', async () => {
  mockUsers.mockResolvedValue({ users: [makeUser(1, 'alice')] });
  mockGetMembers.mockResolvedValue({ members: [] });

  await renderDialog({ open: true, channelId: 1, onClose: vi.fn() });

  expect(screen.getByText('alice')).toBeInTheDocument();
});
```

## よくある失敗パターンと修正

### ❌ waitFor でサスペンドを待とうとする

```tsx
// ❌ React 19 の use() サスペンドには効かない
render(<ComponentWithUse />);
await waitFor(() => {
  expect(screen.getByText('data')).toBeInTheDocument(); // タイムアウトする
});

// ✅ act(async) を使う
await act(async () => {
  render(<ComponentWithUse />);
});
expect(screen.getByText('data')).toBeInTheDocument();
```

### ❌ React 19 のコンポーネント第2引数に expect.anything() を使う

```tsx
// ❌ React 19 は function component の第2引数が undefined
expect(MockComponent).toHaveBeenLastCalledWith(
  expect.objectContaining({ prop: 'value' }),
  expect.anything(), // React 18 は {} だが React 19 は undefined → 失敗
);

// ✅
expect(MockComponent).toHaveBeenLastCalledWith(
  expect.objectContaining({ prop: 'value' }),
  undefined,
);
```

### ❌ StrictMode の double-invoke を無視した toHaveBeenCalledTimes(1)

```tsx
// ❌ React 19 StrictMode では useState 初期化関数が2回呼ばれることがある
expect(mockApiCall).toHaveBeenCalledTimes(1); // 失敗する場合がある

// ✅ 「少なくとも1回」で検証
expect(mockApiCall).toHaveBeenCalled();
```

## AuthContext テストのパターン

`AuthProvider` は内部に `<Suspense>` を持ち、`use()` でサスペンドする。
テスト時は `AuthProvider` 自体が Suspense を管理するので、外側に `<Suspense>` を追加する。

```tsx
async function renderWithAuth(ui: React.ReactNode) {
  await act(async () => {
    render(
      <Suspense fallback={<div data-testid="loading" />}>
        <AuthProvider>{ui}</AuthProvider>
      </Suspense>
    );
  });
}
```

`AuthProvider` の内部 Suspense のフォールバックと衝突しないよう、
外側の `fallback` は `data-testid="loading"` のみの最小限にする。

## テストモックのセットアップ

`use()` は Promise の状態を追跡する。テストでは必ず `beforeEach` で
モックをリセットし、各テストで独立した Promise が生成されるようにする。

```tsx
beforeEach(() => {
  vi.resetAllMocks(); // または vi.clearAllMocks()
});

it('正常系', async () => {
  mockApi.mockResolvedValue({ data: 'value' });
  // ...
});

it('エラー系', async () => {
  mockApi.mockRejectedValue(new Error('失敗'));
  // ...
});
```

`vi.resetAllMocks()` を使わないと、前のテストの Promise が次のテストに
混入して予期しない動作になる。
