export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminChannel {
  id: number;
  name: string;
  description: string | null;
  isPrivate: boolean;
  memberCount: number;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalChannels: number;
  totalMessages: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
}
