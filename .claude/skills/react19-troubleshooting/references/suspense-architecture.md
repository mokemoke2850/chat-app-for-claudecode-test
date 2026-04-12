# Suspense アーキテクチャ詳細

## React 18 vs React 19 の Suspense 動作の違い

### React 18

Suspense がフォールバックを表示するとき、子ツリーは DOM から **非表示**にされるが、
React の fiber（コンポーネント状態）は保持される。

```
<Suspense fallback={<Spinner />}>
  <Component />  ← fiber 保持、DOM のみ非表示
</Suspense>
```

- `useState` の値はフォールバック中も保持
- プロミスが解決したら既存 fiber で再レンダリング

### React 19

Suspense がフォールバックを表示するとき、子ツリーが **unmount** される。

```
<Suspense fallback={<Spinner />}>
  <Component />  ← 完全に unmount → state リセット
</Suspense>
```

- フォールバック表示と同時に `Component` の `useState` が消える
- プロミス解決後に `Component` を **再マウント**
- 再マウント時に `useState` 初期化関数が再実行される

## 無限ループが発生するメカニズム

```
// ❌ このパターンで無限ループ発生

// App.tsx
<Suspense fallback={<Spinner />}>
  <AuthProvider />        ← ① Suspense 内側
</Suspense>

// AuthProvider
function AuthProvider() {
  const [promise] = useState(() => api.me());  // ← ② 初期化関数
  const user = use(promise);                   // ← ③ サスペンド
  ...
}
```

**ループの手順:**

1. `AuthProvider` レンダリング → `useState` 初期化関数実行 → `promise1` 生成 → `api.me()` 呼び出し
2. `use(promise1)` がサスペンド
3. React 19: Suspense フォールバック表示 + `AuthProvider` **unmount**
4. `api.me()` レスポンス返却 → `promise1` 解決
5. React: `AuthProvider` **再マウント** → `useState` 初期化関数**再実行** → `promise2` 生成 → `api.me()` 再呼び出し
6. `use(promise2)` がサスペンド（`promise2` はまだ pending）
7. → ③ に戻る（無限ループ）

## 正しい構造が機能するメカニズム

```
// ✅ このパターンで正常動作

function AuthProvider() {                        // ← Suspense の外側
  const [promise] = useState(() => api.me());   // ← unmount されない

  return (
    <Suspense fallback={<Spinner />}>            // ← AuthProvider が持つ内部 Suspense
      <AuthProviderContent promise={promise} />  // ← ここが unmount される
    </Suspense>
  );
}

function AuthProviderContent({ promise }) {
  const user = use(promise);  // ← サスペンド・unmount されても OK
  ...
}
```

**正常な手順:**

1. `AuthProvider` レンダリング → `promise1` 生成 → `api.me()` 呼び出し
2. `AuthProviderContent` → `use(promise1)` がサスペンド
3. React 19: 内部 Suspense フォールバック表示 + `AuthProviderContent` **unmount**
4. `AuthProvider` は**そのまま生存**（Suspense の外側）
5. `api.me()` レスポンス返却 → `promise1` 解決
6. React: `AuthProviderContent` **再マウント** → `use(promise1)` が解決済み値を返す
7. レンダリング完了 ✅

## Suspense 境界の正しい配置ルール

**ルール**: `use(promise)` で使うプロミスを生成する `useState`/`useMemo` は、
そのプロミスをキャッチする `<Suspense>` よりも**上位のコンポーネント**になければならない。

```
ComponentA              ← useState で promise 生成（ここは unmount されない）
  └── <Suspense>        ← ComponentA が内部に持つ
        └── ComponentB  ← use(promise) で消費（ここが unmount される）
```

**NGパターン一覧:**

```
// NG①: 同一コンポーネント内
<Suspense>
  <X />  ← useState と use() が同じコンポーネント
</Suspense>

// NG②: 親子でも Suspense が外側
<Suspense>          ← 外側
  <Parent>          ← useState
    <Child />       ← use()
  </Parent>
</Suspense>

// OK: Suspense が useState の内側
<Parent>            ← useState
  <Suspense>        ← Parent が内部に持つ
    <Child />       ← use()
  </Suspense>
</Parent>
```

## ネストした Suspense の考え方

複数の非同期データを扱う場合、それぞれが独立した Suspense 境界を持てる。

```tsx
// チャンネルページの例
function ChannelPage() {
  const [channelsPromise] = useState(() => api.channels.list());

  return (
    <Layout>
      {/* チャンネルリストの Suspense */}
      <Suspense fallback={<ChannelSkeleton />}>
        <ChannelListContent channelsPromise={channelsPromise} />
      </Suspense>

      {/* メッセージの Suspense は別コンポーネントが管理 */}
      <MessageArea />
    </Layout>
  );
}
```

## useMemo を使う場合の注意点

`useMemo` はメモリ不足時に値をクリアする可能性があるが、
通常のユースケース（依存値が変わったときだけ再生成）では `useState` の代替として使える。

依存値がある場合は `useMemo` が適切:

```tsx
// open や channelId が変わったら新しいプロミスを生成する場合
const dataPromise = useMemo(() => {
  if (!open) return null;
  return Promise.all([api.auth.users(), api.channels.getMembers(channelId)]);
}, [open, channelId]);
```

ただし依存値が変化しない（マウント時の一度だけ）なら `useState` を使う:

```tsx
// マウント時に一度だけ生成
const [dataPromise] = useState(() => api.fetchData());
```
