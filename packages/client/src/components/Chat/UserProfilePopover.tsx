import { Box, Avatar, Typography, Popover, Paper, Link } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkIcon from '@mui/icons-material/Link';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import BusinessIcon from '@mui/icons-material/Business';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import type { User, PresenceState } from '@chat-app/shared';
import { getAvatarColor } from '../../utils/avatarColor';
import PresenceIndicator from './PresenceIndicator';
import { useLocalTime } from '../../hooks/useLocalTime';

interface Props {
  user: User | undefined;
  displayName: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  /** #146 プレゼンス状態。未指定ならインジケータを描画しない（後方互換）。 */
  state?: PresenceState;
}

export default function UserProfilePopover({
  user,
  displayName,
  anchorEl,
  open,
  onClose,
  state,
}: Props) {
  // #306 timezone が設定されているユーザーは現在のローカル時刻を表示する。
  // timezone 未設定/不正値のときは formatted=null となり時刻行は描画しない。
  const localTime = useLocalTime(user?.timezone);
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableRestoreFocus
      sx={{ pointerEvents: 'none' }}
    >
      <Paper sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 200 }}>
        <Box sx={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
          <Avatar
            src={user?.avatarUrl ?? undefined}
            alt={displayName}
            sx={{
              width: 48,
              height: 48,
              ...(!user?.avatarUrl && { bgcolor: getAvatarColor(user?.email ?? '') }),
            }}
          >
            {displayName[0]?.toUpperCase()}
          </Avatar>
          <PresenceIndicator state={state} size={12} />
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold">
            {displayName}
          </Typography>
          {user && (
            <Typography variant="caption" color="text.secondary" display="block">
              {`ID: ${user.id}`}
            </Typography>
          )}
          {user?.email && (
            <Typography variant="caption" color="text.secondary" display="block">
              {user.email}
            </Typography>
          )}
          {user?.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {user.location}
              </Typography>
            </Box>
          )}
          {/* #305 拡張プロフィール項目（値が空の項目は表示しない） */}
          {user?.jobTitle && (
            <Box
              data-testid="user-job-title"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <WorkOutlineIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {user.jobTitle}
              </Typography>
            </Box>
          )}
          {user?.department && (
            <Box
              data-testid="user-department"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <BusinessIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {user.department}
              </Typography>
            </Box>
          )}
          {user?.timezone && (
            <Box
              data-testid="user-timezone"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <AccessTimeIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {user.timezone}
              </Typography>
            </Box>
          )}
          {/* #306 ローカル時刻表示（timezone が有効値のときのみ） */}
          {localTime.formatted && (
            <Box
              data-testid="user-local-time"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              {localTime.isLateNight ? (
                <NightsStayIcon fontSize="small" color="action" />
              ) : (
                <AccessTimeIcon fontSize="small" color="action" />
              )}
              <Typography variant="body2" color="text.secondary">
                {`現在 ${localTime.formatted}`}
                {localTime.isLateNight && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="warning.main"
                    sx={{ ml: 0.5 }}
                    aria-label="深夜帯"
                  >
                    （深夜帯）
                  </Typography>
                )}
              </Typography>
            </Box>
          )}
          {user?.bio && (
            <Typography
              data-testid="user-bio"
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}
            >
              {user.bio}
            </Typography>
          )}
          {user?.githubUrl && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <GitHubIcon fontSize="small" color="action" />
              <Link
                data-testid="user-github-url"
                href={user.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ pointerEvents: 'auto' }}
              >
                {user.githubUrl}
              </Link>
            </Box>
          )}
          {user?.snsUrl && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <LinkIcon fontSize="small" color="action" />
              <Link
                data-testid="user-sns-url"
                href={user.snsUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ pointerEvents: 'auto' }}
              >
                {user.snsUrl}
              </Link>
            </Box>
          )}
          {user?.status && (
            <Box
              data-testid="user-status"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
            >
              {user.status.emoji && (
                <Typography component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                  {user.status.emoji}
                </Typography>
              )}
              {user.status.text && (
                <Typography variant="body2" color="text.secondary">
                  {user.status.text}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Popover>
  );
}
