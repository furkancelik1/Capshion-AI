import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api';

let _token: string | null = null;

const _imageCache = new Map<string, string[]>();
const IMAGE_CACHE_MAX = 10;

export function setCachedImageUris(postId: string, uris: string[]) {
  if (_imageCache.size >= IMAGE_CACHE_MAX) {
    const firstKey = _imageCache.keys().next().value;
    if (firstKey) _imageCache.delete(firstKey);
  }
  _imageCache.set(postId, uris);
}

export function getCachedImageUris(postId: string): string[] | undefined {
  return _imageCache.get(postId);
}

export function setToken(token: string | null) {
  _token = token;
}

export function getToken() {
  return _token;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface GenerateCaptionRequest {
  images: string[];
  tone: string;
  gender: string;
  ageRange: string;
  language: string;
  length: string;
  useEmojis: boolean;
  useHashtags: boolean;
}

interface GenerateCaptionJsonResponse {
  success: boolean;
  captions: Array<{ text: string; hashtags: string[] }>;
  post_id: string;
  remainingCredits: number;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const userHeaders = options.headers as Record<string, string> | undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...userHeaders },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 204 || res.status === 304) {
      return {} as T;
    }

    const text = await res.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(`Beklenmeyen yanıt: ${text.slice(0, 100)}`, res.status);
    }

    if (!res.ok) {
      throw new ApiError(body?.error || body?.message || 'Bir hata oluştu', res.status);
    }

    return body as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('İstek zaman aşımına uğradı.', 408);
    }
    throw new ApiError('Sunucuya bağlanılamadı.', 0);
  }
}

async function requestMultipart<T>(endpoint: string, formData: FormData): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(`Beklenmeyen yanıt: ${text.slice(0, 100)}`, res.status);
    }

    if (!res.ok) {
      throw new ApiError(body?.error || body?.message || 'Bir hata oluştu', res.status);
    }

    return body as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('İstek zaman aşımına uğradı.', 408);
    }
    throw new ApiError('Sunucuya bağlanılamadı.', 0);
  }
}

export const api = {
  register: (email: string, password: string, ageRange?: string | null) =>
    request<{ user: { id: string; email: string }; token: string; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, ageRange }),
    }),

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string }; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getProfile: () =>
    request<{ id: string; email: string; age_range: string | null; credits_remaining: number }>(
      '/auth/profile',
    ),

  updateAgeRange: (ageRange: string) =>
    request<{ message: string }>('/auth/profile/age', {
      method: 'PUT',
      body: JSON.stringify({ ageRange }),
    }),

  getCaptions: () =>
    request<Array<{ id: string; caption_text: string; hashtags: string[]; created_at: string; post_id: string }>>(
      '/captions',
    ),

  createPayment: (price: string, credits: number, currency: string) =>
    request<{ paymentUrl: string }>('/payment/create', {
      method: 'POST',
      body: JSON.stringify({ price, credits, currency }),
    }),

  generateCaption: (formData: FormData) =>
    requestMultipart<{
      success: boolean;
      captions: string[];
      hashtags: string[];
      post_id: string;
      image_url: string;
      image_urls?: string[];
      remainingCredits: number;
    }>('/captions/generate', formData),

  generateCaptionJson: (data: GenerateCaptionRequest) =>
    request<GenerateCaptionJsonResponse>('/captions/generate-json', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
