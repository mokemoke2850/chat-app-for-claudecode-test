/** チャンネルカテゴリ（ユーザー個人のサイドバー構成） */
export interface ChannelCategory {
  id: number;
  userId: number;
  name: string;
  position: number;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
  /** このカテゴリに割り当てられたチャンネルID一覧（GET /api/channel-categories のみ） */
  channelIds?: number[];
}

/** チャンネルカテゴリ作成入力 */
export interface CreateChannelCategoryInput {
  name: string;
  position?: number;
}

/** チャンネルカテゴリ更新入力 */
export interface UpdateChannelCategoryInput {
  name?: string;
  position?: number;
  isCollapsed?: boolean;
}
