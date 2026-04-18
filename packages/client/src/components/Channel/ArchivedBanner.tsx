import { Alert } from '@mui/material';
import ArchiveIcon from '@mui/icons-material/Archive';

export default function ArchivedBanner() {
  return (
    <Alert
      severity="warning"
      icon={<ArchiveIcon />}
      sx={{ borderRadius: 0, flexShrink: 0 }}
    >
      このチャンネルはアーカイブ済みです。メッセージの閲覧のみ可能です。
    </Alert>
  );
}
