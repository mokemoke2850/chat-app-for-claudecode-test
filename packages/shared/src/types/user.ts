export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  displayName: string | null;
  location: string | null;
  createdAt: string;
  role: 'user' | 'admin';
  isActive: boolean;
}
