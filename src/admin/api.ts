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
    sortBy?: 'createdAt' | 'streak' | 'completedLessons';
  }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.role) q.set('role', params.role);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.sortBy) q.set('sortBy', params.sortBy);
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

  getActiveUserStats: (days = 30) =>
    request<{
      totalUsers: number;
      dau: number;
      wau: number;
      mau: number;
      daily: Array<{ date: string; activeUsers: number }>;
      signups: Array<{ date: string; count: number }>;
    }>(`/admin/stats/active-users?days=${days}`),

  listChapters: () =>
    request<AdminChapter[]>('/admin/chapters'),

  updateChapterDisplayOrder: (id: number, displayOrder: number) =>
    request<AdminChapter>(`/admin/chapters/${id}/display-order`, {
      method: 'PATCH',
      body: JSON.stringify({ displayOrder }),
    }),

  createChapter: (dto: Omit<AdminChapter, 'id' | 'stages'>) =>
    request<AdminChapter>('/admin/chapters', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateChapter: (id: number, dto: Partial<Omit<AdminChapter, 'id' | 'slug' | 'stages'>>) =>
    request<AdminChapter>(`/admin/chapters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteChapter: (id: number) =>
    request<{ message: string }>(`/admin/chapters/${id}`, { method: 'DELETE' }),

  // Stages
  listStages: (chapterId: number) =>
    request<AdminStage[]>(`/admin/chapters/${chapterId}/stages`),

  createStage: (dto: { slug: string; title: string; order: number; chapterId: number }) =>
    request<AdminStage>('/admin/stages', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateStage: (id: number, dto: { title?: string; order?: number }) =>
    request<AdminStage>(`/admin/stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteStage: (id: number) =>
    request<{ message: string }>(`/admin/stages/${id}`, { method: 'DELETE' }),

  // Lessons
  getLesson: (id: number) =>
    request<AdminLessonDetail>(`/admin/lessons/${id}`),

  createLesson: (dto: Omit<AdminLessonDetail, 'id' | 'cards'>) =>
    request<AdminLessonDetail>('/admin/lessons', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateLesson: (id: number, dto: Partial<Omit<AdminLessonDetail, 'id' | 'slug' | 'cards'>>) =>
    request<AdminLessonDetail>(`/admin/lessons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteLesson: (id: number) =>
    request<{ message: string }>(`/admin/lessons/${id}`, { method: 'DELETE' }),

  // Cards
  listCards: (lessonId: number) =>
    request<AdminCard[]>(`/admin/lessons/${lessonId}/cards`),

  createCard: (dto: Omit<AdminCard, 'id'>) =>
    request<AdminCard>('/admin/cards', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateCard: (id: number, dto: Partial<Omit<AdminCard, 'id' | 'slug'>>) =>
    request<AdminCard>(`/admin/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteCard: (id: number) =>
    request<{ message: string }>(`/admin/cards/${id}`, { method: 'DELETE' }),

  getAppConfig: () =>
    request<Record<string, string>>('/app/config'),

  updateAppConfig: (key: string, value: string) =>
    request<{ key: string; value: string }>('/admin/app-config', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),

  listNotices: () => request<AdminNotice[]>('/admin/notices'),

  createNotice: (dto: {title: string; content: string; published?: boolean}) =>
    request<AdminNotice>('/admin/notices', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateNotice: (
    id: number,
    dto: {title?: string; content?: string; published?: boolean},
  ) =>
    request<AdminNotice>(`/admin/notices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteNotice: (id: number) =>
    request<{ message: string }>(`/admin/notices/${id}`, {
      method: 'DELETE',
    }),
};

export type AdminNotice = {
  id: number;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CardType = 'FILL_BLANK' | 'MULTIPLE_CHOICE' | 'REORDER' | 'TRANSLATE';

export type AdminCard = {
  id: number;
  slug: string;
  type: CardType;
  question: string;
  answer: string;
  alternativeAnswers: string[] | null;
  hint: string | null;
  options: string[] | null;
  description: string | null;
  explanation: string | null;
  order: number;
  lessonId: number;
};

export type LessonContent = string | { text: string; image: string };
export type LessonExample = { en: string; ko: string; description?: string };

export type AdminLessonDetail = {
  id: number;
  slug: string;
  title: string;
  grammarPoint: string;
  contents: LessonContent[];
  examples: LessonExample[];
  tips: string[] | null;
  imageUrl: string | null;
  order: number;
  stageId: number;
  cards: AdminCard[];
};

export type AdminLesson = {
  id: number;
  slug: string;
  title: string;
  order: number;
};

export type AdminStage = {
  id: number;
  slug: string;
  title: string;
  order: number;
  lessons: AdminLesson[];
};

export type AdminChapter = {
  id: number;
  slug: string;
  title: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  order: number;
  displayOrder: number;
  stages: AdminStage[];
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
  completedLessons?: number;
  createdAt: string;
  updatedAt: string;
};
