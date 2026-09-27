import type { AiResult, ApiErrorBody, CalendarEventDto, NoteDto, SessionUser, SyncOperationResult, SyncPullResponse, TagDto, TaskDto } from '@sticky-notes/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Requested-With': 'sticky-notes-web',
      ...init.headers,
    },
  });
  if (!response.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }
    const rawMessage = body?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join('；') : rawMessage || `请求失败（${response.status}）`;
    throw new ApiError(message, response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  me: () => api<{ user: SessionUser }>('/auth/me'),
  login: (identifier: string, password: string) =>
    api<{ user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  register: (input: { email?: string; phone?: string; password: string; displayName: string }) =>
    api<{ user: SessionUser }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
};

export const notesApi = {
  list: (query = '') => api<NoteDto[]>(`/notes${query ? `?${query}` : ''}`),
  tags: () => api<TagDto[]>('/notes/tags'),
  restore: (id: string, baseVersion: number) =>
    api<NoteDto>(`/notes/${id}/restore`, { method: 'POST', body: JSON.stringify({ baseVersion }) }),
  permanentDelete: (id: string) => api<void>(`/notes/${id}/permanent`, { method: 'DELETE' }),
  createShare: (id: string, expiresAt?: string) =>
    api<{ token: string; expiresAt: string | null }>(`/notes/${id}/shares`, {
      method: 'POST',
      body: JSON.stringify({ ...(expiresAt ? { expiresAt } : {}) }),
    }),
};

export const tasksApi = {
  list: () => api<TaskDto[]>('/tasks'),
  create: (input: Record<string, unknown>) => api<TaskDto>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Record<string, unknown>) =>
    api<TaskDto>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => api<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const eventsApi = {
  list: () => api<CalendarEventDto[]>('/events'),
  create: (input: Record<string, unknown>) => api<CalendarEventDto>('/events', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Record<string, unknown>) =>
    api<CalendarEventDto>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => api<void>(`/events/${id}`, { method: 'DELETE' }),
};

export const syncApi = {
  pull: (cursor: string) => api<SyncPullResponse>(`/sync?cursor=${encodeURIComponent(cursor)}`),
  push: (operations: unknown[]) =>
    api<SyncOperationResult[]>('/sync/push', { method: 'POST', body: JSON.stringify({ operations }) }),
};

export async function streamAi(
  path: '/ai/transform/stream' | '/ai/ask/stream',
  body: Record<string, unknown>,
  onDelta: (delta: string) => void,
): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'sticky-notes-web' },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new ApiError(`AI 请求失败（${response.status}）`, response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const data = block.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const parsed = JSON.parse(data) as { delta?: string; message?: string };
      if (parsed.delta) onDelta(parsed.delta);
      if (parsed.message) throw new Error(parsed.message);
    }
  }
}

export type { AiResult };
