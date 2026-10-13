# Plan: Implement Touch Recipient Selection for `Give` Action

- **Issue:** `loka-x6t.31` (Parent: `loka-x6t` Storybook long-haul tweaking)
- **Status:** Draft for Review via Plannotator
- **Scope:** `mobile/app/book/buttons.ts`, `mobile/app/book/presenter.ts`, and test coverage

---

## 1. Problem Statement & Root Cause

In the Book touch interface, `Give` is completely disabled:
```ts
// mobile/app/book/buttons.ts:146
return projected.flatMap((e) =>
  e.actions
    .filter((a) => a.available && a.action_key !== 'give') // ponytail: Give waits for a touch recipient selector
```

Because `presenter.ts:145` guards:
```ts
if (!game.pending() && b.action_key === 'give' && b.target_ids.length !== 2) return '';
```
The engine requires a 2-tuple `target_ids: [itemId, recipientId]`. 
Since `buttons.ts` has no recipient selector, `give` was filtered out entirely.

### Consequence
In the Chapter 1 / Showcase playtest:
- The player holding the apple cannot give it to Nell.
- The player holding the Warden ledger cannot give it to Reeve to mend karma (social 18b).
- The signpost prompt ("give someone the apple") is unplayable.

---

## 2. Options Considered

### Option A: Direct Button Generation for Present NPCs (Recommended — Ponytail)
When looking at an item in detail/held view, for every NPC in the current room (`v.entities.filter(e => e.kind === 'npc')`), generate a paired action:
- Button label: `Give [item] to [NPC Name]`
- Action payload: `{ ...a, target_ids: [item.id, npc.id] }`
- **Pros:** 
  - Zero new UI components, modals, or picker state.
  - Reuses existing `button()` formatting (like `pour into [target]` and `refuel from [target]`).
  - Follows Ponytail: smallest working diff (under 15 lines of code in `buttons.ts`).
  - Works instantly on both mobile touch and Storybook web preview.
- **Cons:** If 10 NPCs were in the room, it would generate 10 buttons (in practice, rooms have 1–3 named NPCs).

### Option B: Two-Step Modal / Detail Drilldown
Tapping `Give [item]` transitions the detail view into a "Select Recipient" page listing NPCs.
- **Pros:** Scales cleanly to large crowds.
- **Cons:** Requires a new presenter screen state (`s.detail = 'give_recipient'`), back button handling, and extra boilerplate. Violates Ponytail YAGNI for current Chapter 1 needs.

### Option C: Inverted "Gift" Action on NPC Pages
Offer `Give [item]...` on the NPC's detail page, listing held inventory items.
- **Pros:** Intuitive from social perspective.
- **Cons:** Engine actions originate from the item's `actions` array (`e.actions` on the item entity), not from the NPC entity.

---

## 3. Recommended Implementation (Option A)

1. **In `mobile/app/book/buttons.ts` (`heldButtons`):**
   - Identify present NPCs: `const npcs = v.entities?.filter((e) => e.kind === 'npc') ?? [];`
   - For `a.action_key === 'give'`:
     - If no NPCs present: do not offer `give`.
     - For each NPC: emit a button with `target_ids: [e.id, npc.id]` and label `Give ${text(e.name)} to ${text(npc.name)}`.
   - Remove the blanket `.filter((a) => a.action_key !== 'give')`.

2. **Format consistency:**
   - Match the existing pattern in `buttons.ts:149`:
     ```ts
     const destination = a.target_ids?.[1] && names.get(a.target_ids[1]);
     ```

3. **Validation & Edge Cases:**
   - Check NPC availability / conscious state (dead/asleep if gated by engine).
   - Verify `presenter.ts:145` guard passes cleanly when `b.target_ids.length === 2`.

---

## 4. Test Strategy

1. **Break Test in `mobile/app/book/polish_detail.test.ts`:**
   - Name the break: *Held item detail fails to offer Give button when an NPC is present in the room.*
   - Test flow:
     - Player at Well Lane with Nell (NPC).
     - Pick up an item (brass lantern or apple).
     - Open item detail view.
     - Assert button `'Give a brass lantern to Nell'` exists and has `target_ids: [item.id, npc.id]`.
     - Tap button -> verify inventory empty, item transferred, token advanced.

2. **Regression Check:**
   - When no NPCs are in room (e.g., North of Well Lane), verify no incomplete `Give` button is offered.

---

## 5. Review Checklist for Plannotator
- [ ] Is Option A acceptable or does the designer want a dedicated recipient modal?
- [ ] Label phrasing: `"Give <item> to <npc>"` vs `"Offer <item> to <npc>"`.
- [ ] Should giving a quest item trigger an immediate scene transition if configured by the cartridge?
