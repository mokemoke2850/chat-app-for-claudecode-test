# スナックバー通知 共通仕様

## 概要

全画面共通のトースト通知（スナックバー）表示の仕様。`SnackbarContext` として実装し、アプリ全体で統一された通知 UX を提供する。

## 実装場所

- Context: `packages/client/src/contexts/SnackbarContext.tsx`
- Provider 挿入箇所: `packages/client/src/main.tsx`（`AuthProvider` と同階層）

## API

```tsx
import { useSnackbar } from '../contexts/SnackbarContext';

const { showSuccess, showError, showInfo } = useSnackbar();
```

| 関数 | 用途 |
|---|---|
| `showSuccess(message)` | 操作成功時（保存完了など） |
| `showError(message)` | エラー発生時（API失敗など） |
| `showInfo(message)` | 中立的な通知 |

## 表示仕様

| 項目 | 値 |
|---|---|
| 表示位置 | 画面下部中央 |
| 自動消去 | 3秒後 |
| 手動クローズ | 右上の × ボタン |
| スタイル | MUI Alert（`variant="filled"`）|

## 使用ルール

1. **保存・更新操作の成功/失敗** には必ずスナックバーで結果を通知する
2. ページ内の `Alert` コンポーネントによるインラインエラー表示は廃止し、スナックバーに統一する
3. `SnackbarProvider` の外で `useSnackbar` を呼ぶと例外がスローされるため、必ずプロバイダー配下のコンポーネントで使用する

## 実装例（プロフィール保存）

```tsx
const { showSuccess, showError } = useSnackbar();

const handleSave = async () => {
  try {
    const { user: updated } = await api.auth.updateProfile({ ... });
    updateUser(updated);
    showSuccess('プロフィールを保存しました');
  } catch (err) {
    showError(err instanceof Error ? err.message : '保存に失敗しました');
  }
};
```
