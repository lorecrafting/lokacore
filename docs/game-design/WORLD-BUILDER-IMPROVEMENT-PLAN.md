# World Builder Improvement Plan

> **Created:** 2026-01-19
> **Status:** Planning
> **Goal:** Make the World Builder the primary tool for creating game content

---

## Time Estimation Rule

**All time estimates are in LLM development time (Claude Opus 4.5), NOT human coding time.**

| LLM Time | Human Equivalent | Task Type |
|----------|------------------|-----------|
| 1-2 min | 15-30 min | Add a button, simple edit |
| 5-10 min | 1-2 hours | Bug fix with investigation |
| 15-30 min | 4-8 hours | Feature implementation |
| 1-2 hours | 1-2 days | Complex multi-file feature |

**Why:** LLM can read/write code instantly, doesn't need to context-switch, and can parallelize investigation. Human estimates would be misleading.

---

## Current State Summary

The World Builder has significant infrastructure already built, but several features are inaccessible or buggy.

### What's Built vs What's Accessible

| Component | Backend | Frontend | UI Access |
|-----------|---------|----------|-----------|
| Room Editor | ✅ RoomManager | ✅ Inspector Panel | ✅ Yes |
| NPC Editor | ✅ EntityManager | ✅ Simple Modal | ⚠️ Buggy |
| Item Editor | ✅ EntityManager | ✅ Simple Modal | ⚠️ Buggy |
| Quest Editor | ✅ QuestManager | ✅ React Component | ✅ Yes |
| Cutscene Editor | ✅ CutsceneManager | ✅ React Timeline | ✅ Yes |
| Dialogue Editor | ✅ Content.Dialogue | ✅ LiveView Tree | ❌ No button |
| **Script Editor** | ✅ ScriptManager | ✅ Monaco + API ref | ❌ No button |
| Template System | ✅ TemplateManager | ✅ Template picker | ⚠️ Partial |

---

## Priority Tiers

### Tier 1: Instant Wins (< 5 min LLM time each)

These are features that exist but just need UI access.

#### 1.1 Add Script Button to Toolbar
**Why:** Full Monaco editor with validation exists, just needs a button
**LLM Effort:** 1-2 minutes
**Files:** `toolbar.ex`
```elixir
# Add after Cutscene button:
<button class="toolbar-btn" phx-click="show_script_editor" title="Create Script">
  <.icon name="hero-code-bracket" class="size-4" />
  <span style="font-size: 0.75rem; margin-left: 4px;">Script</span>
</button>
```

#### 1.2 Add Dialogue Button to Toolbar
**Why:** Dialogue tree editor exists, just needs a button
**LLM Effort:** 1-2 minutes
**Files:** `toolbar.ex`

#### 1.3 Fix Console Errors
**Why:** 2000+ React/LiveView integration warnings hurt debugging
**LLM Effort:** 5-10 minutes
**Issue:** `input with name="id"` and React container unmount warnings
**Files:** `inspector_panel.ex`, JS hooks

---

### Tier 2: Core Functionality Fixes (10-30 min LLM time each)

#### 2.1 Fix Room Selection
**Why:** Clicking rooms in list doesn't update selection state
**LLM Effort:** 10-15 minutes (investigate + fix)
**Symptoms:**
- "Selected: None" persists after clicking
- Inspector doesn't show room details
**Investigation needed:** Event propagation between list and viewport

#### 2.2 Improve NPC/Item Editors
**Why:** Current modals are basic forms, no connection to scripts/dialogues
**LLM Effort:** 20-30 minutes
**Current:** Just key, name, description, level
**Needed:**
- Link to scripts (on_talk, on_damage hooks)
- Link to dialogues
- Stats/attributes editor
- Spawn location selector

#### 2.3 Add Script Attachment to Entities
**Why:** Scripts exist but can't be attached to NPCs/Rooms via UI
**LLM Effort:** 15-20 minutes
**Flow needed:**
1. Select NPC in viewport/list
2. Open NPC inspector
3. "Add Script" button → Script picker or Script editor
4. Script saved with `entity_key` pointing to NPC

---

### Tier 3: Feature Enhancements (30-60 min LLM time each)

#### 3.1 Unified Entity Inspector
**Why:** Currently only rooms have inspector, NPCs/Items don't
**LLM Effort:** 30-45 minutes
**Design:**
- Detect selected entity type
- Show appropriate fields
- Scripts section for all entity types
- Dialogues section for NPCs

#### 3.2 Visual Script Attachment
**Why:** See which entities have scripts at a glance
**LLM Effort:** 30-40 minutes
**Features:**
- Icon overlay on entities with scripts
- Click to edit script
- Quick-add script from context menu

#### 3.3 Dialogue Tree Visual Editor Improvements
**Why:** Current tree editor is functional but basic
**LLM Effort:** 45-60 minutes
**Features:**
- Visual node connections (like flowchart)
- Drag to reorder
- Preview dialogue in-editor
- Condition editor for branches

