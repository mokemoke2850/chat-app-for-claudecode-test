import { useState, useRef, KeyboardEvent } from 'react';
import { Box, Chip, TextField, Paper, List, ListItemButton, ListItemText } from '@mui/material';
import { useTagSuggestions } from '../../hooks/useTagSuggestions';
import { normalizeTagName } from './tagUtils';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

/**
 * 補完候補付きタグ入力コンポーネント。
 * - Enter / カンマで確定
 * - 入力欄が空の状態で Backspace を押すと最後尾のタグを削除
 * - 候補リストから選択でも確定
 */
export default function TagInput({ value, onChange, placeholder = 'タグを追加...' }: Props) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useTagSuggestions(input);

  function confirm(raw: string) {
    const name = normalizeTagName(raw);
    if (!name || value.includes(name)) return;
    onChange([...value, name]);
    setInput('');
    setOpen(false);
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      confirm(input);
    } else if (e.key === 'Backspace' && input === '') {
      onChange(value.slice(0, -1));
    }
  }

  function handleInputChange(v: string) {
    // カンマ入力は即確定
    if (v.endsWith(',')) {
      confirm(v.slice(0, -1));
      return;
    }
    setInput(v);
    setOpen(v.length > 0 && suggestions.length > 0);
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          p: 0.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          alignItems: 'center',
          minHeight: 40,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <Chip
            key={tag}
            label={`#${tag}`}
            size="small"
            onDelete={() => removeTag(tag)}
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        ))}
        <TextField
          inputRef={inputRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(input.length > 0 && suggestions.length > 0)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          variant="standard"
          InputProps={{ disableUnderline: true }}
          inputProps={{ 'aria-label': 'タグ入力', 'data-testid': 'tag-input' }}
          sx={{ flexGrow: 1, minWidth: 80 }}
        />
      </Box>

      {open && suggestions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          <List dense disablePadding>
            {suggestions.map((s) => (
              <ListItemButton
                key={s.name}
                onMouseDown={(e) => {
                  e.preventDefault(); // blur を防ぐ
                  confirm(s.name);
                }}
              >
                <ListItemText primary={`#${s.name}`} secondary={`${s.useCount} 件`} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}
