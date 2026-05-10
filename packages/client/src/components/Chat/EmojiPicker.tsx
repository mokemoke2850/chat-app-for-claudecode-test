import { useState, useMemo } from 'react';
import { Box, ClickAwayListener, InputBase, Paper, Popper, Tab, Tabs } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {
  CATEGORIES,
  SKIN_TONES,
  applySkintone,
  getEmojisByCategory,
  loadRecentEmojis,
  loadSkinTone,
  saveRecentEmoji,
  saveSkinTone,
  searchEmojis,
} from './emojiData';
import type { EmojiCategory, SkinToneIndex } from './emojiData';

interface Props {
  anchorEl: HTMLElement | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// スキントーンセレクターのサンプル絵文字（手を振る）
const SKIN_SAMPLE = '✋';

export default function EmojiPicker({ anchorEl, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<EmojiCategory | 'recent'>('スマイル');
  const [skinTone, setSkinTone] = useState<SkinToneIndex>(loadSkinTone);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(loadRecentEmojis);

  const isSearching = query.trim().length > 0;

  const displayedEmojis = useMemo(() => {
    if (isSearching) {
      return searchEmojis(query.trim());
    }
    if (activeCategory === 'recent') {
      return recentEmojis.map((e) => ({
        emoji: e,
        name: e,
        nameJa: e,
        skinToneSupport: false,
        category: 'recent' as const,
      }));
    }
    return getEmojisByCategory(activeCategory as EmojiCategory);
  }, [query, activeCategory, recentEmojis, isSearching]);

  const handleSelect = (baseEmoji: string, hasSkinTone: boolean) => {
    const finalEmoji = hasSkinTone && skinTone > 0 ? applySkintone(baseEmoji, skinTone) : baseEmoji;
    const next = saveRecentEmoji(finalEmoji, recentEmojis);
    setRecentEmojis(next);
    onSelect(finalEmoji);
    onClose();
  };

  const handleSkinTone = (idx: SkinToneIndex) => {
    setSkinTone(idx);
    saveSkinTone(idx);
  };

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="top-start"
      sx={{ zIndex: 1300 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper
          data-testid="emoji-picker"
          elevation={3}
          sx={{ width: 320, display: 'flex', flexDirection: 'column', maxHeight: 400 }}
        >
          {/* 検索欄 */}
          <Box
            sx={{
              px: 1,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
            <InputBase
              inputProps={{ role: 'searchbox', 'aria-label': '絵文字を検索' }}
              placeholder="絵文字を検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              sx={{ fontSize: '0.875rem' }}
            />
          </Box>

          {/* スキントーンセレクター */}
          <Box
            data-testid="skin-tone-selector"
            sx={{
              px: 1,
              py: 0.5,
              display: 'flex',
              gap: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {SKIN_TONES.map((modifier, idx) => (
              <Box
                key={idx}
                component="button"
                data-testid={`skin-tone-${idx}`}
                aria-pressed={skinTone === idx}
                onClick={() => handleSkinTone(idx as SkinToneIndex)}
                sx={{
                  border: skinTone === idx ? '2px solid' : '2px solid transparent',
                  borderColor: skinTone === idx ? 'primary.main' : 'transparent',
                  borderRadius: 1,
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  p: 0.25,
                  lineHeight: 1,
                }}
              >
                {SKIN_SAMPLE + modifier}
              </Box>
            ))}
          </Box>

          {/* カテゴリタブ（検索中は非表示） */}
          {!isSearching && (
            <Tabs
              value={activeCategory}
              onChange={(_, v) => setActiveCategory(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 32, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab
                label="最近使った"
                value="recent"
                sx={{ minHeight: 32, py: 0, px: 1, fontSize: '0.7rem' }}
              />
              {CATEGORIES.map((cat) => (
                <Tab
                  key={cat}
                  label={cat}
                  value={cat}
                  sx={{ minHeight: 32, py: 0, px: 1, fontSize: '0.7rem' }}
                />
              ))}
            </Tabs>
          )}

          {/* 絵文字グリッド */}
          <Box
            data-testid="recent-emoji-list"
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 0.5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.25,
            }}
          >
            {displayedEmojis.length === 0 && isSearching ? (
              <Box
                sx={{
                  width: '100%',
                  textAlign: 'center',
                  py: 2,
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                }}
              >
                見つかりません
              </Box>
            ) : (
              displayedEmojis.map((entry) => (
                <Box
                  key={entry.emoji + entry.name}
                  component="button"
                  aria-label={entry.emoji}
                  title={entry.nameJa || entry.name}
                  onClick={() => handleSelect(entry.emoji, entry.skinToneSupport)}
                  sx={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    p: 0.5,
                    borderRadius: 1,
                    lineHeight: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {entry.emoji}
                </Box>
              ))
            )}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
