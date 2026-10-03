# Review: c1-doors, per-exit door actions and sight lines (need #12, Q-3, owner Q3)

- PR: #132, branch `c1-doors`
- Commit reviewed: `b1fe931` (commits `393f6cb` split, `d92a83d` spec, `1a0926b` code, schema
  and tests, `b1fe931` ponytail shrink).
- Reviewer: fresh Opus. Full depth on `view.ts`, `action_lists.ts`, `rules/barrier.ts`,
  `invariants_view.ts`, the schema and the spec commit.
- Governing: plan `docs/decisions/owner-decision-chapter-one-plan-2026-10-02.md` §3 slice 4,
  triage 17/19, §6 (sight in the GameView room in every view); the c1-doors brief and the PM
  settlement (Q1-Q5 as recommended).
- **Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. Every exit with a barrier carries `door {name, state, actions}`, passable or not; no barrier,
   no `door`.
2. `door.actions` is exactly the door verbs `step` would accept on that exit now: admission
   (`refusal`, so a room `subtract` or a cartridge policy) and barrier@1's checks (state, key).
   Order: priority, then key. All available.
3. The four door verbs never appear in the place `actions`; the ActionSet, `refusal` and `step`
   are unchanged.
4. `sight` is present iff `passage` lets you through (not `fare`); its content is
   `movement.sight`'s: destination id, title, NPCs and items directly in it, NPCs first, then
   DefinitionRefString order.
5. Each face of a shared door shows its own `door` on its own exit; a transition on one face shows
   on the other.
6. One legality check, shared by the rule and the view, so they cannot diverge.
7. `gameview_agrees_with_admission` sees a listed-but-refused or accepted-but-unlisted door verb.
8. No trace, transcript, hash fixture, outcome or state hash changes; commit 1 moves code only.
9. Schema: `door`/`sight` optional on both ExitView branches; every mutant of DoorView, SightView
   and its entity item fails a new named case or the subset check.
10. The spec commit precedes code and names each clause it amends.

## Check against the list

1. Holds (`view.ts:73-102`).
2. Holds. `action_lists.ts:61-68` `usable` runs `refusal(world, payload, steps, a.key)` then
   `barrier.transition`; the listing goes through the same `listed` sort.
3. Holds (`action_lists.ts:52`, `!door(a)`); `refusal`/`step` untouched.
4. Holds. `exits` maps over `movement.sight` (unchanged); `sight` follows `seen.entities`, which
   is absent exactly when `passage` bars. Order: `world.entities` is built NPCs first, then ref
   order (`fresh.ts` `place`), the same order `within` uses; no sort needed.
5. Holds (gate oak door both faces; Lantern `old_gate` landing/shelter).
6. Holds. `barrier.ts:48` `transition` is the body of `decide`, returning the code; `decide`
   wraps it. Same code order as before.
7. Holds, with the shape noted in Q-1.
8. Holds. No file under `cartridges/`, `protocol/fixtures/` (other than four new
   `invalid.json` cases), `lantern-traces.json`, `lib/`, `test/loka/` or `mobile/` changed.
   `393f6cb` edits no test; kernel suite green there (315 pass); the moved lines differ from the
   removed ones only in indentation and imports.
9. Holds (sample below).
10. Holds (`d92a83d`: 04 §15 amendment, protocol.md ActionSet and GameView, mechanics.md
    movement@1 and barrier@1).

## Runs

- `bin/check_all.sh` at `b1fe931`: exit 0 (mobile typecheck and tests included).
- Code mutants (throwaway detached worktree, full install), all red:

| Mutant | Fails |
| --- | --- |
| `usable` skips `barrier.transition` (verb listed when refused) | 7, incl. sim 500 sequences |
| `usable` checks state only via a view-side `MOVES` lookup (rule and view diverge, no key) | 6, incl. sim |
| `movement.sight` ignores `passage` (sight through a closed door) | 4 |
| `door` only on the first face found across rooms (shared door listed once) | 5, incl. sim |
| door verbs left in place `actions` | 1 |
| `refusal` skipped in `usable` | 1 (the policy-override case only; see note) |
| invariant door branch `return true` | 1 (sim red control) |
| `sight` gated on `fare` | 2 |
| `door` omitted when open | 5, incl. sim |
| sight entities reversed | 1 |

  Note: the developer's "extra" policy-override test is the only kill for "refusal skipped";
  the subtract case removes the verb from the set before listing. The deviation is load-bearing.
- Schema mutants (Elixir `contracts_test.exs`), all red: DoorView `name` dropped from
  `required`; sight entity `kind` dropped from `required`; ExitView unavailable branch `sight`
  removed; DoorView and sight-entity `additionalProperties` removed (rejected by the subset check).

## Findings

- **F-1 should-fix: moved `view.ts` pointers left stale.** `docs/system/protocol.md:167` cites
  `view.ts:36` (a doc-comment line; `gameView` is `:38`); `docs/system/protocol.md:184` cites
  `view.ts:107`, `:126` (the journal filter and a band row; `BANDS` is `:114`, `resources` `:133`);
  `docs/world-parameters.md:35` W13 cites `view.ts:107 (used :131)` (should be `:114`, used
  `:138`). `check_docs` cannot see a line that moved inside the file; the brief required every
  moved pointer to be re-derived. A reader following them lands on unrelated code.
- **F-2 should-fix (PM, open item): the alias false-trip carry is recorded nowhere.**
  `kernel/ts/src/invariants_view.ts:19` matches `a.action_key === type`. A cartridge action
  `unbar` with command `unlock` is listed as `unbar` on the exit; the accepted `unlock` command
  finds no `unlock` entry, so the check returns `decision.kind !== 'accepted'` = false and the
  invariant trips on a correct step. The PM ruled "accept now, LATER with the alias carry
  (trigger: first cartridge action alias)", but neither `docs/ROADMAP.md` nor the plan (triage
  row 28 covers only the host trace) mentions it; only the PR body does. The PM adds it to the
  ROADMAP / row 28 carry.
- **N-1 nit:** `invariants_view.ts:37` `DOOR_VERBS` and `test/sim.ts:316` restate
  `barrier.MOVES`' keys. A verb added to `MOVES` would be listed per exit but fall into the
  non-door branch, where `advertised` finds no place entry and returns true, unchecked.
  `Object.hasOwn(MOVES, type)` (as `action_lists.ts` does) removes the copy.

## Questions

- **Q-1 (PM):** the invariant is "listed → never refused with a door code (not `not_found`/
  `permission_denied`); unlisted → never accepted", not the brief's literal "iff accepted". Every
  refusal code the actor's own door command can get from `refusal` or `transition` is in
  `DOOR_CODES`, so I found no failing scenario; the spec text (protocol.md:188-190) states the
  implemented shape. Accept as written?

## Emergence

`action_lists.ts` and `view.ts` name barrier@1 and its verbs, and `invariants_view.ts` names the
door verbs: required by the spec (Q2-Q4, 04 §15 as amended), not a finding. The PR's composes-with
statement holds: room `subtract`, cartridge overrides and policies narrow the per-exit list
through the unchanged ActionSet and `refusal`.

## Developer-declared deviations

world-parameters.md pointer edits (accepted; W13 wrong, F-1); generator 5 to 6 (forced by Q2,
accepted); the policy-override test (accepted, load-bearing); stale `contracts.gen.ts` pointers
fixed (verified `:359`-`:361`); the dated quest-from-dialogue record left unchanged (accepted:
dated records are not re-pointed).

Codex Sol review: appended by the PM.
