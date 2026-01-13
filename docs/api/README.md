# REST API Reference

Loka provides a REST API for external clients (mobile apps, CLI tools, etc.) with JWT-based authentication.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       REST API                               │
├─────────────────────────────────────────────────────────────┤
│ Health Endpoints (Public)                                   │
│   GET /api/health          - Liveness check                 │
│   GET /api/health/ready    - Readiness check                │
│   GET /api/health/detailed - System metrics                 │
├─────────────────────────────────────────────────────────────┤
│ Auth Endpoints (Public, Rate Limited)                       │
│   POST /api/v1/auth/register - Create account (3/hour)      │
│   POST /api/v1/auth/login    - Login (5/min)                │
├─────────────────────────────────────────────────────────────┤
│ Protected Endpoints (Bearer Token Required)                 │
│   GET  /api/v1/auth/me       - Current player info          │
│   POST /api/v1/auth/refresh  - Refresh access token         │
└─────────────────────────────────────────────────────────────┘
```

## Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:4000` |
| Production | `https://your-app.fly.dev` |

## Authentication

The API uses JWT (JSON Web Tokens) with Guardian for authentication.

### Token Types

| Type | Lifetime | Purpose |
|------|----------|---------|
| Access | 1 hour | API requests |
| Refresh | 7 days | Obtain new access tokens |

### Authentication Flow

```
1. Register or Login
   POST /api/v1/auth/register  or  POST /api/v1/auth/login
   ↓
   Response: { token: "eyJ...", expires_at: 1234567890 }

2. Use Token in Requests
   Authorization: Bearer eyJ...
   ↓
   Access protected endpoints

3. Refresh Before Expiration
   POST /api/v1/auth/refresh
   Authorization: Bearer eyJ...
   ↓
   Response: { token: "new_token", expires_at: ... }
```

### Request Headers

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/v1/auth/register` | 3 requests | 1 hour |
| `/api/v1/auth/login` | 5 requests | 1 minute |

When rate limited, you'll receive:
```json
{
  "error": "Too many authentication attempts. Please wait before trying again."
}
```

---

## Health Endpoints

### GET /api/health

Basic liveness check. Returns 200 if the application is running.

**Authentication**: None

**Response** (200 OK):
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2024-01-20T12:00:00Z"
}
```

---

### GET /api/health/ready

Readiness check that verifies critical dependencies (database, PubSub).

**Authentication**: None

**Response** (200 OK - All checks pass):
```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "pubsub": true
  },
  "timestamp": "2024-01-20T12:00:00Z"
}
```

**Response** (503 Service Unavailable - Some checks fail):
```json
{
  "status": "not_ready",
  "checks": {
    "database": false,
    "pubsub": true
  },
  "timestamp": "2024-01-20T12:00:00Z"
}
```

---

### GET /api/health/detailed

Detailed system metrics including memory usage, process counts, and scheduler info.

**Authentication**: None

**Response** (200 OK):
```json
{
  "status": "ok",
  "version": "0.1.0",
  "elixir_version": "1.16.0",
  "otp_version": "26",
  "uptime_seconds": 3600,
  "memory": {
    "total_mb": 128.45,
    "processes_mb": 45.23,
    "ets_mb": 12.34
  },
  "processes": {
    "count": 234,
    "limit": 262144
  },
  "schedulers": {
    "online": 8,
    "total": 8
  },
  "checks": {
    "database": true,
    "pubsub": true
  },
  "timestamp": "2024-01-20T12:00:00Z"
}
```

---

## Auth Endpoints

### POST /api/v1/auth/register

Create a new player account.

**Authentication**: None

**Rate Limit**: 3 requests per hour per IP

**Request**:
```json
{
  "email": "player@example.com",
  "password": "securepassword123"
}
```

