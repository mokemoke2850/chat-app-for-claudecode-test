import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../../api/client';
import type { MessageTemplate } from '@chat-app/shared';

interface Props {
  onSelect: (body: string) => void;
  onClose: () => void;
}

export default function TemplatePicker({ onSelect, onClose }: Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.templates.list().then(({ templates: tpls }) => {
      if (!cancelled) {
        setTemplates(tpls);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? templates
        : templates.filter((t) => t.title.toLowerCase().startsWith(query.trim().toLowerCase())),
    [templates, query],
  );

  // 絞り込み変更時に選択インデックスをリセット
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = useCallback(
    (template: MessageTemplate) => {
      onSelect(template.body);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const tpl = filtered[selectedIdx];
        if (tpl) handleSelect(tpl);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIdx, handleSelect, onClose],
  );

  return (
    <Dialog
      open
      onClose={onClose}
      aria-label="テンプレート選択"
      fullWidth
      maxWidth="sm"
      role="dialog"
    >
      <DialogTitle>テンプレート選択</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box onKeyDown={handleKeyDown}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="テンプレートを検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />
            {filtered.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2, textAlign: 'center' }}
              >
                {templates.length === 0 ? 'テンプレートがありません' : '該当なし'}
              </Typography>
            ) : (
              <List dense disablePadding role="listbox" aria-label="テンプレート一覧">
                {filtered.map((tpl, idx) => (
                  <ListItem key={tpl.id} disablePadding>
                    <ListItemButton
                      role="option"
                      aria-selected={idx === selectedIdx}
                      selected={idx === selectedIdx}
                      data-testid={idx === 0 ? 'template-select-trigger' : undefined}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(tpl);
                      }}
                    >
                      <ListItemText
                        primary={tpl.title}
                        secondary={
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 360,
                            }}
                          >
                            {tpl.body}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
