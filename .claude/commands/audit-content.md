# Loka Content Health Audit

Perform a comprehensive content health audit on the Loka codebase. This periodic cleanup ensures game data, UI, mechanics, and player experience are fully congruent.

> **Timeout Budget**: 10 minutes

## Phase 1: Automated Validation

Run `mix loka.test.validate --strict` and address all errors and warnings:
- UI/Data consistency
- Quest completability
- World connectivity
- Dialogue trees
- Prototype definitions
- Content reachability

## Phase 2: Deep Codebase Scan

Go beyond validators - search for issues they can't detect:

### A. UI/Code Alignment
- Search UI components (lib/loka_web/live/game_live/components/) for component/tag checks
- Verify those checks match what YAML prototypes actually use
- Check for hardcoded keys, component names, or tag names that may have changed
- Look for conditional rendering that depends on data the YAML might not provide

### B. Deprecated Patterns & Dead Code
- Search for fallback patterns (code that handles "old way OR new way")
- Find commented-out code or TODOs that reference old structures
- Look for unused functions, modules, or imports
- Check for string literals that reference old component/tag names

### C. Data Consistency Across Layers
- Shop sells/buys lists -> item prototypes exist
- **Shop items cannot be unsellable**: Items in `shop.sells` must not have `cannot_sell: true`
- Quest objectives -> target NPCs/items/rooms exist
- Dialogue actions -> referenced quests/items/flags are valid
- Loot tables -> items exist and are obtainable elsewhere too
- Teacher mantras/skills -> ability definitions exist
- Crafting recipes -> ingredients and outputs exist

### D. Player Path Completeness
- Every quest is acceptable through dialogue (has accept_quest action)
- Every quest is completable (turn-in dialogue exists)
- Quest chains don't dead-end (prerequisites lead somewhere)
- NPCs mentioned in dialogue actually exist and are reachable
- Items mentioned as rewards/requirements are obtainable

### E. Geographic/Spatial Logic
- Room descriptions match exit directions (e.g., "path leads north" but exit is south)
- Elevation makes sense (going "up" from village shouldn't lead "down" back)
- Room connections form logical geography (no teleporting across the map)
- Safe zones don't spawn hostile NPCs
- Dangerous areas don't claim to be safe

### F. Narrative Consistency
- NPC dialogue doesn't reference events/NPCs/items that don't exist
- Quest descriptions match what objectives actually require
- Dialogue action format consistency (list format, not string)

> **Note**: Check structural consistency (references exist). Writing quality and lore depth covered by `/audit-narrative`.

> **Moved**: Balance & Progression checks (shop prices, combat stats, quest rewards) are now in `/audit-balance`. This audit only checks structural consistency, not numeric values.

### G. Component/Tag Hygiene
- Same concept uses consistent names (not "shop" and "merchant" interchangeably)
- Tags serve clear purposes (not just arbitrary categorization)
- Component structures are consistent across similar entity types

## Phase 3: Validator Maintenance

If issues are found that validators SHOULD catch but don't:
- Update validator logic (add to known_components, improve detection)
- Add new validation rules for patterns that cause problems
- Fix false positives so validators stay useful

## Phase 4: Reporting

Provide a summary:
- Issues found by category
- Fixes applied
- Validation results before/after
- Any remaining acceptable warnings and why
- Suggestions for new validators if patterns are discovered

Commit with: "fix: Content health audit - [main categories addressed]"
