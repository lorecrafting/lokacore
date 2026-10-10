# Review: time windows, hour and moon gates, toolbox row 10 (loka-kgd.27)

- Local branch `toolbox/m4-time`, head `31a7644c4267c479d39cf501b1b257f415e5b61a`, diff `origin/toolbox/batch-m4...31a7644c` (29 files); no PR yet (batch M4). Protocol change (policy and room schemas, registry, invalid fixtures, kernel_api 1.45), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row 10, slice process, traps](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [G1 leaf-set rule](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), [mechanics.md row 10](../system/mechanics.md#time-windows-hour-and-moon-gates-toolbox-row-10), [CHECKS.md size](../CHECKS.md), brief in Beads `loka-kgd.27`.
- Hosted CI on the head: ci and book-e2e, both success (`gh run list --commit 31a7644c...`).
- Verdict: **CHANGES REQUIRED** (three surviving mutants).

## Must be true

1. A door opens only inside its authored hour window or moon phase; the dev clock proves both sides of each edge.
2. The phase is derived from the clock, never stored (trap 1); `status()` shows the same phase as before.
3. Only `open` is gated, after the state checks (a locked door stays `exit_locked`); close, lock and unlock are unaffected, and an open door can still be closed outside the window.
4. The new leaf follows G1: one `holds()` case, a registry owner, schema branch with invalid fixtures, reference-table entries only when it names a definition, and the parity test still holds.
5. Both kernels check `opens_when` like any policy root (owners, references, windows), refuse an unknown phase, and refuse either new field below kernel_api 1.45.
6. Opt-in: Chapter 1 and corpus bytes unchanged.

## Proof

- Baseline: `time_windows`, `tags`, `calendar`, `barriers` tests and `content_time_test.exs` pass.
- Killed: M2 phase lookup `cut.at < at` (`calendar.ts`); M3 lunar time without `mod period`. Both back the `status()` extraction being equivalent.
- Survived: M1 gate on every verb (`rule.ts:93` without `type === 'open'`); M4 TS floor without `leaves.length > 0` (`cartridge_calendar.ts`); M5 Elixir floor without `leaves != [] or` (`calendar.ex`); M6 gate moved above the `from !== need` state check.
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` byte-identical at base and head (sha1 `ee93f779`). No corpus file in the diff.
- `invalid.json`: additions only. No frozen answer touched.
- Bypass: `rule.ts` is the only producer of `barrier.transition` (`git grep`), and `view/action_lists.ts:255` calls `transition`, so NPC or reaction opens and the GameView Open verb all pass the gate.
- Parity: `tags.test.ts:122-134` keeps only branches with DefinitionRef fields, and G1 adds table entries "when it names a definition"; `sky` with no entry is allowed and still covered (a later ref field fails the test).
- Cites rerun: `rule.ts:93` and `action_lists.ts:255` match.

## Findings

1. **blocker**, `kernel/ts/test/time_windows.test.ts:53-80`: the comment claims it breaks on "the gate also refusing close", but `close` runs at 1000, inside the window, so M1 stays green; the spec's "an open barrier stays open and closes after the window" is never exercised. Failure: a gate on close ships, and a door opened at full moon cannot be closed at new moon. Fix: open at 1000, `wait(2000)`, close, expect `closed`.
2. **blocker**, same test: no locked gated door, so M6 stays green. Failure: a locked moon door out of its window answers `invalid_state` instead of `exit_locked`, contrary to `mechanics.md` row 10 "after the state checks". Fix: one locked gated door (or a lock step) refused `exit_locked` outside the window.
3. **blocker**, `time_windows.test.ts:132` and `test/loka/content_time_test.exs:28`: the 1.44 rows run on the sampler, whose barriers carry `opens_when`, so a `sky` leaf alone (a variant, no gate) is never floor-checked; M4 and M5 stay green. Failure: a cartridge with a `sky` variant at 1.44 loads on an older kernel that lacks the leaf. Fix: one row per kernel with `opens_when` removed and the variant kept.
4. **should-fix**, `kernel/ts/src/content/cartridge_refs.ts:1`: `size: allow 336` raised to 340. `docs/CHECKS.md:47-49`: an existing source allowance is never raised; the file splits (the G1 raise is not a licence). Fix: move `nodes()` or `LEAF_REFS` to its own module.
5. **should-fix**, `docs/system/mechanics.md:1810` (leaf naming): `sky` fits none of the patterns (`has_<x>`, `<x>_state`, `<x>_compare`, `<x>_count`, adjective). Row 31 already commits to `sky`, so extend the rule text by one clause (a derived-environment leaf named for what it reads) rather than rename.

## Brief questions

- One phase per leaf, several via `any`: fine; row 31 adds alternative fields.
- Opened door stays open after the window: acceptable and documented; the spec says "opens only", not "is open only".
- `status()` unchanged: yes (M2, M3 killed; Chapter 1 bytes equal).
- kernel_api 1.45 shared with row 11: not a finding.

## Re-check, fix round 1 (head `1702cb62d80f0ced64b58b30906776a12c7c79a3`)

Scope: commits `212aec88` and `1702cb62` only. Hosted ci and book-e2e both success on the head. Focused tests pass (`time_windows`, `tags`, `calendar`, `barriers`, `content_time_test.exs`).

- B1 fixed: the door opens at 1000, closes at 2000 (`closed`), and is then refused (`invalid_state`). M1 (gate on every verb) now fails.
- B2 fixed: a locked moon door at clock 0 answers `exit_locked` (`time_windows.test.ts:86-91`). M6 (gate above the state check) now fails at line 91.
- B3 fixed: in each kernel, one row keeps only the sky variant and one keeps only `opens_when`, both at 1.44. M4 (TS) and M5 (Elixir, assertion at `content_time_test.exs:46`) now fail.
- SF4 fixed: `LEAF_REFS` moved to `cartridge_leaf_refs.ts`. `cartridge_refs.ts` is 328 lines with its allowance back at 336 (not raised), and `check_ts_size.mjs` passes. All importers are updated (`cartridge_refs.ts:14`, `tags.test.ts:16`); `leaf_refs.ex` and `mechanics.md:1812` cite the new path.
- SF5 fixed: `mechanics.md:1810` now names environment leaves with a noun (`sky`) whose fields name what is read.

Verdict: **APPROVE**.
