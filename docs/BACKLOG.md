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

- **Extract more LiveView components (Phase 2)** - ModalManager pattern, DialogueEventHandler, EntityUpdateHandler still to extract
  - WorldBuilderLive reduced from 2,758 to ~2,700 lines (Phase 1 complete)
  - ConfirmationModal, CreateEntityModal extracted
  - LoadingComponents module with spinner, progress_bar, empty_state created

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
