const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

interface AuthResponse {
  token: string;
  refresh_token: string;
}

interface LoginResponse extends AuthResponse {
  player: {
    id: string;
    email: string;
  };
}

interface GuestLoginResponse extends AuthResponse {}

interface MeResponse {
  id: string;
  email: string;
}

async function request<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function guestLogin(
  deviceId: string,
  name: string,
): Promise<GuestLoginResponse> {
  return request<GuestLoginResponse>("/api/v1/auth/guest", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, name }),
  });
}

export async function refreshToken(
  refreshToken: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>("/api/v1/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

const authClient = { login, guestLogin, refreshToken, getMe };
export default authClient;
