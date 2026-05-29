/**
 * テスト共通レンダリングユーティリティ（#379）
 *
 * MessageActions など react-router の `useNavigate` をトップレベルで呼ぶコンポーネントは、
 * Router コンテキスト無しでレンダリングすると例外になる。
 * そのため `render` を `MemoryRouter` でラップしたカスタム版に差し替えて提供する。
 *
 * 使い方: `import { render, screen } from './test-utils';`
 * （`@testing-library/react` の他のエクスポートはそのまま再エクスポートする）
 */
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

function RouterWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return rtlRender(ui, { wrapper: RouterWrapper, ...options });
}

// @testing-library/react の screen / waitFor / fireEvent / act / renderHook 等を再エクスポート。
// 下の明示的な render エクスポートが star エクスポートの render を上書きする。
export * from '@testing-library/react';
export { render };
