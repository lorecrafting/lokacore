# verify-game

Comprehensive post-implementation testing workflow for Loka MUD.

## Purpose

Run complete game verification after changes to ensure nothing broke.

## Instructions

Execute the following verification steps in order:

### 1. Unit Tests
```bash
cd server && mix test
```
- Check exit code (0 = pass)
- Count passing/failing tests
- Note any new failures

### 2. Content Validation
```bash
cd server && mix loka.test.validate
```
- Validate prototypes, quests, dialogues, world connectivity
- Check for missing entities, broken references
- Flag any errors or warnings

### 3. Storyline Tests (if applicable)
```bash
cd server && mix loka.test.storyline --list
# Then test each storyline
cd server && mix loka.test.storyline monastery_arc
```
- Only run if storyline-related changes were made
- Verify quest chains are complete

### 4. Balance Check
```bash
cd server && mix loka.test.balance --quick
```
- Quick combat simulation (100 iterations)
- Check for critical balance issues (win rate <60% or >80%)
- Note any P0/P1 severity issues

### 5. Compilation Warnings
- Review Elixir compiler warnings from test runs
- Flag unused variables, undefined functions, typing violations

### 6. Smoke Tests (Manual Verification Prompts)

Verify core game systems are functional by checking:

**Navigation**:
- Can entities spawn in rooms?
- Do exits work between connected rooms?
- Are room coordinates maintained?

**Combat**:
- Can player attack NPCs?
- Does damage calculation work?
- Do NPCs fight back?
- Does death/respawn work?

**Inventory**:
- Can player get/drop items?
- Does equipment work?
- Are item stats applied correctly?

**Quest System**:
- Do objectives track correctly (go_to, kill, get_item, talk)?
- Do quest rewards grant properly?
- Does quest completion work?

**Dialogue**:
- Do NPC conversations display?
- Do dialogue actions execute (give_item, complete_quest)?
- Do conditions evaluate correctly?

## Output Format

Provide a verification report:

```
# Loka Game Verification Report

## ✅ Tests Passed
- Unit tests: X/Y passed
- Content validation: 0 errors, N warnings
- Balance check: Score X/10

## ⚠️ Warnings
- [List any non-critical issues]

## ❌ Failures
- [List any test failures or critical issues]

## 🎯 Smoke Test Checklist
- [ ] Navigation working
- [ ] Combat working
- [ ] Inventory working
- [ ] Quests working
- [ ] Dialogue working

## Summary
Overall Status: ✅ ALL SYSTEMS GO | ⚠️ WARNINGS PRESENT | ❌ CRITICAL ISSUES FOUND
```

## Success Criteria

- All unit tests pass
- No content validation errors
- Balance score >= 6.0
- No critical (P0) issues
- Core systems functional

## Notes

- Run this after any significant code changes
- Run before creating commits/PRs
- If failures found, fix before proceeding
- Document any expected failures (known issues)
