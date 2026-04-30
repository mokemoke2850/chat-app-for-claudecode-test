// #149 ゲスト閲覧リンク

export interface GuestLink {
  id: number;
  token: string;
  channelId: number;
  createdBy: number | null;
  hasPassword: boolean;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateGuestLinkInput {
  channelId: number;
  password?: string | null;
  expiresInHours?: number | null;
}

export interface GuestLinkLookupResult {
  token: string;
  channelId: number;
  channelName: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  isRevoked: boolean;
}

export interface GuestLinkVerifyResult {
  guestToken: string;
  channelId: number;
  channelName: string | null;
}
