# Review: c1-equipment, `equipment@1` wear and remove (contract-freeze depth)

- PR: #134, branch `c1-equipment`
- Commit reviewed: `63e866f` (commits `ce81bb7` split, `5f2a4e8` spec, `b04c948` code, schemas and
  fixtures, `ffbad19` command descriptions, `7c2cb5e` docs close, `63e866f` fault corpus seeds).
- Reviewer: fresh Opus, full depth: fresh-world ids, numeric profile, the four schemas, both
  loaders, `rules/equipment.ts`, the listing and the invariant.
- Governing: plan `docs/decisions/owner-decision-chapter-one-plan-2026-10-02.md` §3 slice 5 and
  "Delta ops: reuse, no new op"; the c1-equipment brief and its PM settlement (Q1-Q5 as
  recommended); PM rulings on the developer's deviations (listed under "Deviations" below).
- **Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. Slot holders are minted after every existing kind (character, body, rooms, details, NPCs, items,
   jobs), one per distinct declared slot, in slot-key UTF-8 order, each in the body with capacity 1,
   not in `entities`, so no command targets one and no view lists one.
2. A cartridge without a slotted item (with or without `equipment@1`) keeps every id and its fresh
   state. The 13 existing `cartridge_*_hash.json`, compiled fixtures, traces and transcripts do
   not change.
3. No new delta op, event or refusal code. `wear` is one `entity.transfer` body → holder, `remove`
   is one holder → body, no event. `compose.*`, `proposal.ts` and `containment.ts` are untouched.
4. The refusal order is that of mechanics.md equipment@1: wear `not_found`, `invalid_target`, worn
   `invalid_state`, not in body `not_owned`, no slot `invalid_target`, occupied `invalid_state`;
   remove `not_found`, `invalid_target`, in body `invalid_state`, elsewhere `not_owned`.
5. Wear and remove go through the invocation path (VERBS and TARGETS). The GameView lists wear and
   remove only where step accepts them, and `gameview_agrees_with_admission` checks this.
6. Both kernels: `slot` is a definition part owned by `equipment` (`UNDECLARED_CAPABILITY` without
   the lock) and a closed 12-key enum (`SCHEMA_VIOLATION` for `finger`). `ashmere_wear` compiles to
   the Python known answer.
7. `has_item` still counts a worn item. A worn item's drop and give give `not_owned`, and take
   gives `not_present`.
8. Commit 1 only moves code.

## Check against the list

1. Holds (`fresh.ts:43-45`). I recomputed ids 0-13 in Python from the fixture's IdSource code. The
   holder ids are 11 `f34698e2…`, 12 `15349791…` and 13 `e368b8b9…`, and they equal the test literals.
   The fixture's canonical text and sha256 also match in Python.
2. Holds. No existing hash fixture, compiled fixture, trace or transcript is in the diff. The
   relocked-items test pins ids 0-8 and an equal fresh state. The full Elixir suite (234) and the
   TS suite passed on the head.
3. Holds (`rules/equipment.ts:9-18`). Not in the diff: `compose.*`, `proposal.ts`, `containment.ts`,
   `delta`/`event`/`error` schemas.
4. Holds (`rules/equipment.ts:30-42`, matching `mechanics.md` equipment@1).
5. Holds (`actions.ts` VERBS, `invocation.ts` TARGETS, `action_lists.ts:57-79`,
   `invariants_view.ts:25-34`).
6. Holds. TS `cartridge_refs.ts:65-68` and Elixir `entities.ex:21-26` do this. Loader corpus
   `slot_unlocked` and `slot_finger` have Elixir twins in `content_wear_test.exs`. The TS check is
   truthy (`if (i.slot)`) and the Elixir check is key presence. They cannot differ: I probed a
   null slot and an empty slot, locked and unlocked, and the schema stage rejects all four
   (`SCHEMA_VIOLATION not_in_enum`) before the owner check.
