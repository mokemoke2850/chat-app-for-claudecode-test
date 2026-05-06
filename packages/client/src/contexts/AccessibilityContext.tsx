import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';

const STORAGE_KEY = 'accessibility-settings';

export type FontSize = 'small' | 'medium' | 'large';

interface AccessibilitySettings {
  fontSize: FontSize;
  highContrast: boolean;
}

interface AccessibilityContextValue {
  fontSize: FontSize;
  highContrast: boolean;
  setFontSize: (size: FontSize) => void;
  setHighContrast: (enabled: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

function getInitialSettings(): AccessibilitySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AccessibilitySettings>;
      const fontSize =
        parsed.fontSize === 'small' || parsed.fontSize === 'medium' || parsed.fontSize === 'large'
          ? parsed.fontSize
          : 'medium';
      const highContrast = typeof parsed.highContrast === 'boolean' ? parsed.highContrast : false;
      return { fontSize, highContrast };
    }
  } catch {
    // localStorage が利用不可または JSON パース失敗の場合はデフォルト値を使用
  }
  return { fontSize: 'medium', highContrast: false };
}

function saveSettings(settings: AccessibilitySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage が利用不可の場合は無視
  }
}

/** CSS変数 --font-size-base の値マップ */
const FONT_SIZE_VALUES: Record<FontSize, string> = {
  small: '13px',
  medium: '15px',
  large: '18px',
};

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => getInitialSettings().fontSize);
  const [highContrast, setHighContrastState] = useState<boolean>(
    () => getInitialSettings().highContrast,
  );

  // フォントサイズを body の data-font-size 属性と CSS 変数に反映する
  useEffect(() => {
    document.body.setAttribute('data-font-size', fontSize);
    document.documentElement.style.setProperty('--font-size-base', FONT_SIZE_VALUES[fontSize]);
  }, [fontSize]);

  // ハイコントラストを body クラスに反映する
  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('hc');
    } else {
      document.body.classList.remove('hc');
    }
  }, [highContrast]);

  const setFontSize = useCallback(
    (size: FontSize) => {
      setFontSizeState(size);
      saveSettings({ fontSize: size, highContrast });
    },
    [highContrast],
  );

  const setHighContrast = useCallback(
    (enabled: boolean) => {
      setHighContrastState(enabled);
      saveSettings({ fontSize, highContrast: enabled });
    },
    [fontSize],
  );

  const value = useMemo(
    () => ({ fontSize, highContrast, setFontSize, setHighContrast }),
    [fontSize, highContrast, setFontSize, setHighContrast],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used inside AccessibilityProvider');
  return ctx;
}
