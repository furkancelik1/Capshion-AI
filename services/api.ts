import { Platform } from 'react-native';

const DEFAULT_HOST = Platform.select({
  android: '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});
const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:3000/api`;

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

export let lastNavigationTimestamp = 0;
export const setLastNavigationTimestamp = (val: number) => { lastNavigationTimestamp = val; };

export type CaptionRow = { id: string; caption_text: string; hashtags: string[]; created_at: string; post_id: string; image_url?: string };

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
  mode?: "alternatives" | "per_image";
  customPrompt?: string;
  carouselMode?: boolean;
}

interface CaptionItem {
  text: string;
  hashtags: string[];
  image_index?: number;
}

interface GenerateCaptionJsonResponse {
  success: boolean;
  captions: CaptionItem[];
  post_id: string;
  remainingCredits: number;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...userHeaders },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (endpoint === '/auth/login') {
      console.log(`[API] ADIM 2a: ${endpoint} → HTTP ${res.status} (res.ok=${res.ok})`);
    }

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

    if (endpoint === '/auth/login') {
      console.log(`[API] ADIM 2b: ${endpoint} body:`, JSON.stringify(body));
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
    request<{ id: string; email: string; age_range: string | null; credits_remaining: number; is_premium: boolean }>(
      '/auth/profile',
    ),

  updateAgeRange: (ageRange: string) =>
    request<{ message: string }>('/auth/profile/age', {
      method: 'PUT',
      body: JSON.stringify({ ageRange }),
    }),

  getCaptions: () =>
    request<CaptionRow[]>('/captions'),

  getCaptionByPostId: (postId: string) =>
    request<CaptionRow[]>(`/captions/post/${postId}`),

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
    }, 120000),

  generatePerImage: (data: GenerateCaptionRequest) =>
    request<GenerateCaptionJsonResponse>('/captions/generate-json', {
      method: 'POST',
      body: JSON.stringify({ ...data, mode: 'per_image' }),
    }, 120000),

  deleteCaption: (captionId: string) =>
    request<{ message: string }>(`/captions/${captionId}`, {
      method: 'DELETE',
    }),

  createPaymentIntent: (amount: number, currency?: string, userId?: string) =>
    request<{ clientSecret: string }>('/payments/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, currency: currency || 'usd', userId }),
    }),

  savePushToken: (pushToken: string) =>
    request<{ message: string }>('/auth/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    }),
};

export { ApiError };
