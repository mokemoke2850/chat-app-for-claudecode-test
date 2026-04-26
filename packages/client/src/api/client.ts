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
  ChannelCategory,
  MessageTemplate,
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
  Tag,
  TagSuggestion,
  InviteLink,
  CreateInviteLinkInput,
  InviteLinkLookupResult,
  ChannelNotificationSetting,
  ChannelNotificationLevel,
  ChannelPostingPermission,
  NgWord,
  CreateNgWordInput,
  UpdateNgWordInput,
  BlockedExtension,
  CreateBlockedExtensionInput,
  ScheduledMessage,
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
  ForwardMessageInput,
  ChatEvent,
  CreateEventInput,
  UpdateEventInput,
  RsvpStatus,
  RsvpUser,
} from '@chat-app/shared';
import type { AdminUser, AdminChannel, AdminStats, AuditLogListResponse } from '../types/admin';

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
    changePassword: (data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) =>
      request<{ message: string }>('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    completeOnboarding: () =>
      request<{ user: User }>('/auth/onboarding/complete', { method: 'POST' }),
  },
  channels: {
    list: () => request<{ channels: Channel[] }>('/channels'),
    create: (data: {
      name: string;
      description?: string;
      isPrivate?: boolean;
      memberIds?: number[];
      postingPermission?: ChannelPostingPermission;
    }) =>
      request<{ channel: Channel }>('/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          is_private: data.isPrivate,
          memberIds: data.memberIds,
          postingPermission: data.postingPermission,
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
    unpin: (channelId: number) => request<void>(`/channels/${channelId}/pin`, { method: 'DELETE' }),
    getPinned: () => request<{ pinnedChannels: PinnedChannel[] }>('/channels/pinned'),
    updateTopic: (
      channelId: number,
      data: { topic?: string | null; description?: string | null },
    ) =>
      request<{ channel: Channel }>(`/channels/${channelId}/topic`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updatePostingPermission: (channelId: number, postingPermission: ChannelPostingPermission) =>
      request<{ channel: Channel }>(`/channels/${channelId}/posting-permission`, {
        method: 'PATCH',
        body: JSON.stringify({ postingPermission }),
      }),
    listArchived: () => request<{ channels: Channel[] }>('/channels/archived'),
    archive: (channelId: number) =>
      request<{ channel: Channel }>(`/channels/${channelId}/archive`, { method: 'PATCH' }),
    unarchive: (channelId: number) =>
      request<{ channel: Channel }>(`/channels/${channelId}/archive`, { method: 'DELETE' }),
    getAttachments: (channelId: number, type?: 'image' | 'pdf' | 'other') => {
      const q = new URLSearchParams();
      if (type) q.set('type', type);
      const qs = q.toString();
      return request<{ attachments: ChannelAttachment[] }>(
        `/channels/${channelId}/attachments${qs ? `?${qs}` : ''}`,
      );
    },
    getNotifications: () =>
      request<{ settings: ChannelNotificationSetting[] }>('/channels/notifications'),
    setNotificationLevel: (channelId: number, level: ChannelNotificationLevel) =>
      request<{ setting: ChannelNotificationSetting }>(`/channels/${channelId}/notifications`, {
        method: 'PUT',
        body: JSON.stringify({ level }),
      }),
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
      if (filters?.hasAttachment !== undefined)
        params.set('hasAttachment', String(filters.hasAttachment));
      if (filters?.tagIds && filters.tagIds.length > 0)
        params.set('tagIds', filters.tagIds.join(','));
      return request<{ messages: MessageSearchResult[] }>(`/messages/search?${params.toString()}`);
    },
    getReplies: (messageId: number) =>
      request<{ replies: Message[] }>(`/messages/${messageId}/replies`),
    forward: (messageId: number, input: ForwardMessageInput) =>
      request<{ message: Message }>(`/messages/${messageId}/forward`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
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
  channelCategories: {
    list: () => request<{ categories: ChannelCategory[] }>('/channel-categories'),
    create: (data: { name: string; position?: number }) =>
      request<{ category: ChannelCategory }>('/channel-categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: { name?: string; position?: number; isCollapsed?: boolean }) =>
      request<{ category: ChannelCategory }>(`/channel-categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request<void>(`/channel-categories/${id}`, { method: 'DELETE' }),
    reorder: (categoryIds: number[]) =>
      request<{ success: boolean }>('/channel-categories/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ categoryIds }),
      }),
    assignChannel: (channelId: number, categoryId: number) =>
      request<{ success: boolean }>(`/channels/${channelId}/category`, {
        method: 'POST',
        body: JSON.stringify({ categoryId }),
      }),
    unassignChannel: (channelId: number) =>
      request<{ success: boolean }>(`/channels/${channelId}/category`, {
        method: 'POST',
        body: JSON.stringify({ categoryId: null }),
      }),
  },
  templates: {
    list: () => request<{ templates: MessageTemplate[] }>('/templates'),
    create: (data: CreateMessageTemplateInput) =>
      request<{ template: MessageTemplate }>('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: UpdateMessageTemplateInput) =>
      request<{ template: MessageTemplate }>(`/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: number) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
    reorder: (orderedIds: number[]) =>
      request<{ success: boolean }>('/templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      }),
  },
  tags: {
    suggestions: (prefix = '', limit = 10) => {
      const q = new URLSearchParams({ prefix, limit: String(limit) });
      return request<{ suggestions: TagSuggestion[] }>(`/tags/suggestions?${q}`);
    },
    setMessageTags: (messageId: number, names: string[]) =>
      request<{ tags: Tag[] }>(`/messages/${messageId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ names }),
      }),
    removeMessageTag: (messageId: number, tagId: number) =>
      request<void>(`/messages/${messageId}/tags/${tagId}`, { method: 'DELETE' }),
    setChannelTags: (channelId: number, names: string[]) =>
      request<{ tags: Tag[] }>(`/channels/${channelId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ names }),
      }),
    removeChannelTag: (channelId: number, tagId: number) =>
      request<void>(`/channels/${channelId}/tags/${tagId}`, { method: 'DELETE' }),
  },
  invites: {
    create: (data: CreateInviteLinkInput) =>
      request<{ invite: InviteLink }>('/invites', { method: 'POST', body: JSON.stringify(data) }),
    list: (channelId?: number) => {
      const q = channelId !== undefined ? `?channelId=${channelId}` : '';
      return request<{ invites: InviteLink[] }>(`/invites${q}`);
    },
    lookup: (token: string) => request<{ invite: InviteLinkLookupResult }>(`/invites/${token}`),
    redeem: (token: string) =>
      request<{ success: boolean; channelId: number | null }>(`/invites/${token}/redeem`, {
        method: 'POST',
      }),
    revoke: (id: number) => request<{ invite: InviteLink }>(`/invites/${id}`, { method: 'DELETE' }),
  },
  events: {
    create: (data: CreateEventInput) =>
      request<{ event: ChatEvent }>('/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: UpdateEventInput) =>
      request<{ event: ChatEvent }>(`/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request<void>(`/events/${id}`, { method: 'DELETE' }),
    setRsvp: (id: number, status: RsvpStatus) =>
      request<{ event: ChatEvent }>(`/events/${id}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    getRsvps: (id: number) => request<{ users: RsvpUser[] }>(`/events/${id}/rsvps`),
  },
  scheduledMessages: {
    list: () => request<{ scheduledMessages: ScheduledMessage[] }>('/scheduled-messages'),
    create: (data: CreateScheduledMessageInput) =>
      request<{ scheduledMessage: ScheduledMessage }>('/scheduled-messages', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: UpdateScheduledMessageInput) =>
      request<{ scheduledMessage: ScheduledMessage }>(`/scheduled-messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    cancel: (id: number) =>
      request<{ scheduledMessage: ScheduledMessage }>(`/scheduled-messages/${id}`, {
        method: 'DELETE',
      }),
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
    setChannelRecommended: (id: number, isRecommended: boolean) =>
      request<{ channel: AdminChannel }>(`/admin/channels/${id}/recommend`, {
        method: 'PATCH',
        body: JSON.stringify({ isRecommended }),
      }),
    deleteChannel: (id: number) => request<void>(`/admin/channels/${id}`, { method: 'DELETE' }),
    unarchiveChannel: (id: number) =>
      request<{ channel: AdminChannel }>(`/admin/channels/${id}/archive`, { method: 'DELETE' }),
    getStats: () => request<AdminStats>('/admin/stats'),
    getAuditLogs: (params?: {
      actionType?: string;
      actorUserId?: number;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.actionType) q.set('action_type', params.actionType);
      if (params?.actorUserId !== undefined) q.set('actor_user_id', String(params.actorUserId));
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      if (params?.limit !== undefined) q.set('limit', String(params.limit));
      if (params?.offset !== undefined) q.set('offset', String(params.offset));
      const qs = q.toString();
      return request<AuditLogListResponse>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
    },
    exportAuditLogsUrl: (params?: {
      actionType?: string;
      actorUserId?: number;
      from?: string;
      to?: string;
    }): string => {
      const q = new URLSearchParams();
      if (params?.actionType) q.set('action_type', params.actionType);
      if (params?.actorUserId !== undefined) q.set('actor_user_id', String(params.actorUserId));
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      const qs = q.toString();
      return `/api/admin/audit-logs/export${qs ? `?${qs}` : ''}`;
    },
    // #117 NG ワード CRUD
    ngWords: {
      list: () => request<{ ngWords: NgWord[] }>('/admin/ng-words'),
      create: (data: CreateNgWordInput) =>
        request<{ ngWord: NgWord }>('/admin/ng-words', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: number, data: UpdateNgWordInput) =>
        request<{ ngWord: NgWord }>(`/admin/ng-words/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: number) => request<void>(`/admin/ng-words/${id}`, { method: 'DELETE' }),
    },
    // #117 添付拡張子ブロックリスト CRUD
    blockedExtensions: {
      list: () => request<{ blockedExtensions: BlockedExtension[] }>('/admin/attachment-blocklist'),
      create: (data: CreateBlockedExtensionInput) =>
        request<{ blockedExtension: BlockedExtension }>('/admin/attachment-blocklist', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      delete: (id: number) =>
        request<void>(`/admin/attachment-blocklist/${id}`, { method: 'DELETE' }),
    },
  },
};
