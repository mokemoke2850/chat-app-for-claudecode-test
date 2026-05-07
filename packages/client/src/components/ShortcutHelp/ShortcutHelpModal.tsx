/**
 * キーボードショートカット一覧モーダル (Issue #256)
 *
 * - `?` / `Cmd+/` / `Ctrl+/` のグローバルキーでトリガーする（登録は ChatPage 側）
 * - `onClose` prop で受け取ったコールバックを MUI Dialog に委譲し、Escape 制御を任せる
 * - ショートカット定義は shortcutCatalog.ts の SHORTCUTS 配列から読み込む
 * - カテゴリ別にグループ化して表示する
 * - キー表記は <kbd> 風 Chip で視覚的にキーボードキーを表現する
 */

import { Box, Chip, Dialog, DialogContent, DialogTitle, Divider, Typography } from '@mui/material';
import { SHORTCUT_CATEGORIES, SHORTCUTS } from './shortcutCatalog';

export interface ShortcutHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutHelpModal({ open, onClose }: ShortcutHelpModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="shortcut-help-title"
    >
      <DialogTitle id="shortcut-help-title" sx={{ pb: 1 }}>
        キーボードショートカット
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {SHORTCUT_CATEGORIES.map((category, catIdx) => {
          const entries = SHORTCUTS.filter((s) => s.category === category);
          return (
            <Box key={category} sx={{ mb: catIdx < SHORTCUT_CATEGORIES.length - 1 ? 2 : 0 }}>
              {/* カテゴリ見出し */}
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5, lineHeight: 1.5 }}
                data-testid={`shortcut-category-${category}`}
              >
                {category}
              </Typography>
              <Divider sx={{ mb: 1 }} />

              {/* エントリ一覧 */}
              {entries.map((entry, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 0.75,
                    borderBottom: i < entries.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  {/* キー表記 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    {entry.keys.map((key, ki) => (
                      <Chip
                        key={ki}
                        label={key}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          height: 24,
                          borderRadius: 1,
                          cursor: 'default',
                        }}
                        component="span"
                      />
                    ))}
                  </Box>

                  {/* 説明文 */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 2, textAlign: 'right' }}
                  >
                    {entry.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