7. Holds (tests in `equipment.test.ts`; `policy.ts` `held` climbs containers).
8. Holds. The 29 lines removed from `decision.ts` are byte-identical to the body of `lookups.ts`
   (one trailing blank line differs), and the other files changed only their imports. No test
   was edited.

## Deviations (verified)

- **No `equipment@1` check in `fresh.ts`.** Holders follow declared slots only, and a slot without
  the lock fails to load in both kernels (`slot_unlocked`; Elixir twin). Mutants that make holders
  for an unslotted lock (all 12 slots) or for any item are both red.
- **No new `composition.json` cases.** The existing frozen cases have the same shapes: base state
  `30…` has capacity 1 and is inside `20…` (a holder in the body). `capacity-across-groups` and
  `capacity-all-or-nothing` give a full holder `capacity_exceeded`.
  `transfer-into-descendant-via-overlay` (`40` into `30`, then `30` into `40`) is a holder moved into
  its worn item, `containment_cycle`. `containment_acyclic` has true cases with nesting. Compose
  sees ids only and does not know about holders, so the existing cases cover these shapes.
- **`equipment.jsonl` transcript.** It follows the feature-map transcript convention
  (`transcripts.test.ts`: replay byte for byte), so by design it is a regression pin, as every
  other transcript is. Correctness is pinned separately by hand literals in `equipment.test.ts`.
  It does not replace an independent answer, so it is not a finding.
- **`faults.test.ts` anchors.** Seed 293 asserts `wait until 3600` → `waited`, clock 3600, and
  `wait until 3599` → `invalid_state` (not later than now, `mechanics.md:209`) at the same
  revision, then `examined`. Seed 88 asserts `ring_bell` lasts 60. I re-derived each value from
  the spec and the fixtures. Git cannot show whether the author derived them by hand first, but
  they are spec-derivable literals, and the comment states the derivation.
- **`red_controls.exs`: equipment → skills.** OK, because `equipment` is now implemented.
- **`content_attributes_test.exs` test for `resources.ex:80`.** Kept per the PM ruling.

## Mutants (throwaway detached worktree, full install; all reverted)

TS (`npm run test:nosim`, plus `test:sim` where noted):

