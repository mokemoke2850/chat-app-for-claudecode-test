import { Box, InputBase } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export interface ChannelSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ChannelSearchBox({ value, onChange }: ChannelSearchBoxProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pb: 1 }}>
      <SearchIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
      <InputBase
        placeholder="Search channels"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ 'aria-label': 'search channels' }}
        sx={{ fontSize: 13, flexGrow: 1 }}
      />
    </Box>
  );
}
