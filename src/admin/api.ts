const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3030'
    : 'https://grameow-server-production.up.railway.app';
const LS_KEY = 'admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LS_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(LS_KEY, token);
  else localStorage.removeItem(LS_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      msg = body.message || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  signin: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    request<{
      id: number;
      email: string;
      nickname: string;
      role: 'USER' | 'PAID' | 'TESTER' | 'ADMIN';
      level: string | null;
    }>('/auth/me'),

  listUsers: (params: {
    search?: string;
    role?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.role) q.set('role', params.role);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    return request<{
      items: AdminUser[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/admin/users?${q.toString()}`);
  },

  getUser: (id: number) =>
    request<AdminUser & {
      stats: {
        completedLessons: number;
        totalCardResults: number;
        correctCount: number;
        accuracy: number;
      };
    }>(`/admin/users/${id}`),

  updateRole: (id: number, role: string) =>
    request<AdminUser>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  resetProgress: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}/reset-progress`, {
      method: 'POST',
    }),

  deleteUser: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
};

export type AdminUser = {
  id: number;
  email: string;
  nickname: string | null;
  imageUri: string | null;
  level: string | null;
  role: 'USER' | 'PAID' | 'TESTER' | 'ADMIN';
  loginType: 'email' | 'kakao' | 'google' | 'apple';
  streakCount: number;
  lastStudyDate: string | null;
  createdAt: string;
  updatedAt: string;
};