| Mutant | Result |
|---|---|
| holders in ref (insertion) order; in reverse order | red, red |
| holders for all 12 slots whenever `equipment` is locked; an extra holder for unslotted items | red, red |
| wear into an occupied slot accepted (occupied check dropped) | red (code mismatch: compose faults) |
| remove leaves the item in the holder (`[at, at]`); remove ends swapped | red, red |
| wear: `not_owned` branch dropped; already-worn branch dropped | red, red |
| `has_item` direct container only (worn not counted) | red |
| listing: wear listed regardless of `transfer`; inventory filter skips `fits` for wear; worn item lists every entity action | red, red, red |
| invariant wear/remove branch removed | green in `test:nosim`, **red** in `test:sim` (the sim's red control for wear/remove) |
| invariant branch removed + wear listed always | only the view test fails (the invariant is load-bearing) |
| TS loader `slot` part dropped; `TARGETS.wear` dropped | red, red |
| holder capacity 2 | red |
| `equipment` view in reverse order | red |

Elixir: `entities.ex` without the `slot` part is red (`content_wear_test`, `mix test --force`).

Schema mutants (regenerate, `mix test --force`, TS): `SlotKey` without `off_hand` (an examples
check), `wear` without required `item_id`, and `WornSlotView` without required `slot` are red.
`remove` and `WornSlotView` without `additionalProperties: false` are red, rejected by the
schema-subset guard (`schema.ex:57`). A no-op control was green.

## Findings

- **N-1 (nit)** `kernel/ts/src/action_lists.ts:69` and `kernel/ts/src/invariants_view.ts:51` each
  hard-code `['wear', 'remove']`. Failure scenario: a later equipment verb added to one list and
  not the other. The view then lists it without `fits`, or the invariant checks it through the
  generic path, which never flags a listed-but-refused entry. The registry's equipment `commands`
  (`CAPABILITY_OWNERS`) could serve both lists. This is the same pattern as c1-doors N-1
  (`DOOR_VERBS`).

No blocker or should-fix.

## Carry (not a finding of this PR)

- `bin/red_controls.exs` deletes the file at a planted path even when that file is untracked and
  was there before the run. The PM will carry the tooling fix.

## Codex Sol review

Codex Sol review: appended by the PM.

## Codex Sol first review (63e866f), verbatim

CHANGES REQUESTED

```text
C1E-01 | blocker | kernel/ts/src/actions.ts:232
Override remove with a valid ActionDefinition using command=remove, target=entity/inventory, and an always-true policy. Take and wear the cap. Inventory admission requires at===body, excluding the slot holder: GameView hides remove, and its invocation returns unsupported_capability. The cap cannot be removed through this override. Inventory-scoped remove aliases fail identically.

C1E-02 | should-fix | kernel/ts/src/action_lists.ts:55
A loader-valid alias dress with command=wear, target=none, empty input, and an always-true policy appears in GameView.actions as available. Invoking that advertised action without targets returns unsupported_capability because wear requires item_id. The place-action branch bypasses equipment legality filtering, violating the requirement to advertise wear/remove only when legal.
```

## Fix round 1 re-check (e99d104)

Scope: `844c66f..e99d104` (`0ce1ce1`, `e99d104`): the touched code (`actions.ts` `accepts`,
`action_lists.ts` `lists`, `invariants_view.ts`, `rules/equipment.ts` `VERBS`/`wornIn`), its
direct callers (`refusal`/admission, `resolve`, the `of`/`worn` listings, the sim's observation
builders) and the new tests. CI is green on `e99d104`. `test:nosim` and `test:sim` passed
locally.

- **C1E-01 (Sol, blocker): resolved.** `actions.ts:234-235` widens the `inventory` scope to an
  item in one of the body's slot holders, and only for an action that resolves to `remove`. The
  same `wornIn` is used by `equipment.transfer`. The new test drives a cartridge `remove`
  override and a `doff` alias through identify, resolve and step. Both are listed on the worn cap
  and both remove it. Mutant `accepts` without the worn clause: red.
- **C1E-02 (Sol, should-fix): resolved.** `place` excludes actions that resolve to wear or
  remove (`action_lists.ts:56`), and the invariant returns false when the view lists one with the
  place (`invariants_view.ts:29`). Mutants: place filter dropped, red; invariant place check
  dropped, red.
- **N-1: resolved.** `equipment.VERBS` is the single list, imported by `action_lists.ts` and
  `invariants_view.ts`.
- **`resolves = {}` default: OK.** `sim.test.ts:79` builds an observation without `resolves`, and
  the place check now runs on every command. In production, `sim.ts` passes `resolves`.
- **Test re-hash via `canonical.encode`: OK.** It hashes only the input artifact. The expected
  values are still Python literals.
- **Earlier mutants rerun:** holder order, all 12 slots when locked, occupied slot accepted,
  remove no-op or swapped, `not_owned` and already-worn branches, `has_item` direct-only, the
  three listing mutants and `TARGETS.wear` are all red.
- **N-2 (nit, new code)** `kernel/ts/src/actions.ts:235`: the `a.command === 'remove'` guard
  survives a mutant (`wornIn` for any command; suite green). Failure scenario: a cartridge alias
  of `drop` (or `give`, or `wear`) with an `inventory` target, invoked on a worn item. The spec
  (protocol.md ActionSet) gives `unsupported_capability` at admission. The mutant gives
  `not_owned`/`invalid_state` from the rule instead. Nothing moves either way, so only the
  refusal code is unpinned.
- **PM carries noted (LATER, next slice's ROADMAP edit):** targetless take/drop/give aliases, and
  typed text that cannot name a worn item.

**Verdict after fix round 1: APPROVE** (N-2 is a nit only, not blocking).

## Codex Sol fix round 1 re-check (e99d104), verbatim

APPROVE

```text
no findings
```
