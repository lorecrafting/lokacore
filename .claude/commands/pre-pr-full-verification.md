# Pre-PR Full Verification

Comprehensive verification workflow to run before creating a pull request.

## Usage

```
/pre-pr-full-verification
```

## Instructions

Execute the following verification steps in order:

### Step 1: Unit Tests

```bash
cd server && mix test
```

- Check exit code (0 = pass)
- Count passing/failing tests
- Note any new failures

### Step 2: Content Validation

```bash
cd server && mix loka.test.validate
```

- Validate prototypes, quests, dialogues, world connectivity
- Check for missing entities, broken references
- Flag any errors or warnings

### Step 3: Storyline E2E Tests (if applicable)

```bash
cd server && mix test test/integration/storyline_channel_test.exs
```

- Only run if storyline-related changes were made
- Uses ChannelBot for 95% production parity E2E testing
- Verify quest chains are completable

### Step 4: Balance Check

```bash
cd server && mix loka.test.balance --quick
```

- Quick combat simulation (100 iterations)
- Check for critical balance issues (win rate <60% or >80%)
- Note any P0/P1 severity issues

### Step 5: Compilation Warnings

- Review Elixir compiler warnings from test runs
- Flag unused variables, undefined functions, typing violations
- All warnings should be fixed before PR

### Step 6: Code Formatting

```bash
cd server && mix format --check-formatted
```

- Ensure all code is properly formatted
- Fix any formatting issues

### Step 7: Git Status Review

```bash
git status
git diff --stat
```

- Review all changed files
- Ensure no unintended changes
- Check for files that shouldn't be committed

## Output Format

```markdown
# Pre-PR Verification Report

## Tests
- Unit tests: X/Y passed ✅ | ❌
- Content validation: 0 errors, N warnings ✅ | ❌
- Balance check: Score X/10 ✅ | ❌
- Formatting: ✅ | ❌

## Warnings
- [List any non-critical issues]

## Failures
- [List any test failures or critical issues]

## Files Changed
- [Summary of changes]

## Checklist
- [ ] All unit tests pass
- [ ] Content validation clean
- [ ] Balance score >= 6.0
- [ ] No compiler warnings
- [ ] Code formatted
- [ ] Changes reviewed

## Summary
Overall Status: ✅ READY FOR PR | ⚠️ WARNINGS PRESENT | ❌ NOT READY
```

## Success Criteria

- All unit tests pass
- No content validation errors
- Balance score >= 6.0
- No critical (P0) issues
- No compiler warnings
- Code properly formatted

## Quick Mode

For small changes, you can run the quick verification:

```bash
cd server && mix test && mix loka.test.validate --quick && mix format --check-formatted
```

## Notes

- Run this BEFORE creating a PR, not after
- Fix all issues before pushing
- If balance tests are slow, use `--quick` flag
- Document any expected warnings
