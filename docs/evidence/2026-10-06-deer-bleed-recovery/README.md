# Deer recovery after an interleaved bleed/round receipt

Developer evidence and self-review; independent approval remains required.
Base: published main `87ac4cbb`. Branch: `fix/deer-recovery-bleed`.
Source checkpoint `96f6bab1`; test typing correction `377b8e8b`; merged published
main `10dd1374` without rebasing at candidate `dc6ab907`.
Contract: [D7 and C5 recovery](../../system/save.md#d7-deer-recovery-planning-contract).
No cartridge, release/API, row shape, commit path or kernel mechanic changes.

## Reproduction

A real temporary SQLite save plays the current compiled chapter with synthetic
context/host IDs and seed `[1,2,3,4]`: Fey-touched, south/south/east to Hound Run,
elapsed to 67950, Attack the current hound, settle 68100/68200/68250/68300.
Cold reopen at 68300 succeeds. The accepted 68400 receipt resumes round group 5
for the paired bleed after unrelated crow/hound/deer population groups 6–8.
The old deer group detector then refuses cold reopen as `save_corrupt`.
The new regression reproduces that refusal on the old code and passes after the
fix, with clock 68400, HP 8 and 11 receipts. These are hand-checked literal answers.
All storage is Node SQLite's default rollback journal in newly created temporary
files, removed by their tests. No owner save, device or native session was used.

## Smallest sound fix and call-path proof

Deleted the redundant global descending-group detector and its accumulated
population exception from `deer-save.ts`. Retained the deer-specific exact sight
job/occurrence/member/transfer and cause checks.

`receiptRecovery` calls `liquidSave` before `deerSave`. The former always calls
`receiptHistory` when `fresh.populationSpecs` is nonempty. Fresh-world construction
maps every authored population into that table; any loadable sight release has a
population. Exact ordered replay recomputes the complete accepted decision and
compares it, including every writer group, then compares saved state. No affected
production caller bypasses that proof. The direct test call to `deerSave` exercises
its retained sight-cause validation rather than whole-save recovery.

Adding another bleed-pair exception would duplicate the composing kernel again
and leave mixed mechanic ordering vulnerable to another false rejection. This
change instead reuses the existing authoritative replay with no new machinery.
The per-action changed-row transaction is untouched; cold-open replay cost is
unchanged.

## Regressions and live controls

- Old focused deer/C5 authority suite: 10 passing, including genuine failed COMMIT,
  uncertain absent/committed settlement, replay and retained sight-cause refusal.
- New lawful interleaving test: old detector fails; fixed code passes.
- Actual saved bleed and unrelated population groups changed to group 0: typed
  `save_corrupt`, saved file bytes unchanged.
- Real continuation flees to Reed Bank, moves west to Willow Shade, attacks the deer,
  and settles through 68700. Its receipt combines bleed expiry, deer round and sight
  cancellation; changing only that cancellation group refuses with unchanged bytes.
- Existing real surviving-round/sight-flight witness extended with forged
  closure/successor-cancel groups: typed refusal, saved file bytes unchanged.
- A live mutant that makes exact replay ignore only `writer_group` keeps the old
  10 focused tests green, but all four new corruption checks fail. Restoring exact
  replay restores the final focused 14/14 result.

## Self-review

Ponytail review: removed 99 lines of global reconstruction instead of introducing
another exception; no dependencies, new production helper or fallback path.
Correctness review traced fresh-world population construction, recovery ordering,
exact receipt/state replay and the retained deer producer checks. Corruption
checks use actual persisted accepted receipts and compare whole file bytes after
cold refusal. Test expectations are independent literals; no mock storage or
source-text matching is used. Full local gate includes the headless simulator;
the final merged candidate `dc6ab907` passed `bin/check_all.sh` (exit 0),
including 401 Elixir tests, full TypeScript checks/tests, the headless simulator
and gate red controls. The first broad run timed out in two
unchanged compiler-copy tests during a concurrent broad run (399/401 passed); the
immediate retry was interrupted on PM instruction. Both logs are retained; no
timeout was changed. The uncontended retry passed 401 Elixir tests and guards,
then rejected the new test’s unchecked Json response access. Explicit
`DecisionResult` casts corrected that test-only issue; full typecheck and the
merged focused suite pass. The final full gate ran after that correction and the
main merge. Native/mobile remains paused.

## Commands

```sh
mise exec -- node --test mobile/authority/local-story/deer.test.ts mobile/authority/local-story/deer_bleed_recovery.test.ts mobile/authority/local-story/c5_bleed.test.ts
mise exec -- npm --prefix kernel/ts run typecheck
mise exec -- bin/check_all.sh
```

The temporary replay mutant changed only the equality comparison to normalize
all `writer_group` values to zero on both decision trees. It was removed before
all restored checks. The legal reopen red control restored the deleted global
group detector. No mutant is retained in production.
