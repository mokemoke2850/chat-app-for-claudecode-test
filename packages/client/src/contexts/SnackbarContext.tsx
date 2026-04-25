import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type Severity = 'success' | 'error' | 'info' | 'warning';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: Severity;
}

interface SnackbarContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const show = useCallback((message: string, severity: Severity) => {
    setState({ open: true, message, severity });
  }, []);

  const showSuccess = useCallback((message: string) => show(message, 'success'), [show]);
  const showError = useCallback((message: string) => show(message, 'error'), [show]);
  const showInfo = useCallback((message: string) => show(message, 'info'), [show]);

  const handleClose = () => {
    setState((prev) => ({ ...prev, open: false }));
  };

  return (
    <SnackbarContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionProps={{ timeout: 0 }}
      >
        <Alert
          severity={state.severity}
          variant="filled"
          action={
            <IconButton size="small" color="inherit" aria-label="close" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

/**
 * Snackbar を取得する。Provider 配下でなければ警告をログに出すだけの no-op を返す。
 * これにより、テスト等で Provider を省略した場合でもコンポーネントが throw しない。
 */
export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    const warn = (message: string) => {
       
      console.warn('[useSnackbar] Provider 未設定:', message);
    };
    return { showSuccess: warn, showError: warn, showInfo: warn };
  }
  return ctx;
}
