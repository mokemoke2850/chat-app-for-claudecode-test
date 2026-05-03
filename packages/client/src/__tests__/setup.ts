// @testing-library/jest-dom のカスタムマッチャーを vitest に登録する
// toBeInTheDocument() などの DOM アサーションが使えるようになる
import '@testing-library/jest-dom';

// jsdom は scrollIntoView を実装していないため、空実装でポリフィルする
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}

// jsdom は matchMedia を実装していないため、デフォルト mock を入れる (Step 9a)。
// MUI の useMediaQuery / ThemeContext からの呼び出しでエラーにならないようにする。
// 個別テストで挙動を変えたい場合は Object.defineProperty(window, 'matchMedia', ...) で上書きする。
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
