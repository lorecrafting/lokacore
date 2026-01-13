# Loka Security Documentation

This document covers the security measures implemented in Loka to protect against common vulnerabilities and attacks.

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Input Validation](#input-validation)
- [Scripting Sandbox](#scripting-sandbox)
- [Security Headers](#security-headers)
- [Logging](#logging)
- [Secrets Management](#secrets-management)

## Authentication

### Magic Link Authentication

Loka uses Phoenix 1.8's magic link authentication by default:

- Email-based passwordless login
- Tokens expire after use
- Optional password support via `phx.gen.auth`

### JWT Tokens (API)

For API clients (mobile apps, external integrations):

| Token Type | TTL | Use Case |
|------------|-----|----------|
| Access | 1 hour | API requests |
| Refresh | 7 days | Obtain new access tokens |

**Configuration**: `config/config.exs`

```elixir
config :loka, Loka.Auth.Guardian,
  issuer: "loka",
  ttl: {1, :hour},
  token_ttl: %{
    "access" => {1, :hour},
    "refresh" => {7, :days}
  },
  allowed_algos: ["HS512"],
  verify_issuer: true
```

**Token Refresh**: Clients should refresh tokens before expiration:

```
POST /api/v1/auth/refresh
Authorization: Bearer <current_token>

Response: { "token": "new_token", "expires_at": 1234567890 }
```

## Rate Limiting

Rate limiting is implemented using ETS for storage, with automatic cleanup.

### Endpoints

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| POST `/players/register` | 3 | 1 hour | Prevent registration spam |
| POST `/players/log-in` | 5 | 1 minute | Prevent brute force |
| POST `/api/v1/auth/register` | 3 | 1 hour | API registration |
| POST `/api/v1/auth/login` | 5 | 1 minute | API login |

### Response Headers

When rate limited, responses include:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
```

### Implementation

See `lib/loka_web/plugs/rate_limiter.ex`

```elixir
plug LokaWeb.Plugs.RateLimiter,
  max_requests: 5,
  window_ms: 60_000,
  error_message: "Too many attempts. Please wait."
```

## Input Validation

### Atom Exhaustion Prevention

The BEAM VM has a limited atom table. To prevent exhaustion attacks:

1. **Map key atomization** uses `String.to_existing_atom/1` only:

   ```elixir
   # lib/loka/utils/map_helpers.ex
   def atomize_keys(map) do
     Map.new(map, fn
       {k, v} when is_binary(k) ->
         case safe_to_existing_atom(k) do
           nil -> {k, v}  # Keep as string if atom doesn't exist
           atom -> {atom, v}
         end
       {k, v} -> {k, v}
     end)
   end
   ```

2. **Dialogue actions** use a whitelist:

   ```elixir
   # lib/loka/framework/dialogue/dialogue.ex
   @valid_action_types ~w(
     offer_quest accept_quest complete_quest
     give_item take_item set_flag clear_flag
     learn_skill give_xp give_gold heal teleport
     start_combat open_shop trigger_event
   )a
   ```

### SQL Injection

Ecto parameterized queries prevent SQL injection by default. Never use string interpolation in queries.

## Scripting Sandbox

Lua scripts run in a sandboxed environment with restricted capabilities.

### Blocked Patterns

Scripts are scanned for dangerous patterns before execution:

```elixir
@blocked_patterns [
  ~r/os\./, ~r/io\./, ~r/file\./, ~r/require\s*\(/,
  ~r/getmetatable\s*\(/, ~r/setmetatable\s*\(/,
  ~r/\bload\s*\(/, ~r/loadstring\s*\(/,
  ~r/_G\b/, ~r/_ENV\b/, ~r/string\.dump\s*\(/,
  ~r/collectgarbage\s*\(/, ~r/coroutine\./,
  ~r/debug\./, ~r/package\./, ~r/rawget\s*\(/,
  ~r/rawset\s*\(/, ~r/rawequal\s*\(/
]
```

### Runtime Restrictions

Dangerous globals are removed at runtime:

- `dofile`, `loadfile`, `load`, `loadstring`
- `os`, `io`, `debug`, `package`, `coroutine` modules
- `getmetatable`, `setmetatable`, `rawget`, `rawset`

### Resource Limits

- CPU: Instruction count limits
- Memory: Allocation tracking
- Time: Execution timeouts

See `lib/loka/engine/scripting.ex` for implementation.

## Security Headers

### Production Headers

Configured in `config/prod.exs`:

```elixir
config :loka, LokaWeb.Endpoint,
  force_ssl: [
    rewrite_on: [:x_forwarded_proto],
    hsts: true,
    host: nil,
    expires: 31_536_000  # 1 year
  ]
```

### Content Security Policy

Applied via router pipeline:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' wss: ws:;
frame-ancestors 'none';
```

### Additional Headers

- `X-Frame-Options: DENY` (via frame-ancestors)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Logging

### Sensitive Data Handling

Email addresses and other PII are masked in logs using `LogSanitizer`:

```elixir
alias Loka.Utils.LogSanitizer

# Masks email: "user@example.com" -> "u***@***.com"
Logger.debug("Login attempt for #{LogSanitizer.mask_email(email)}")

# Hash for correlation: "user@example.com" -> "a1b2c3"
Logger.debug("Request [#{LogSanitizer.hash_id(email)}]")

# Complete redaction: "secret_token" -> "[REDACTED:12]"
Logger.debug("Token: #{LogSanitizer.redact(token)}")
```

### What NOT to Log

- Full email addresses
- Passwords or password hashes
- Authentication tokens
- Session identifiers
- Credit card numbers
- Any PII

## Secrets Management

### Development

Development secrets are in `config/dev.exs` with clear warnings:

```elixir
# Guardian JWT secret for development only - DO NOT USE IN PRODUCTION
config :loka, Loka.Auth.Guardian,
  secret_key: "dev_only_guardian_secret_key_not_for_production_use"
```

### Production

Production secrets are loaded from environment variables in `config/runtime.exs`:

```elixir
secret_key_base = System.get_env("SECRET_KEY_BASE") ||
  raise "SECRET_KEY_BASE is missing"

guardian_secret = System.get_env("GUARDIAN_SECRET_KEY") ||
  raise "GUARDIAN_SECRET_KEY is missing"
```

### Fly.io Secrets

Set secrets using:

```bash
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
fly secrets set RESEND_API_KEY=your_api_key
```

## Security Checklist

Before deploying:

- [ ] All secrets set via environment variables
- [ ] HTTPS/SSL configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Sensitive data not logged
- [ ] Database backups configured
- [ ] Admin access restricted

## Reporting Security Issues

If you discover a security vulnerability, please report it privately rather than opening a public issue.
