# Security Audit

Comprehensive security review of the Loka codebase.

> **Timeout Budget**: 8 minutes (Critical - don't skip)

## Areas to Audit

### A. Authentication & Authorization
- Magic link token expiration and validation
- JWT token handling (Guardian configuration)
- Session management and timeout policies
- Admin role enforcement (RequireAdmin plug)
- API rate limiting effectiveness

### B. Input Validation
- User input sanitization in LiveView events
- Command parsing safety
- YAML prototype injection vectors
- Lua script sandboxing effectiveness (verify CPU/memory limits, check for sandbox escape)
- SQL injection prevention (Ecto parameterization)
- Dynamic atom creation from user input (String.to_atom safety)

> **Note on String.to_atom**: Some uses are safe (validators reading controlled YAML). Flag only user-controlled input paths.

### C. Data Exposure
- Sensitive data in logs (passwords, tokens, PII)
- API response filtering (no internal IDs leaked)
- Error message information disclosure
- Debug endpoints in production
- Secrets in version control
- Test/fixture endpoints in non-dev builds (TestSessionController, etc.)
- Routes that bypass authentication pipeline

### D. Entity/Game Security
- Lock system bypass vectors
- Entity access control consistency
- Cross-player data access prevention
- Admin command restrictions
- Script execution limits (CPU/memory)

### E. Infrastructure
- HTTPS enforcement
- CORS configuration
- CSP headers
- Cookie security flags
- Fly.io secrets management

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Security issues categorized by severity (Critical/High/Medium/Low)
2. Specific file paths and code locations
3. Recommended fixes with code examples (bead-ready format)
4. Note if docs/security/README.md needs updates
