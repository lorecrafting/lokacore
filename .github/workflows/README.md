# Loka CI/CD

This directory contains GitHub Actions workflows for continuous integration.

## Workflows

### `test.yml` - Test Suite

Runs on every push to `main` and on all pull requests.

**Steps:**
1. **Format check** - Ensures code is properly formatted
2. **Compile** - Compiles with warnings as errors
3. **Content validation** - Validates all game content (quests, dialogues, etc.)
4. **Unit tests** - Fast unit tests (excludes integration tests)
5. **Bot integration tests** - Full storyline completion tests

**Duration:** ~3-5 minutes total
- Format/compile: <30 seconds
- Content validation: ~10 seconds
- Unit tests: ~30 seconds
- Bot tests: ~30 seconds

## Local Development

### Pre-commit Hook

The pre-commit hook automatically runs:
- `mix format --check-formatted` (always)
- `mix loka.test.validate` (when content files change)

Skip validation: `LOKA_VALIDATE=0 git commit`

### Manual Testing

```bash
# Run content validation
mix loka.test.validate

# Run specific validator
mix loka.test.validate --only quest_chain

# Run bot tests
mix loka.test.bot

# Run all tests except bot
mix test --exclude full_storyline

# Run everything
mix test
```

## CI Configuration

The CI uses:
- **Elixir:** 1.19.4
- **OTP:** 28.3
- **PostgreSQL:** 15

Caches:
- Hex packages
- Compiled dependencies
- Build artifacts

## Troubleshooting

### Bot tests timeout
Increase timeout in workflow: `timeout-minutes: 15`

### Content validation fails
Run locally: `mix loka.test.validate`
See details without quiet flag

### Dependencies cache issues
Clear cache by updating `mix.lock` or manually in GitHub Actions
