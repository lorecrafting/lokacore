# Review: toolbox row G7, access locks (loka-kgd.123)

- Branch `toolbox/m11-locks`, head `97e34d385af7b3c7585c0aede292713690a22808`, diffed against `a43968d8` (`toolbox/batch-m11`). No PR (batch model). Installed `kernel_api` 1.77 to 1.78.
- Governing: [Access locks](../system/mechanics.md#access-locks-toolbox-row-g7) and [declarations](../system/cartridge.md#access-lock-declarations) (added here), [containment@1](../system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets), [barrier@1](../system/mechanics.md#barrier1-kerneltssrcmechanicsbarrierrulets), [composition](../system/architecture.md#building-mechanics-by-composition), [contract lessons](../lessons/contracts.md), Beads `loka-kgd.123` (brief). PM rulings (not findings): put locks cover nested containers (fix round); taking a container whose contents carry `get` locks is a stated known limit; locks gate the player only (W26).
- Hosted CI on the head: `book-e2e` success, `ci` **failure** (`elixir`, `mobile` jobs; base `a43968d8` green).
- Verdict: **CHANGES REQUIRED** (two blockers: CI red).
- Written 2026-10-13 UTC in Claude Code by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Three `locks` objects in the schema (exit `traverse`, room `enter`, item `get`/`put`), no empty map or stray key; a `put` lock only on `container: true` (SCHEMA_VIOLATION `invalid_value`, both kernels).
2. `movementPlan`: exit `traverse`, then destination `enter`, after `passage` (not_found, exit_closed/locked first); Move, Flee and the GameView's exits share it.
3. Take: one helper called by the rule and `takeAdmission`, after `reach`, before carrying; walks the item then each container item, one step per edge; target is the item carrying the lock.
4. Put: the destination's `put` lock in `putRefused`, after the lid, before capacity; rule and view pairs share it.
5. Lock roots join the reference walk in both kernels (UNRESOLVED_REFERENCE, short refs expand); TS refuses `subject: "target"` under room/exit locks only.
6. 1.78 floor for any lock, both kernels; no other cartridge changes bytes; no new error code, event, op or save row.

## Proof

- Green locally at head: `node --test` access_locks, scoped_facts, put, containment, exit_admission, hidden_passage, barriers, validate (62/62); `mix test` content_access_locks, content_scoped_facts, core/contracts (11/11).
- Red locally at head: `mix test test/loka/content_rooms_test.exs` (16/17), `node --test mobile/authority/local-story/carrying-reach.test.ts` (4/5); both match CI.
- Mutants (separate detached worktree, restored each time; TS `node --test`, Elixir `mix test --force`):
  - killed: enter lock read at `here` (2 fail); `takeAdmission` without `getRefused` (guest test fails); Elixir floor `[1, 77]` (0/1); Elixir item lock roots dropped from `Entities.roots` (0/1).
  - survived: see findings 3, 4.
- Schema sweep on the three `locks` objects: dropping `required` (room, exit) and `requiredUnless` (item) each fails `validate.test.ts`; dropping `type`, `additionalProperties` or a `$ref` leaves the schema subset (`elixir bin/contracts.exs` refuses), so no fixture is needed for them.
- Hand-checked: `containment.test.ts` 11 charges (reach edge, one get-walk node for the satchel in the room, ancestry row, five index rows, three nodes); 32757 + 11 = 32768 (`query_steps`, accepted), 32758 + 11 faults. Acceptance a to g literals match the brief.

## Findings

1. **blocker** `lib/loka/content/locks.ex:32`: `locked?/1` matches room entries with `fn {_, {_, _, r}} ->`, but a schema-invalid room is `{key, :invalid}`. Scenario: `test/loka/content_rooms_test.exs:145` (a room with exit `northeast`) crashes the compiler with FunctionClauseError instead of returning its three diagnostics; any author typo in a room crashes `mix loka.compile`. Fix: match the room entry as the item clause does (`match?`/a generator pattern), plus that test stays the red control.
2. **blocker** `mobile/authority/local-story/carrying-reach.test.ts:164`: the get walk adds one view query step per take offer, so with 32769 items `ids[0]`'s take is no longer available. CI `ci/mobile` fails. Fix: re-derive this test's literals by hand for two charges per take, as was done in `kernel/ts/test/containment.test.ts:441`.
3. **should-fix** `kernel/ts/test/access_locks.test.ts:165-216`: acceptance g's positive case ("the same leaf in chest's get lock loads") is missing. Mutant: `'items'` added to `TARGETLESS` (`cartridge_scoped_facts.ts:24`) stays green (11/11 with scoped_facts). Scenario: an item lock using `subject: "target"`, the spec's own example of a valid item lock, is refused FACT_SCOPE_UNSUPPORTED. Fix: one row that sets the chest `get` root to the targeted leaf and expects `'loaded'`.
4. **should-fix** `kernel/ts/src/mechanics/locks.ts:34`: the lock target is unpinned. Mutant: `held.locks?.get, item, steps` (target = the taken item, not the container carrying the lock) stays green (6/6). Scenario: a chest lock `fact_compare {subject: "target", ...}` reads the ring's row and admits or refuses the wrong actor. Fix: a runtime case where a container lock reads `subject: "target"` and the container's and item's rows differ.
5. **should-fix** `test/loka/content_access_locks_test.exs:22`: the Elixir floor's exit branch (`lib/loka/content/locks.ex:34`) is untested. Mutant: `locked?` without the exit clause stays green (the sampler also has room and item locks). Scenario: an exit-only lock at 1.77 compiles, then the TS loader rejects the artifact (KERNEL_API_RANGE_INVALID). Fix: a floor row with only the lane east lock (hut and chest locks removed).

## Open PM items (not findings)

- Ruling 1 (put lock covers nested containers): absent at the head; `putRefused` reads only the destination's own `put` lock (`containment/shared.ts:213`).
- Ruling 2 (take of a container whose contents carry `get` locks): not yet in the Known limits bullet (`docs/system/mechanics.md`, Access locks).

## Departures

1. Test names `access_locks.test.ts` and `content_access_locks_test.exs`: accepted.
2. `required`/`requiredUnless` instead of `minProperties`: accepted; the sweep kills both.
3. `putRefused` and `takeAdmission` read `world.character`: accepted; the brief offers it, the view is the player's, and the take rule uses `p.actor_id`; W26 changes `putRefused` (inline comment).
4. `containment.test.ts` 11 charges and thresholds 32757/32758: accepted, hand-checked above; its mobile twin is finding 2.
5. `locks.ts` in the `ts-rule-module-imports` allowlist, with a valid lint case: accepted.
6. Containment `decide` size allowance 52 to 54: accepted.
7. `exits.ex` expands `locks` short references: accepted; the Elixir test asserts the expanded `npc` on the exit, room and item locks.
8. Book bullet: a refused put pair is not offered (`putPairs`, `view/action_lists.ts:273`): accepted, matches the code.
