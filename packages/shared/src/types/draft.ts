// #148 下書き保存

export interface Draft {
  id: number;
  userId: number;
  channelId: number | null;
  dmConversationId: number | null;
  content: string;
  updatedAt: string;
}
