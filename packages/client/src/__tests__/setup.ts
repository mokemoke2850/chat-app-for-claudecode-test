// @testing-library/jest-dom のカスタムマッチャーを vitest に登録する
// toBeInTheDocument() などの DOM アサーションが使えるようになる
import '@testing-library/jest-dom';

// jsdom は scrollIntoView を実装していないため、空実装でポリフィルする
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}

// jsdom は ClipboardEvent を実装していないため、ポリフィルする
// #261 クリップボード画像ペーストテストで必要
if (typeof window !== 'undefined' && typeof window.ClipboardEvent === 'undefined') {
  class ClipboardEventPolyfill extends Event {
    clipboardData: DataTransfer | null;
    constructor(type: string, options?: ClipboardEventInit) {
      super(type, options);
      this.clipboardData = options?.clipboardData ?? null;
    }
  }
  Object.defineProperty(window, 'ClipboardEvent', {
    writable: true,
    configurable: true,
    value: ClipboardEventPolyfill,
  });
  // globalThis にも登録する（直接参照できるように）
  Object.defineProperty(globalThis, 'ClipboardEvent', {
    writable: true,
    configurable: true,
    value: ClipboardEventPolyfill,
  });
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