**Response** (201 Created):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_at": 1705755600,
  "player": {
    "id": 1,
    "email": "player@example.com"
  }
}
```

**Response** (422 Unprocessable Entity - Validation Error):
```json
{
  "errors": {
    "email": ["has already been taken"],
    "password": ["should be at least 12 character(s)"]
  }
}
```

**Response** (429 Too Many Requests):
```json
{
  "error": "Too many registration attempts. Please try again later."
}
```

---

### POST /api/v1/auth/login

Authenticate with email and password.

**Authentication**: None

**Rate Limit**: 5 requests per minute per IP

**Request**:
```json
{
  "email": "player@example.com",
  "password": "securepassword123"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_at": 1705755600,
  "player": {
    "id": 1,
    "email": "player@example.com"
  }
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Invalid email or password"
}
```

---

### POST /api/v1/auth/refresh

Refresh an access token before it expires.

**Authentication**: Bearer token required

**Request**: No body required

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_at": 1705759200
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Invalid or expired token"
}
```

---

### GET /api/v1/auth/me

Get the current authenticated player's information.

**Authentication**: Bearer token required

**Response** (200 OK):
```json
{
  "player": {
    "id": 1,
    "email": "player@example.com"
  }
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "unauthenticated"
}
```

---

## Error Responses

The API uses standard HTTP status codes and consistent error formats.

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid request body |
| 401 | Unauthorized - Authentication required or failed |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Dependency unavailable |

### Error Formats

**Simple Error**:
```json
{
  "error": "Error message here"
}
```

**Validation Errors** (Ecto changeset):
```json
{
  "errors": {
    "field_name": ["error message 1", "error message 2"],
    "other_field": ["another error"]
  }
}
```

---

## Code Examples

### cURL

```bash
# Register
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "securepassword123"}'

# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "securepassword123"}'

# Get current player (with token)
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGci..."

# Refresh token
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  -H "Authorization: Bearer eyJhbGci..."

# Health check
curl http://localhost:4000/api/health
```

### JavaScript/TypeScript

```typescript
const API_BASE = 'http://localhost:4000';

// Login and store token
async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('tokenExpires', data.expires_at);
  return data;
}

// Make authenticated request
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // Auto-refresh if unauthorized
  if (response.status === 401) {
    await refreshToken();
    return fetchWithAuth(url, options);
  }

  return response;
}

// Refresh token before expiration
async function refreshToken() {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    // Token expired, redirect to login
    window.location.href = '/login';
    return;
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('tokenExpires', data.expires_at);
}
```

### Elixir (HTTPoison)

```elixir
defmodule MyApp.LokaClient do
  @base_url "http://localhost:4000"

  def login(email, password) do
    body = Jason.encode!(%{email: email, password: password})

    case HTTPoison.post("#{@base_url}/api/v1/auth/login", body, [
      {"Content-Type", "application/json"}
    ]) do
      {:ok, %{status_code: 200, body: body}} ->
        {:ok, Jason.decode!(body)}
      {:ok, %{status_code: 401}} ->
        {:error, :unauthorized}
      {:error, reason} ->
        {:error, reason}
    end
  end

  def get_me(token) do
    case HTTPoison.get("#{@base_url}/api/v1/auth/me", [
      {"Authorization", "Bearer #{token}"}
    ]) do
      {:ok, %{status_code: 200, body: body}} ->
        {:ok, Jason.decode!(body)}
      {:ok, %{status_code: 401}} ->
        {:error, :unauthorized}
    end
  end
end
```

---

## Prometheus Metrics

The API exposes Prometheus metrics at `/metrics` for monitoring:

```bash
curl http://localhost:4000/metrics
```

Metrics include:
- HTTP request counts and durations
- Phoenix channel metrics
- BEAM VM metrics (memory, processes, schedulers)
- Custom application metrics

---

## Files

| File | Description |
|------|-------------|
| `lib/loka_web/controllers/api/health_controller.ex` | Health check endpoints |
| `lib/loka_web/controllers/api/auth_controller.ex` | Authentication endpoints |
| `lib/loka_web/controllers/api/fallback_controller.ex` | Error handling |
| `lib/loka_web/controllers/api/error_json.ex` | Error JSON views |
| `lib/loka_web/plugs/auth_pipeline.ex` | Guardian auth pipeline |
| `lib/loka_web/plugs/rate_limiter.ex` | Rate limiting plug |

## Related

- [Security Documentation](../security/README.md) - Security measures
- [Monitoring Guide](../operations/monitoring.md) - Health checks and telemetry
