// @testing-library/jest-dom のカスタムマッチャーを vitest に登録する
// toBeInTheDocument() などの DOM アサーションが使えるようになる
import '@testing-library/jest-dom';

// jsdom は scrollIntoView を実装していないため、空実装でポリフィルする
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
