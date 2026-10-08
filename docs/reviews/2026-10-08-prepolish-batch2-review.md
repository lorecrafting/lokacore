# Review: pre-polish batch 2 (code fixes)

- Branch: local `fix/prepolish-code` (not pushed, no PR); range `e38af110..5fffbaa3`
- Commit reviewed: `5fffbaa3`
- Brief: `br show loka-v9q` note "BRIEF pre-polish code fixes" plus PM rulings (loka-b60 deferred;
  loka-jk0 narrow). Issues loka-374, loka-w2e, loka-b19, loka-w4b, loka-bem, loka-soq D3, loka-nnu, loka-jk0.
- Governing: [book-ui recovery](../system/book-ui.md#chapters-scenes-and-recovery),
  [D11](../system/book-ui.md#d11-character-choice-interaction),
  [numeric profile](../spec/conformance/numeric-profile.md) Encoding, [cartridge.md](../system/cartridge.md) night
  window (`[20,6)` wrapping), [save.md](../system/save.md) "The save file"; AGENTS.md "Writing tests".
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. loka-bem: a pending ancestry choice keeps its buttons pressable, shows "save not confirmed",
   claims no selection, and a later press retries the original invocation.
2. loka-soq D3: the fault reason is not inside the Start over button's label.
3. loka-w2e: Map/Set/Date/typed arrays encode as `invalid_canonical`; plain and null-prototype
   objects still encode (node:sqlite rows are null-prototype).
4. loka-b19: both loaders refuse `night_end >= night_start`; every shipped plan (20->6) still loads.
5. loka-374: literal Elixir rows; each refusal row fails on its own clause; TS and Elixir
   invariant replay agree; `invariants.ex` fits its allowance.
6. loka-w4b / loka-jk0: each new test is red on the audit's mutant.
7. No existing frozen fixture or save byte changes; loka-nnu pointers land on the cited code.

## Checks

- Baseline: kernel `test:nosim`, `mobile/app npm test`, `mix test test/loka/core
  test/loka/cartridge_cross_kernel_test.exs` and the content test: all exit 0.
- `protocol/fixtures/expedition.json` is new; no other `protocol/` file changed. All 65 fixture
  night windows (`protocol/fixtures/*.json`) and every `cartridges/` plan are 20->6. No `new Map`/`Object.create`
  in kernel or mobile source. `invariants.ex` is 343 lines, allowance 343. Elixir `initial/2`
  returns nil for a missing row, same as TS `?? null` (`invariants_delta.ts:41`).
- Pointers checked line by line: `authority.ts:37,:179,:232`, `session.ts:236` (Start over doc
  comment), `decision.ts:244`, `cartridge.ts:63,:135,:196`, `cartridge_refs.ts:167`,
  `cartridge_installed.ts:24`, `cartridge_cross_kernel_test.exs:169`, `future.md#production-story-app`.
- Fixture success rows: hand-checked by reading them (value equals op value; cursor +1, shelter once, fail resets).
- Mutants (code restored after each; worktree clean), all red unless noted:
  compose_expedition.ex:8 `if true and true`; invariants.ex `initial` reads `bleeds`;
  population.ex `<`->`<=`; cartridge_population.ts `<`->`<=`; canonical.ts check only `Map`;
  movement/shared.ts:47 drops the item-kind test; sections.tsx hides buttons while pending;
  liquid-save.ts skips `receiptHistory`; Book.tsx fault text back inside the Pressable;
  sheltered? drops `before.sheltered == false`; failed->active drops the attempt check; TS
  compose_expedition.ts `lifecycle` -> `true` (red in the compose differential).
  **Survived**: compose_expedition.ex:8 without `after_row["quest_instance_id"] == op["quest_instance_id"]`
  (all of test/loka/core and cross-kernel green).

## Findings

1. **should-fix**: `protocol/fixtures/expedition.json`, case "value bound to another quest instance".
   The row has a non-nil prior row, so the identity `Map.take` check (`compose_expedition.ex:17`)
   refuses it, not the instance clause at `:8`. Failure: with that clause deleted, Elixir accepts
   a start (prior nil) whose value names quest instance B under target A, and no test fails.
   Fix: give that row (or an added row) a nil prior with `expected: null`.
2. **nit**: `test/loka/core/compose_test.exs:1`: the allowance was raised to 525 for expedition rows,
   but the reason does not name expedition.
3. **nit**: `cartridge_population.ts:89`, `population.ex:70`: a night-window refusal reports
   the `.wander_interval` path. The author is sent to the wrong field. This follows the existing grouped-period convention.
4. **nit**: no PR exists yet, so there is no `/code-review medium` report to check. Carry it into the PR body.
5. **question**: `save.md:132` says "clock or revision". Only clock rollback is tested in this
   batch. Revision is enforced at `receipt-history.ts:30,:41`, and no test changed here forges it.

## Fix round 1 re-check (`5fffbaa3..18dc34a7`, one commit)

- Verdict: **APPROVE**
- F1 fixed: in `protocol/fixtures/expedition.json`, the case is now "start bound to another quest instance".
  It has no prior row, `expected: null`, and value `cursor 0`, unsheltered, active, so it is a legal start
  except for the instance. Re-planted mutant (the instance clause deleted at `compose_expedition.ex:8`):
  `expedition_test` and the compose differential fail. Baseline at `18dc34a7`: both files pass.
- F2 fixed: the reason at `test/loka/core/compose_test.exs:1` now names expedition rows. The file is
  525 lines and the allowance is 525.
- Q5 settled: `save.md:132` is narrowed to the head clock, which matches the owner ruling. The sentence
  cites `head_rollback.test.ts`. A revision behind the head is also refused at `expedition-receipt.ts:35-36`
  (`r.revision < last || r.revision > head`), so the narrowing is accurate.
- Nits 3 and 4 are unchanged: the diagnostic path follows the existing convention, and the
  `/code-review medium` result goes in the PR body. No new findings.
