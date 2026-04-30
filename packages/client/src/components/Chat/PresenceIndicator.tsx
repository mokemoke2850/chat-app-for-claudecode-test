/**
 * #146 プレゼンスインジケータ（アバター右下のドット）
 *
 * Avatar の親 Box に position:relative を持たせた上で、その上に重ねる想定。
 * - 緑（#44b700）: online
 * - 黄（#ffb300）: away
 * - 灰（#9e9e9e）: offline（または非表示）
 *
 * `state` 未指定の場合は何も描画しない（後方互換）。
 */

import { Box } from '@mui/material';
import type { PresenceState } from '@chat-app/shared';

interface Props {
  state: PresenceState | undefined;
  /** ドット直径（px）。デフォルト 10 */
  size?: number;
}

const COLOR_BY_STATE: Record<PresenceState, string> = {
  online: '#44b700',
  away: '#ffb300',
  offline: '#9e9e9e',
};

export default function PresenceIndicator({ state, size = 10 }: Props) {
  if (!state) return null;

  return (
    <Box
      data-testid="presence-indicator"
      data-state={state}
      sx={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: COLOR_BY_STATE[state],
        border: '2px solid #fff',
        boxSizing: 'content-box',
        pointerEvents: 'none',
      }}
    />
  );
}
