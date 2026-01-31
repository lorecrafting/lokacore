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

---

## Low Priority / Future Work

### Infrastructure

### Game Systems

### Content

- **Custom style presets** - User-defined presets saved to DB (built-in presets exist)

### UI/UX

---

## Blocked

### Waiting on Decisions

### Waiting on Dependencies

---

## Done

### Recent Completions

- **WorldBuilderLive Component Extraction Phase 2** (2026-01-30)
  - Reduced WorldBuilderLive from ~2,700 to ~2,336 lines (406 lines extracted)
  - Extracted `DialogueEventHandler` - all dialogue_* event handlers (11 handlers)
  - Extracted `EntityEventHandler` - NPC/Item CRUD operations (8 handlers)
  - Created `Helpers` module - shared utilities (parse_integer, slugify, sanitize_error, log_console)
  - All event handlers now delegate to specialized modules
  - Clean separation of concerns: handlers, helpers, main LiveView

- **World Builder UX & Audit Logging** (2026-01-30)
  - Added admin audit logging system:
    - `audit_logs` table with player, action, entity_type, before/after state
    - `Loka.Admin.AuditLog` schema with query helpers (by_player, by_entity, recent)
    - `Loka.Admin.Audit` context module with async logging via Task.Supervisor
    - `AuditLogTab` LiveComponent with filters and pagination
    - Integrated audit logging in WorldBuilderLive (room/npc/item create/delete)
  - Added loading/error/empty state components:
    - `LoadingComponents` module: spinner, loading_overlay, progress_bar, empty_state, loading_button
    - Updated HierarchyPanel with empty states (icons for rooms, NPCs, items)
  - Extracted UI components from WorldBuilderLive:
    - `ConfirmationModal` - reusable confirm dialog
    - `CreateEntityModal` - generic create form for room/npc/item
  - Files created: 8 new files, 5 modified

- **Fix room coordinate persistence** (2026-01-30)
  - Room x/y/z coordinates now persist on create and update
  - Root cause: TypedObject stores top-level YAML fields in `data`, not `attributes`
  - Fixed `enrich_room_for_frontend` to check both `attributes` AND `data`
  - Fixed `build_room_yaml` to write `attributes:` section with coordinates
  - Fixed `delete_room` to also delete YAML file (not just registry)
  - Created skill: `.claude/skills/typed-object-field-storage.md`

- **World Builder LLM Enhancement** (2026-01-30)
  - Enhanced context_builder.ex with NPC/quest/item/zone context
  - Added 17 tools to claude_client.ex (was 4)
  - Implemented 9 new tool handlers in tool_executor.ex
  - Implemented NPC consistency checking (was empty)
  - Added 12 new tests for tool_executor
  - Cleaned up unused aliases
  - HTTPoison → Req migration (was already done)

- Migrated to backlog document for issue tracking (2026-01-24)
