---
name: React 19 Troubleshooting
description: This skill should be used when a React 19 related bug is suspected in this project — for example "spinner keeps showing", "infinite API requests", "use() causes loop", "Suspense doesn't resolve", "component remounts unexpectedly", or when migrating from useEffect to use() causes runtime regressions. Provides React 19-specific diagnosis patterns, root-cause checklists, and the correct use()+Suspense architecture for this codebase.
version: 0.1.0
---

# React 19 Troubleshooting

このスキルはこのプロジェクト（`packages/client`）で React 19 に起因する不具合が疑われるときに使う。
特に `use()` + `<Suspense>` の組み合わせで発生する無限ループや画面固着を診断・修正するための知識を提供する。

## 正本

React 19 の Suspense 境界、Promise 安定化、無限ループ診断、Vitest パターンは
`doc/react19-suspense-guide.md` を正本として参照する。

## Claude Code での使い方

1. `doc/react19-suspense-guide.md` を読む
2. 必要なら `doc/browser-e2e-guide.md` に従って実ブラウザで API リクエスト数を確認する
3. `use()` を呼ぶコンポーネントと Promise 生成コンポーネントの位置関係を修正する
4. 変更後は該当テストとブラウザ確認を実行する
