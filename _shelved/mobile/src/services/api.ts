/**
 * API service for communicating with the ExMUD server.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

interface AuthResponse {
  token: string;
  player: {
    id: number;
    email: string;
  };
}

interface ApiError {
  error?: string;
  errors?: Record<string, string[]>;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as ApiError).error || 'Request failed');
    }

    return data as T;
  }

  // Auth endpoints
  async register(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async me(): Promise<{ player: { id: number; email: string } }> {
    return this.request('/api/v1/auth/me');
  }

  // Health check
  async health(): Promise<{ status: string; version: string; timestamp: string }> {
    return this.request('/api/health');
  }
}

export const api = new ApiService();
export default api;
