import type { User, Channel, Message } from '@chat-app/shared';

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
    create: (data: { name: string; description?: string }) =>
      request<{ channel: Channel }>('/channels', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/channels/${id}`, { method: 'DELETE' }),
    join: (id: number) => request<void>(`/channels/${id}/join`, { method: 'POST' }),
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
  },
  push: {
    vapidKey: () => request<{ publicKey: string }>('/push/vapid-key'),
    subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
      request<void>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint: string) =>
      request<void>('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },
};
