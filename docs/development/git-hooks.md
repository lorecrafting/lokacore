# Git Hooks

Loka uses git hooks to enforce code quality and prevent common issues.

## Installed Hooks

### Pre-commit (`.git/hooks/pre-commit`)

Runs before every commit. Ensures code quality.

**Always runs:**
- `mix format --check-formatted` - Elixir formatting check

**Optional (enable with `EXMUD_VALIDATE=1`):**
- `mix loka.test.validate` - Content validation (prototypes, quests, world)

```bash
# Normal commit (formatting only)
git commit -m "message"

# With content validation
EXMUD_VALIDATE=1 git commit -m "message"

# Skip all hooks (use sparingly)
git commit --no-verify -m "message"
```

### Pre-push (`.git/hooks/pre-push`)

Currently no pre-push hooks are configured.

```bash
# Push normally
git push
```

## Hook Installation

Hooks are stored in `.git/hooks/` (not tracked in git). To reinstall:

```bash
# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook for Loka

ROOT_DIR="$(git rev-parse --show-toplevel)"

if ! command -v mix &> /dev/null; then
    echo "Warning: mix not found, skipping format check"
    exit 0
fi

echo "Checking Elixir formatting..."
cd "$ROOT_DIR/server" || exit 0

if ! mix format --check-formatted; then
    echo ""
    echo "❌ Formatting check failed!"
    echo "Run 'cd server && mix format' to fix formatting issues."
    exit 1
fi

echo "✓ Formatting check passed"

if [ "$EXMUD_VALIDATE" = "1" ]; then
    echo ""
    echo "Running content validation..."
    if ! mix loka.test.validate --quiet; then
        echo "❌ Content validation failed!"
        exit 1
    fi
    echo "✓ Content validation passed"
fi

exit 0
EOF
chmod +x .git/hooks/pre-commit
```

## Recommended Workflow

### Before Committing

```bash
cd server
mix format              # Fix formatting
mix loka.test --quick  # Run tests (optional but recommended)
```

### Before Pushing

```bash
git push
```

### Full Validation (CI-like)

```bash
EXMUD_VALIDATE=1 git commit -m "message"
# or
mix loka.test          # Run all test suites manually
```

## Troubleshooting

### "Formatting check failed"

```bash
cd server && mix format
git add -u
git commit --amend
```

### Hook Not Running

Check hook is executable:

```bash
ls -la .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `EXMUD_VALIDATE=1` | Enable content validation in pre-commit |
