---
name: React 19 Troubleshooting
description: This skill should be used when a React 19 related bug is suspected in this project — for example "spinner keeps showing", "infinite API requests", "use() causes loop", "Suspense doesn't resolve", "component remounts unexpectedly", or when migrating from useEffect to use() causes runtime regressions. Provides React 19-specific diagnosis patterns, root-cause checklists, and the correct use()+Suspense architecture for this codebase.
version: 0.1.0
---

# React 19 Troubleshooting

このスキルはこのプロジェクト（`packages/client`）で React 19 に起因する不具合が疑われるときに使う。
特に `use()` + `<Suspense>` の組み合わせで発生する無限ループや画面固着を診断・修正するための知識を提供する。

## React 19 の重要な仕様変更

### Suspense の unmount 動作（React 18 → 19 の破壊的変更）

| 動作 | React 18 | React 19 |
|---|---|---|
| Suspense フォールバック表示中 | 子ツリーを **hide**（state 保持） | 子ツリーを **unmount**（state リセット） |

**影響**: `use()` がサスペンドすると、その Suspense 境界以下のコンポーネントが完全に unmount される。
`useState` 初期化関数を含むコンポーネントが Suspense 境界の内側にある場合、
unmount → 再マウント → 初期化関数再実行 → 新しい Promise 生成 → 再サスペンド → **無限ループ**。

### StrictMode の double-invoke

React 19 StrictMode（開発モード）では `useState` 初期化関数を2回呼び出す。
正常動作でも API リクエストが **2回** 発火するのはこのためで、バグではない。

---

## 無限ループの診断フロー

不具合発生時は以下の順で確認する。

### Step 1: Playwright で API リクエスト数を計測

```js
// /tmp/check.mjs などで実行
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const counts = {};
page.on('request', req => {
  if (req.url().includes('/api/')) {
    const path = req.url().replace(/.*\/api/, '/api');
    counts[path] = (counts[path] || 0) + 1;
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
await page.waitForTimeout(5000);
console.log(counts); // 特定パスが100件超 → 無限ループ確定
await browser.close();
```

- 特定パスが数百〜数千件 → **無限ループ**
- 2件のみ → StrictMode の正常な double-invoke

### Step 2: useState 初期化関数が何度呼ばれているか確認

```tsx
const [promise] = useState(() => {
  console.log('[DEBUG] initializer called'); // ← 追加
  return api.xxx();
});
```

ビルド後に Playwright でコンソールを監視。`initializer called` が繰り返される → **Suspense の外側に useState が必要**。

### Step 3: 問題コンポーネントの特定

`use()` を呼ぶすべてのコンポーネントを確認する（`grep -rn "= use(" src/`）。
各コンポーネントについて以下を確認:

```
✅ 安全なパターン:
  OuterComponent          ← useState でプロミス生成（Suspense の外）
    └── <Suspense>        ← OuterComponent が自身の内部に持つ
          └── InnerComponent ← use() でプロミス消費

❌ 無限ループになるパターン:
  <Suspense>              ← 外側から囲んでいる
    └── SomeComponent     ← useState でプロミス生成 AND use() で消費（同一コンポーネント）
```

---

## 正しいアーキテクチャ：分割パターン

`use()` を使う際は **必ず** プロミス生成と消費を別コンポーネントに分離し、
生成側コンポーネントの内部に `<Suspense>` を置く。

### テンプレート

```tsx
// ✅ 正しいパターン
function OuterComponent(props) {
  // Promise 生成は Suspense の外側（このコンポーネントは unmount されない）
  const [dataPromise] = useState(() => api.fetchData());

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InnerComponent dataPromise={dataPromise} {...props} />
    </Suspense>
  );
}

function InnerComponent({ dataPromise }) {
  // use() は Suspense の内側（サスペンド時に unmount されても問題ない）
  const data = use(dataPromise);
  // ...
}
```

### useMemo を使う場合（依存値がある場合）

```tsx
function OuterComponent({ channelId, open }) {
  // useMemo も Suspense の外側に置く
  const dataPromise = useMemo(() => {
    if (!open) return null;
    return api.fetchData(channelId);
  }, [open, channelId]);

  return (
    <Dialog open={open}>
      {open && dataPromise && (
        <Suspense fallback={<CircularProgress />}>
          <InnerComponent dataPromise={dataPromise} />
        </Suspense>
      )}
    </Dialog>
  );
}
```

---

## このプロジェクトでの実装例

以下は修正済みの正しい実装。新規実装時の参照先として使う。

| コンポーネント | 外側（useState） | 内側（use()） |
|---|---|---|
| `AuthContext.tsx` | `AuthProvider` | `AuthProviderContent` |
| `App.tsx` | `ChatWithUsers` | `ChatWithUsersContent` |
| `ChannelList.tsx` | `ChannelList` | `ChannelListContent` |
| `ChannelMembersDialog.tsx` | `ChannelMembersDialog` | `MembersContent` |
| `CreateChannelDialog.tsx` | `CreateChannelDialog` | `UsersList` |

---

## テスト実装パターン（React 19 + Vitest）

詳細は `references/testing-patterns.md` を参照。主要なポイント:

- **初期レンダリングの Suspense フラッシュ**: `await act(async () => { render(...) })`
- **ユーザー操作後の Suspense フラッシュ**: `await screen.findByXxx()`（`waitFor` より確実）
- **コンポーネント呼び出し回数**: `toHaveBeenCalledTimes(1)` → `toHaveBeenCalled()`（StrictMode の double-invoke のため）
- **モックコンポーネントの第2引数**: React 19 は `undefined`、React 18 は `{}`

---

## チェックリスト（新規に use() を実装するとき）

- [ ] `use()` を呼ぶコンポーネントは Suspense の**内側**に置かれているか
- [ ] `useState`/`useMemo` でプロミスを生成するコンポーネントは Suspense の**外側**にあるか
- [ ] `<Suspense>` は `useState`/`useMemo` を持つコンポーネントの**内部**に定義されているか
- [ ] Playwright で API リクエスト数が正常範囲（2件 = StrictMode の double-invoke）か確認したか

## 追加リソース

- **`references/suspense-architecture.md`** — Suspense 境界と unmount 動作の詳細解説
- **`references/testing-patterns.md`** — React 19 + Vitest のテスト実装パターン集
