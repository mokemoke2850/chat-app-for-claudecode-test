// #112 招待リンク

export interface InviteLink {
  id: number;
  token: string;
  channelId: number | null;
  createdBy: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateInviteLinkInput {
  channelId?: number | null;
  maxUses?: number | null;
  expiresInHours?: number | null;
}

export interface InviteLinkLookupResult {
  token: string;
  channelId: number | null;
  channelName: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  isRevoked: boolean;
  isExhausted: boolean;
}
