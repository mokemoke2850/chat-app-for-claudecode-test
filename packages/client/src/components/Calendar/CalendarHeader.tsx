// Issue #152 — カレンダー画面のヘッダー（前後ナビ・今日・ビュー切替）

import {
  Box,
  Button,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import DownloadIcon from '@mui/icons-material/Download';

import { startOfWeek, WEEKDAYS_JA } from '../../utils/calendar';

export type CalendarViewMode = 'month' | 'week' | 'agenda';

interface Props {
  cursor: Date;
  view: CalendarViewMode;
  onChangeView: (next: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenPolls?: () => void;
  onExport?: () => void;
}

function buildLabel(cursor: Date, view: CalendarViewMode): string {
  if (view === 'week') {
    const start = startOfWeek(cursor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
  }
  return `${cursor.getFullYear()}年 ${cursor.getMonth() + 1}月`;
}

export function CalendarHeader({
  cursor,
  view,
  onChangeView,
  onPrev,
  onNext,
  onToday,
  onOpenPolls,
  onExport,
}: Props) {
  // WEEKDAYS_JA を参照することで未使用警告を回避（外部で利用）
  void WEEKDAYS_JA;
  const label = buildLabel(cursor, view);

  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Button
        variant="outlined"
        size="small"
        onClick={onToday}
        sx={{ textTransform: 'none' }}
        aria-label="calendar-today"
      >
        今日
      </Button>
      <IconButton size="small" onClick={onPrev} aria-label="calendar-prev">
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onNext} aria-label="calendar-next">
        <ChevronRightIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ fontSize: 18, fontWeight: 500, minWidth: 220 }}>{label}</Typography>

      <Box sx={{ flexGrow: 1 }} />

      {onOpenPolls && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<HowToVoteIcon fontSize="small" />}
          onClick={onOpenPolls}
          sx={{ textTransform: 'none', mr: 1 }}
          aria-label="calendar-open-polls"
        >
          日程調整
        </Button>
      )}

      {onExport && (
        <Button variant="outlined" size="small" startIcon={<DownloadIcon fontSize="small" />}
          onClick={onExport} sx={{ textTransform: 'none', mr: 1 }} aria-label="calendar-export">
          エクスポート
        </Button>
      )}

      <ToggleButtonGroup
        value={view}
        exclusive
        size="small"
        onChange={(_, v) => v && onChangeView(v as CalendarViewMode)}
        aria-label="calendar-view"
      >
        <ToggleButton value="month" sx={{ textTransform: 'none', px: 2 }} aria-label="month">
          <CalendarViewMonthIcon fontSize="small" />
          <Box component="span" sx={{ ml: 0.75 }}>
            月
          </Box>
        </ToggleButton>
        <ToggleButton value="week" sx={{ textTransform: 'none', px: 2 }} aria-label="week">
          <CalendarViewWeekIcon fontSize="small" />
          <Box component="span" sx={{ ml: 0.75 }}>
            週
          </Box>
        </ToggleButton>
        <ToggleButton value="agenda" sx={{ textTransform: 'none', px: 2 }} aria-label="agenda">
          <ViewAgendaIcon fontSize="small" />
          <Box component="span" sx={{ ml: 0.75 }}>
            アジェンダ
          </Box>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
