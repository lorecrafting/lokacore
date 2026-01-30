# Loka Development Backlog

This document tracks planned work and issues for the Loka MUD engine.

## Using This Backlog

Tasks are tracked here with categories and priorities. We use Claude Code's native task tools for active work during development sessions.

### Task Status

- **Backlog**: Not yet started, prioritized for future work
- **Active**: Currently being worked on
- **Blocked**: Waiting on dependencies or decisions
- **Done**: Completed and validated

---

## High Priority

### Infrastructure

### Game Systems

### Content

### UI/UX

---

## Medium Priority

### Infrastructure

### Game Systems

### Content

### UI/UX

- **Add loading/error/empty states to World Builder UI** - Better UX feedback
- **Add admin audit logging** - Track who creates/modifies content
- **Extract more LiveView components** - WorldBuilderLive is 1,262+ lines

---

## Low Priority / Future Work

### Infrastructure

### Game Systems

### Content

- **Custom style presets** - User-defined presets saved to DB (built-in presets exist)

### UI/UX

- **Add React error boundaries** - Better error recovery in 3D viewport

---

## Blocked

### Waiting on Decisions

### Waiting on Dependencies

---

## Done

### Recent Completions

- **Fix room coordinate persistence** (2026-01-30)
  - Room x/y/z coordinates now persist on create and update
  - Fixed `enrich_room_for_frontend` to check both attributes and data
  - Fixed `build_room_yaml` to write attributes section with coordinates
  - Fixed `delete_room` to also delete YAML file (not just registry)
  - Cleaned up unused functions and aliases

- **World Builder LLM Enhancement** (2026-01-30)
  - Enhanced context_builder.ex with NPC/quest/item/zone context
  - Added 17 tools to claude_client.ex (was 4)
  - Implemented 9 new tool handlers in tool_executor.ex
  - Implemented NPC consistency checking (was empty)
  - Added 12 new tests for tool_executor
  - Cleaned up unused aliases
  - HTTPoison → Req migration (was already done)

- Migrated to backlog document for issue tracking (2026-01-24)
