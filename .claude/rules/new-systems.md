# New System Development

Applies when creating new framework modules, behaviors, content types, or game systems.

**Before implementing, check `docs/development/new-system-checklist.md`.**

Key reminders:
- If the system has distinct states/phases, use `Loka.Engine.StateMachine` — don't use booleans or implicit state
- Everything is an entity in V2 — data goes in components, not separate tables
- Recurring logic uses `EntityBehavior` (on_init, on_tick, on_event)
- Content created by builders needs a validator in `lib/loka/testing/content/`
- Create a component accessor in `lib/loka/components/`
