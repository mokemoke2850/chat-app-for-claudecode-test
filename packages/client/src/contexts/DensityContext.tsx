import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';

const STORAGE_KEY = 'message-density';

export type DensityMode = 'cozy' | 'compact';

interface DensityContextValue {
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

function getInitialDensity(): DensityMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'cozy' || stored === 'compact') return stored;
  return 'cozy';
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>(getInitialDensity);

  const setDensity = useCallback((next: DensityMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setDensityState(next);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  const value = useMemo(() => ({ density, setDensity }), [density, setDensity]);

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used inside DensityProvider');
  return ctx;
}
