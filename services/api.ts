import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api';

let _token: string | null = null;

const _imageCache = new Map<string, string[]>();

export function setCachedImageUris(postId: string, uris: string[]) {
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

  const res = await fetch(url, {
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
    ...options,
  });

  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(body?.error || body?.message || 'Bir hata oluştu', res.status);
  }

  return body as T;
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

  try {
    console.log(`[Multipart] POST ${url} — gönderiliyor...`);
    const res = await axios({
      method: 'post',
      url,
      data: formData,
      headers,
      timeout: 30000,
    });
    console.log(`[Multipart] Başarılı — status: ${res.status}`);
    return res.data as T;
  } catch (err: any) {
    console.error('═══════════ AXIOS HATA DETAYI ═══════════');
    console.error('Hata adı    :', err.name);
    console.error('Hata mesajı :', err.message);
    console.error('Hata kodu   :', err.code || 'yok');

    if (err.response) {
      console.error('Status      :', err.response.status);
      console.error('Data        :', JSON.stringify(err.response.data, null, 2));
      throw new ApiError(
        err.response.data?.error || err.response.data?.message || `Sunucu hatası (${err.response.status})`,
        err.response.status,
      );
    } else if (err.request) {
      console.error('Sunucuya ulaşılamadı — muhtemel sebepler:');
      console.error('  1. Backend çalışmıyor');
      console.error('  2. Android emulatorde 10.0.2.2 kullanilmiyor');
      console.error('  3. URI file:// ön eki eksik');
      throw new ApiError('Sunucuya ulaşılamadı. Bağlantıyı kontrol edin.', 0);
    } else {
      throw new ApiError(err.message || 'İstek oluşturulamadı.', 0);
    }
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

  generateCaptionJson: (data: any) =>
    request<{
      success: boolean;
      captions: Array<{ text: string; hashtags: string[] }>;
      post_id: string;
      remainingCredits: number;
    }>('/captions/generate-json', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
