# React 19 use() / Suspense ガイド

フロントエンド（`packages/client`）は React 19 で開発する。
API データをレンダリング時に読む場合は `use()` と `<Suspense>` を使い、Promise を安定化させる。

## 基本ルール

- `useEffect` と API 呼び出しの組み合わせで初期データ取得を書かない
- `use(promise)` に渡す Promise は `useState` または `useMemo` で安定化する
- Promise を生成するコンポーネントは、その Promise を受ける `<Suspense>` より外側に置く
- `use()` で Promise を消費するコンポーネントは `<Suspense>` の内側に置く

## React 19 の Suspense 動作

React 19 では Suspense フォールバック表示時に、境界内の子ツリーが unmount される。
React 18 のように state を保持したまま hide される前提で実装すると、Promise 生成が繰り返される。

危険な構造:

```tsx
<Suspense fallback={<Spinner />}>
  <DataComponent />
</Suspense>

function DataComponent() {
  const [promise] = useState(() => api.fetchData());
  const data = use(promise);
  return <View data={data} />;
}
```

`DataComponent` がサスペンドすると unmount され、再マウント時に `useState` 初期化関数が再実行される。
新しい Promise が生成され続けると、API リクエストの無限ループになる。

安全な構造:

```tsx
function DataContainer() {
  const [dataPromise] = useState(() => api.fetchData());

  return (
    <Suspense fallback={<Spinner />}>
      <DataContent dataPromise={dataPromise} />
    </Suspense>
  );
}

function DataContent({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise);
  return <View data={data} />;
}
```

## useState と useMemo の使い分け

マウント時に一度だけ Promise を作る場合は `useState` を使う。

```tsx
const [dataPromise] = useState(() => api.fetchData());
```

依存値が変わったときに Promise を作り直す場合は `useMemo` を使う。

```tsx
const dataPromise = useMemo(() => {
  if (!open) return null;
  return api.fetchData(channelId);
}, [open, channelId]);
```

## 診断フロー

画面がローディングのまま固まる、API が連続発火する、`use()` 移行後に再レンダーが止まらない場合は以下を確認する。

1. ブラウザ実機確認で `/api/` リクエスト数を数える
2. 特定パスが数十件以上発火していれば無限ループを疑う
3. Promise を生成している `useState` / `useMemo` が Suspense 境界の内側にないか確認する
4. `use()` を呼ぶコンポーネントと Promise 生成コンポーネントを分割する
5. StrictMode 開発環境では正常でも初期化関数が複数回呼ばれるため、2回程度の API 発火だけでバグ扱いしない

## このプロジェクトの参照実装

| コンポーネント | Promise 生成側 | Promise 消費側 |
|---|---|---|
| `AuthContext.tsx` | `AuthProvider` | `AuthProviderContent` |
| `App.tsx` | `ChatWithUsers` | `ChatWithUsersContent` |
| `ChannelList.tsx` | `ChannelList` | `ChannelListContent` |
| `ChannelMembersDialog.tsx` | `ChannelMembersDialog` | `MembersContent` |
| `CreateChannelDialog.tsx` | `CreateChannelDialog` | `UsersList` |

## Vitest パターン

初期レンダリング時に `use()` がサスペンドする場合は `act(async)` で render を包む。

```tsx
await act(async () => {
  render(
    <Suspense fallback={<div data-testid="loading" />}>
      <ComponentWithUse />
    </Suspense>,
  );
});

expect(screen.getByText('expected')).toBeInTheDocument();
```

ユーザー操作後にサスペンドする場合は `findBy` クエリで解決を待つ。

```tsx
await userEvent.click(screen.getByRole('button', { name: '開く' }));
await screen.findByText('読み込み後の表示');
```

React 19 では function component mock の第2引数は `undefined` になる。

```tsx
expect(MockComponent).toHaveBeenLastCalledWith(
  expect.objectContaining({ prop: 'value' }),
  undefined,
);
```

StrictMode の double-invoke があるため、API 呼び出し回数を `toHaveBeenCalledTimes(1)` で固定しない。
呼び出されたこと自体が重要なテストでは `toHaveBeenCalled()` を使う。