#### 3.4 Quest → Dialogue → Script Integration
**Why:** These systems should link together
**LLM Effort:** 45-60 minutes
**Example flow:**
1. Create quest "Find the Artifact"
2. Quest needs dialogue with NPC
3. Dialogue needs script to check quest state
4. All linked and validated together

---

### Tier 4: Polish & UX (1-2 hours LLM time each)

#### 4.1 Undo/Redo System
**LLM Effort:** 60-90 minutes
**Current:** Backend exists (`UndoManager.js`), UI shows count
**Needed:** Actually functional undo/redo for all operations

#### 4.2 Multi-Select Batch Operations
**LLM Effort:** 45-60 minutes
**Current:** Shift-select rooms, batch move/clone/delete
**Needed:** Same for NPCs, Items

#### 4.3 Search & Filter
**LLM Effort:** 30-45 minutes
**Current:** Template search exists
**Needed:**
- Search all entities
- Filter by type, tags, zone
- Find entities with/without scripts

#### 4.4 Validation Dashboard
**LLM Effort:** 60-90 minutes
**Current:** "Validate" button runs quest chain validation
**Needed:**
- Visual validation results panel
- Click error → jump to entity
- Auto-fix suggestions
- Validate scripts, dialogues, not just quests

---

## Implementation Order Recommendation

### Phase 1: Unblock Content Creation (~5 min LLM time)
1. Add Script button to toolbar (1-2 min)
2. Add Dialogue button to toolbar (1-2 min)
3. Test that Script/Dialogue editors actually work (manual)

### Phase 2: Fix Core Bugs (~30 min LLM time)
4. Fix room selection propagation (10-15 min)
5. Fix console errors (5-10 min)
6. Verify NPC/Item creation actually saves (5 min)

### Phase 3: Connect the Systems (~60 min LLM time)
7. Add script attachment UI to NPC inspector (15-20 min)
8. Add dialogue attachment UI to NPC inspector (15-20 min)
9. Show linked scripts/dialogues in inspector (20-30 min)

### Phase 4: Polish (~3-4 hours LLM time)
10. Unified entity inspector (30-45 min)
11. Visual indicators for scripts/dialogues (30-40 min)
12. Search and filter (30-45 min)
13. Better validation feedback (60-90 min)

**Total estimated LLM time for full implementation: ~5 hours**
(Human equivalent: ~2-3 weeks of focused development)

---

## Technical Notes

### File Locations

| Feature | LiveView | React | Backend |
|---------|----------|-------|---------|
| Toolbar | `toolbar.ex` | - | - |
| Script Editor | `script_editor.ex` | `ScriptEditor.jsx` | `ScriptManager` |
| Dialogue Editor | `dialogue_editor.ex` | - | `Content.Dialogue` |
| Quest Editor | (wrapper only) | `QuestEditor.jsx` | `QuestManager` |
| NPC/Item | (inline modal) | - | `EntityManager` |
| Room Inspector | `inspector_panel.ex` | - | `RoomManager` |

### Event Flow

```
Toolbar Button Click
    ↓
phx-click="show_X_editor"
    ↓
handle_event in world_builder_live.ex
    ↓
assign(:show_X_editor, true)
    ↓
Conditional render in template
    ↓
phx-hook mounts React component (if applicable)
```

### Known Integration Issues

1. **React/LiveView conflict:** LiveView patches DOM, React expects to own it
   - Symptom: "React-rendered content removed without React"
   - Solution: Use `phx-update="ignore"` on React mount points

2. **Form input name="id":** LiveView reserves "id" for DOM patching
   - Symptom: Console errors on every update
   - Solution: Rename to "entity_id" or "room_id"

---

## Success Metrics

The World Builder is "good enough" when:

1. [ ] Can create a room without touching YAML
2. [ ] Can create an NPC and attach a script via UI
3. [ ] Can create a dialogue tree and attach to NPC via UI
4. [ ] Can create a quest that references the dialogue
5. [ ] Can validate all content without leaving the builder
6. [ ] Can commit changes to git via the builder
7. [ ] No console errors during normal operation

---

## Questions to Decide

1. **Should scripts be standalone or always attached to entities?**
   - Current: Can be either (entity_key optional)
   - Recommendation: Keep flexible, but UI emphasizes attachment

2. **Should dialogues live in YAML or DB?**
   - Current: YAML only
   - For builder: Need save-to-YAML flow (like scripts)

3. **Priority: Fix bugs or add features?**
   - Recommendation: Bugs first (especially selection)

---

## Session Log

### 2026-01-19
- Completed World Builder feature audit
- Found Script Editor fully built but inaccessible (no toolbar button)
- Found Dialogue Editor accessible but no toolbar button
- Identified room selection bug
- Identified 2000+ console errors from React/LiveView integration
- Created this improvement plan

**Next:** Implement Phase 1 (add toolbar buttons)
