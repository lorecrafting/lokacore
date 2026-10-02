# Review: R6P P6 rerun — 0 MV words and device rows on the untimed Lantern

- PR: #112, branch `r6p-rerun`, commit reviewed `035f444` (commits 73927a1, 035f444); build on the phone 73927a1
- Reviewer: Opus (independent); a codex Sol review runs separately (the PM appends it)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before reading the diff)

Part 1 (brief; owner note):
1. Every path that shows a refused move at 0 MV gives `You are too exhausted.` as the log line, and the
   closed-exit note reads as words, not the code `insufficient resource`.
2. One test with a hand-written literal fails without the fix.

Part 2 (pre-release-proof.md:82-88, envelope §4-5, brief):
3. The Node expected bytes come from the build SHA, where the frozen Lantern traces pass; CI is green there.
4. Every Hermes record equals the Node bytes; the planted flip and the on-device mutant go red with bytes.
5. Row 10 still proves a lost-response retry replays the original outcome after the choice is gone
   (an intervening commit, the choice no longer offered: a new id is rejected).
6. The largest seed count keeps the bundled data ≤ 2,000,000 bytes, and the next does not.
7. Row 6 loads the Lantern known answer with hash `9b096943…` (full hash stated).
8. Owner saves byte-identical before and after; no UDID, device name, team, container id or path;
   every evidence file hashed; P6b's hashed files untouched.

## Checks

- 1: refusal paths at 0 MV. `view.ts:55` marks the exit unavailable `insufficient_resource`; Footer
  drag (`Footer.tsx:41`) → `refused` → `SENTENCE` → `You are too exhausted.`; note and screen reader
  (`Footer.tsx:39,47`) and the exits page (`pages.tsx:236`) → `why` → `too exhausted`. Map and exits
  page submit only available exits. The authority-rejection line (`smoke.ts:97`) is not reached by the
  UI (N-1). `refused` on an available exit now gives `''`; no caller passes one.
- 2: mutants, each red on `model.test.ts`: drop the `SENTENCE` lookup (`model.ts:39`) → actual
  `The way north is too exhausted.`; drop the `REASON` entry (`words.ts:24`) → actual
  `insufficient resource`. Restored; suite 10/10 at head.
- 3: in a throwaway worktree at 73927a1, `lantern.test.ts` 15 pass, 0 fail; the dev harness and Node
  runner rebuilt from the `dev-*.txt` copies: `node p6/node-run.ts 19` self-check failures 0, and its
  `node-expected.json` is byte-identical to the committed `node-expected.json.gz`. CI runs 37055405705
  (`ci`) and 37055405692 (`mobile-bundle`) are success on head SHA 73927a1. `git diff 73927a1 035f444`
  touches only docs. PR checks green on 035f444.
- 4: 16 phase launches in `drive-phone-rerun.log`, each with `passcodeRequired: false`; every `done`
  line `mismatches=0 checks_failed=0`; no MISMATCH line. 1,739 Node records (sim 1,530) recounted.
  Planted: `carry2 MISMATCH lantern-carry[7] state`, `mismatches=1`, both byte strings. Mutant:
  `dusk mismatches=6 checks_failed=1`. Drivers, metro diff, stats, Node runner and mutant diff
  byte-identical to P6b's; the harness differs only in the hash, the removed `wait` conversion and the
  walk away.
- 5: `lost/then walk away` reply is `accepted` at revision 11 with `resource.adjust` and
  `entity.transfer` (the player left Bram). Resend: `replay: true`, revision 10 decision equal to the
  lost one, saved stays `{"n":11,"r":11}`; new id → `rejected invalid_state`. Holds.
- 6: N=19 → `data.ts` 1,961,244 bytes; N=20 → 2,014,402 (reproduced, same numbers as the README).
- 7: `ka CHECK lantern known answer hash PASS "9b0969438f5d…2821"`; README states the full hash.
- Timing: `dev-stats.py.txt` over `p6run-phone-time.txt` reproduces `timing-phone.txt` exactly.
- 8: `owner-saves.sha256`: both files equal across pre / after-harness / after-clean-install /
  after-launch, and equal P6b's hashes. `shasum -c SHA256SUMS` all OK; the list equals the folder
  minus the two sums files. Identifier scan (home, user name, team, uppercase UUID, UDID, container
  paths) over text and the db copy: none. The screenshot shows only the app text and status bar.
  No P6b evidence file changed.

## Findings

- **N-1 (nit)** `mobile/authority/local-story/smoke.ts:97`: a move the authority rejects with
  `insufficient_resource` would log `You can't do that: too exhausted.`, not the owner's sentence.
  Not reachable from the book UI today (all three move paths check `available`, and MV does not
  return between view and press), so no change asked; noted for when a cost-bearing perform lands.
- **N-2 (nit)** `docs/evidence/2026-10-02-r6p-rerun-iphone11/README.md:48`: "0 mismatches over 1,739
  records" includes 80 records in the HOLD phases (carry1, leave1, hold1-3), which end in a kill and
  print no `done` tally; their zero rests on the absence of per-record MISMATCH lines
  (`dev-harness.ts.txt:117`). True, but the README could say so. Same practice as P6b.

No blockers or should-fix. The 0 MV words commit is the measured build, so the gate build is the
measured one.
