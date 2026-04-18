import type {
  Attachment,
  User,
  Channel,
  Message,
  MessageSearchFilters,
  MessageSearchResult,
  PinnedMessage,
  PinnedChannel,
  Bookmark,
  DmConversationWithDetails,
  DmMessage,
  ChannelAttachment,
  Reminder,
} from '@chat-app/shared';
import type { AdminUser, AdminChannel, AdminStats } from '../types/admin';

const BASE = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }
  return body as T;
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/auth/me'),
    users: () => request<{ users: User[] }>('/auth/users'),
    updateProfile: (data: { displayName?: string; location?: string; avatarUrl?: string }) =>
      request<{ user: User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  channels: {
    list: () => request<{ channels: Channel[] }>('/channels'),
    create: (data: {
      name: string;
      description?: string;
      isPrivate?: boolean;
      memberIds?: number[];
    }) =>
      request<{ channel: Channel }>('/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          is_private: data.isPrivate,
          memberIds: data.memberIds,
        }),
      }),
    delete: (id: number) => request<void>(`/channels/${id}`, { method: 'DELETE' }),
    join: (id: number) => request<void>(`/channels/${id}/join`, { method: 'POST' }),
    read: (id: number) => request<void>(`/channels/${id}/read`, { method: 'POST' }),
    getMembers: (channelId: number) =>
      request<{ members: User[] }>(`/channels/${channelId}/members`),
    addMember: (channelId: number, userId: number) =>
      request<void>(`/channels/${channelId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    removeMember: (channelId: number, userId: number) =>
      request<void>(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' }),
    pin: (channelId: number) =>
      request<{ pinnedChannel: PinnedChannel }>(`/channels/${channelId}/pin`, { method: 'POST' }),
    unpin: (channelId: number) =>
      request<void>(`/channels/${channelId}/pin`, { method: 'DELETE' }),
    getPinned: () => request<{ pinnedChannels: PinnedChannel[] }>('/channels/pinned'),
    updateTopic: (channelId: number, data: { topic?: string | null; description?: string | null }) =>
      request<{ channel: Channel }>(`/channels/${channelId}/topic`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getAttachments: (channelId: number, type?: 'image' | 'pdf' | 'other') => {
      const q = new URLSearchParams();
      if (type) q.set('type', type);
      const qs = q.toString();
      return request<{ attachments: ChannelAttachment[] }>(
        `/channels/${channelId}/attachments${qs ? `?${qs}` : ''}`,
      );
    },
    listArchived: () => request<{ channels: Channel[] }>('/channels/archived'),
    archive: (channelId: number) =>
      request<{ channel: Channel }>(`/channels/${channelId}/archive`, { method: 'PATCH' }),
    unarchive: (channelId: number) =>
      request<{ channel: Channel }>(`/channels/${channelId}/archive`, { method: 'DELETE' }),
  },
  messages: {
    list: (channelId: number, params?: { limit?: number; before?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.before) q.set('before', String(params.before));
      return request<{ messages: Message[] }>(`/channels/${channelId}/messages?${q}`);
    },
    edit: (id: number, data: { content: string; mentionedUserIds?: number[] }) =>
      request<{ message: Message }>(`/messages/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request<void>(`/messages/${id}`, { method: 'DELETE' }),
    search: (q: string, filters?: MessageSearchFilters) => {
      const params = new URLSearchParams({ q });
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.userId !== undefined) params.set('userId', String(filters.userId));
      if (filters?.hasAttachment !== undefined) params.set('hasAttachment', String(filters.hasAttachment));
      return request<{ messages: MessageSearchResult[] }>(`/messages/search?${params.toString()}`);
    },
    getReplies: (messageId: number) =>
      request<{ replies: Message[] }>(`/messages/${messageId}/replies`),
  },
  files: {
    upload: (file: File): Promise<Attachment & { id: number }> => {
      const form = new FormData();
      form.append('file', file);
      return fetch(`${BASE}/files/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      }).then(async (res) => {
        const body = (await res.json()) as unknown;
        if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Upload failed');
        return body as Attachment & { id: number };
      });
    },
  },
  push: {
    vapidKey: () => request<{ publicKey: string }>('/push/vapid-key'),
    subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
      request<void>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint: string) =>
      request<void>('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },
  pins: {
    list: (channelId: number) =>
      request<{ pinnedMessages: PinnedMessage[] }>(`/channels/${channelId}/pins`),
    pin: (channelId: number, messageId: number) =>
      request<{ pinnedMessage: PinnedMessage }>(`/channels/${channelId}/pins/${messageId}`, {
        method: 'POST',
      }),
    unpin: (channelId: number, messageId: number) =>
      request<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'DELETE' }),
  },
  bookmarks: {
    list: () => request<{ bookmarks: Bookmark[] }>('/bookmarks'),
    add: (messageId: number) =>
      request<{ bookmark: Bookmark }>(`/bookmarks/${messageId}`, { method: 'POST' }),
    remove: (messageId: number) => request<void>(`/bookmarks/${messageId}`, { method: 'DELETE' }),
  },
  dm: {
    listConversations: () =>
      request<{ conversations: DmConversationWithDetails[] }>('/dm/conversations'),
    createConversation: (targetUserId: number) =>
      request<{ conversation: DmConversationWithDetails }>('/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    getMessages: (conversationId: number, params?: { limit?: number; before?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.before) q.set('before', String(params.before));
      return request<{ messages: DmMessage[] }>(
        `/dm/conversations/${conversationId}/messages?${q}`,
      );
    },
    sendMessage: (conversationId: number, content: string) =>
      request<{ message: DmMessage }>(`/dm/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    markAsRead: (conversationId: number) =>
      request<void>(`/dm/conversations/${conversationId}/read`, { method: 'PUT' }),
  },
  reminders: {
    list: () => request<{ reminders: Reminder[] }>('/reminders'),
    create: (data: { messageId: number; remindAt: string }) =>
      request<{ reminder: Reminder }>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/reminders/${id}`, { method: 'DELETE' }),
  },
  admin: {
    getUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
    updateUserRole: (id: number, role: 'user' | 'admin') =>
      request<{ success: boolean }>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    updateUserStatus: (id: number, isActive: boolean) =>
      request<{ success: boolean }>(`/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    deleteUser: (id: number) => request<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    getChannels: () => request<{ channels: AdminChannel[] }>('/admin/channels'),
    deleteChannel: (id: number) => request<void>(`/admin/channels/${id}`, { method: 'DELETE' }),
    getStats: () => request<AdminStats>('/admin/stats'),
  },
};
