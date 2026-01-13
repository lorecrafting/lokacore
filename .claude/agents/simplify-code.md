# simplify-code

Refactor and clean up code after implementation is complete.

## Purpose

Identify opportunities to simplify, clarify, and improve code quality without changing functionality.

## Instructions

Analyze the codebase (or specified files) and identify simplification opportunities:

### 1. Find Repeated Patterns

Search for duplicated code:
- Similar function implementations across files
- Copy-pasted logic blocks
- Repeated pattern matching
- Identical validations

**Action**: Suggest extracting to shared functions/modules

### 2. Long Functions (>50 lines)

Find functions exceeding 50 lines:
```bash
# Use Grep or Read to identify long functions
# Look in lib/loka/, lib/loka_web/
```

**Action**: Suggest breaking into smaller, focused functions with clear names

### 3. Compiler Warnings

Review Elixir compiler warnings:
- Unused variables (prefix with `_` or remove)
- Unused imports/aliases (remove)
- Unused function arguments (prefix with `_`)
- Typing violations (fix or document)

**Action**: Provide specific fixes for each warning

### 4. Complex Conditionals

Find complex if/case/cond statements:
- Nested conditionals (>2 levels deep)
- Long case statements (>5 clauses)
- Multiple boolean conditions combined with AND/OR

**Action**: Suggest simplification with:
- Pattern matching in function heads
- Guard clauses
- Early returns
- Helper functions with descriptive names

### 5. Hardcoded Values

Find magic numbers and strings:
- Hardcoded timeout values
- Repeated strings
- Magic numbers in calculations
- Configuration values in code

**Action**: Move to module attributes (`@timeout 5000`) or config files

### 6. Unclear Names

Find unclear variable/function names:
- Single letter variables (except i, x, y in obvious contexts)
- Abbreviations without context
- Generic names (data, result, temp, tmp)
- Misleading names (doesn't match what it does)

**Action**: Suggest descriptive renames

### 7. Self-Documenting Code

Find comments that could be self-documenting code:
- Comments explaining what code does (should be obvious from names)
- TODO comments that should be beads
- Outdated comments that don't match code

**Action**:
- Remove obvious comments, improve names instead
- Convert TODOs to beads
- Update or remove outdated comments

## Focus Areas

Prioritize by impact:
1. **High Impact**: Security issues, bugs, performance problems
2. **Medium Impact**: Code duplication, unclear logic, poor naming
3. **Low Impact**: Style inconsistencies, minor optimizations

## Elixir Idioms to Prefer

- Pattern matching over conditionals
- Pipe operator (`|>`) for data transformations
- `with` for sequential operations with error handling
- Early returns with guard clauses
- Module attributes for constants
- `Enum` functions over recursion
- Keyword lists for options

## Output Format

```markdown
# Code Simplification Report

## High Priority

### 1. [Issue Category]
**File**: path/to/file.ex
**Lines**: 45-67
**Issue**: [Description]
**Current**:
```elixir
[current code snippet]
```
**Suggested**:
```elixir
[simplified code snippet]
```
**Rationale**: [Why this is better]

## Medium Priority
[Same format]

## Low Priority
[Same format]

## Compiler Warnings Fixed
- [ ] `lib/file.ex:123` - Unused variable `foo`
- [ ] `lib/other.ex:456` - Unused alias Bar

## Summary
- Total suggestions: X
- High priority: Y
- Estimated time to implement: Z hours
```

## Exclusions

Don't suggest changes for:
- Generated code (migrations, schemas from phx.gen.auth)
- Third-party dependencies
- Test fixtures with intentionally verbose examples
- Code that's intentionally explicit for clarity

## Success Criteria

- All suggestions preserve functionality
- Each suggestion includes specific file:line references
- Rationale explains the benefit
- Prioritized by impact
- Actionable (can be implemented immediately)

## Notes

- Focus on readability and maintainability
- Prefer Elixir idioms over generic patterns
- Don't over-engineer simple code
- Balance DRY with clarity (3+ repetitions = extract, <3 = leave inline)
