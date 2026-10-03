# Review: c1-host, a seed, world context and clean kernel version per lineage

- PR: #129, branch `c1-host`
- Commit reviewed: `49d4dff`. This is `2b811f6` plus a PM merge of main. The ROADMAP is main's; main's
  "R7/R8 for chapter one" row no longer holds the fixed-seed and `000…0-dirty` carries.
- Reviewer: fresh Opus. Full depth: save, lineage and kernel-adjacent code.
- Governing: `docs/system/save.md`; DIFFERENCES rows 6-7; `docs/world-parameters.md` P6; ADR-075
  §3 (seed, "Kernel version is the source revision") and §4 (A4 `world_context_id`, R6 S2
  segments); 10 §§31-32; plan `docs/decisions/owner-decision-chapter-one-plan-2026-10-02.md` slice 1;
  the c1-host brief and the PM's Q1-Q3 rulings.
- **Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. When the host gives a random source, each new lineage (a first open, and Start over through
   `newGame`) draws its own seed and world context:
   - the seed is a valid RngState, and is drawn again if all four words are zero;
   - the context is a v4 UUID;
   - the seed goes in `save.seed` and the context in `pin.world_context_id`;
   - the trace header's `world_context_id` equals the pin's.
2. A reopen rebuilds the base world from the pinned release's cartridge under the pinned context.
   It restores the RNG from the head, not from the seed. `catchUp` and `newGame` use that same base.
3. A pin with no `world_context_id` (made before c1-host) opens on `release.fresh` and is never
   rewritten. The only new trace row is a segment header (R6 S2).
4. With no random source, behaviour is unchanged: no existing hash, trace or fixture moves, and
   neither `protocol/` nor `kernel/` changes.
5. Kernel version:
   - a Release bundle from a clean tree reports `loka-kernel@<40-hex>`;
   - a dirty tree reports `-dirty`, never the bare HEAD;
   - `__DEV__` always reports `-dirty`;
   - with no stamp, the version is the zero commit with `-dirty`;
   - the result always matches the KernelVersion pattern (no `-dirty-dirty`).
6. The `authority.ts` split changes no behaviour and edits no test. `authority.ts` stays at or under
   300 lines at every commit.
7. Docs:
   - save.md is amended;
   - DIFFERENCES rows 6 and 7 are gone;
   - P6 is DONE;
   - the session.ts `:22` comment no longer names R6P.
8. The evidence holds no identifiers, and has SHA256SUMS with a verify file and `-whitespace`.

## Checked

- **Split (`2165b2c`):** the removed lines of `authority.ts` and the added lines of `save.ts` are
  identical, apart from `export` and the imports. The commit edits no test. `authority.ts` has
  263/296 lines and `save.ts` 116 lines at every commit. `save.ts` imports only types from
  `authority.ts`.
- **Each point of the list holds in the code:**
  - `drawn` (`authority.ts:110-120`) sets the v4 version and variant bits correctly and redraws an
    all-zero seed.
  - `pinned` (`:127-131`) returns undefined (`save_corrupt`) for a context that is not a
    WorldContextId. It passes the template rng to `newWorld`. This has no effect: `load` always
    takes the rng from the head (`store.ts:115`), and `newWorld` uses the seed only as `state.rng`.
  - `newGame` sets `s.fresh = world` only after the commit is confirmed.
  - `first` always pins the context.
  - `App.tsx:34-35` cannot produce `-dirty-dirty`.
  - expo-crypto 57.0.3 `getRandomValues` fills the array and returns it, with no `this`.
- No `protocol/`, `kernel/` or fixture change. The `saves.test.ts` `PIN` literal gains the field.
  It is a test expectation, not a frozen fixture.
- Elixir/TypeScript parity does not apply: the change is TypeScript host code only.
- CI is green at `49d4dff`: android, bundle, elixir, ios, lint, typescript. The baseline
  `npm test` in `mobile/app` is green after a full `npm ci` (root, `kernel/ts`, `mobile/app`).
- **Metro stamp, run locally:**
  - clean tree: bare HEAD;
  - an untracked file: `HEAD-dirty`;
  - clean again: bare HEAD.
- **Evidence:**
  - `shasum -c SHA256SUMS` passes for all 10 files;
  - `.gitattributes` marks `docs/evidence/** -whitespace`;
  - no UDID, device name, home or container path in the text files or the screenshot checked;
  - the facts are labelled device-reported or inspected;
  - the failing result (the stale transform cache) is kept.

## Mutants (throwaway detached worktree; all reverted)

| Mutant | Result | Killed by |
|---|---|---|
| `drawn` keeps the template rng (constant seed) | killed | lineage "two new games…", "luck replays" |
| `drawn` keeps the template context | killed | lineage "two new games…", "a reopen rebuilds…" |
| `pinned` always returns `release.fresh` | killed | "a reopen rebuilds…", "not a WorldContextId" |
| `newGame` adopts `newest.fresh` | killed | "a reopen rebuilds…" (header context) |
| no all-zero redraw | killed | "luck replays" |
| pin without `world_context_id` | killed | lineage plus 4 `saves.test.ts` tests |
| no WorldContextId validation | killed | "not a WorldContextId" |
| old pin rewritten on reopen | killed | "a save from before c1-host…" |
| UUID version bits not set | killed | "two new games…" |
| `load` restores the rng from the seed, not the head | killed | "a reopen rebuilds…" plus 3 others |
| `openGame` drops `random` (`{ ...build, random: undefined, … }`) | **survived** | F-1 |
| `metro.config.js` `dirty = false`, with an untracked file | **survived** (no automated check) | F-3 |

## Findings

- **F-1 should-fix, `mobile/authority/local-story/session.ts:84`**
  (`const host = { ...build, newId, latency }`).
  - The path the phone uses (`localSession` → `openGame` → `openStory`) is never run with
    `random`.
  - Because of the declared deviation, `random` is optional in `HostPart`, so `tsc` does not
    guard it either.
  - Failure scenario: a refactor of `openGame` drops `random`. Every phone game then goes back to
    the template seed and context, which is DIFFERENCES row 6 again, and every Node test stays
    green (mutant run).
  - Fix: one existing `localSession` or `openGame` test passes `random` and asserts that the pin's
    context is not the template. Or make `random` required in `HostPart`, as the brief said.
- **F-2 should-fix (tracked; PM ruled: add in the fix round),
  `mobile/app/book/joystick.test.ts:66` and `mobile/app/book/touch.test.ts:51`.**
  - Both call `openGame` with no build, so their stories run with `kernel_version` undefined.
    The app cannot produce that host shape.
  - `tsc` excludes `book/*.test.ts`, so nothing flags these calls.
  - Failure scenario: a header or trace check that depends on `kernel_version` behaves differently
    under these tests than on the phone.
- **F-3 note (no change required; the brief assigns this proof to evidence),
  `mobile/app/metro.config.js:17-18`.**
  - Nothing automated tests the stamp's dirty branch. CI asserts a clean tree first, so its
    negative grep only catches a stamp that is always `-dirty`.
  - Failure scenario: a regression in the dirty check (for example `git diff --quiet`, which
    misses untracked files) makes a local dirty Release build report the bare HEAD, which ADR-075
    §3 forbids.
  - Today the only guard is `bundles.txt`.
- **N-1 nit, `mobile/authority/local-story/session.ts:75-81`.**
  - `openGame` takes 5 positional parameters, but its only production caller (`:134`) already
    holds the whole `host` and passes `host.newId, host.latency, host`.
  - Taking `HostPart` in their place removes the `undefined` placeholder in `smoke.test.ts:39`.
- **N-2 nit, `docs/system/save.md:37` and `:136`: stale line pointers.**
  - "A fault gets no receipt (`:187`)": `authority.ts:187` is now the effect-outbox throw.
  - "`kernel.decision_latency` (`:216`)" now follows `save.ts:110`, and `save.ts` has 116 lines.
    The latency observation is at `authority.ts:209-211`.

## Decisions

- The declared deviations are accepted, except the gap F-1 shows in the optional `random`:
  - CI greps the bare SHA; the app joins `KERNEL_ID` at run time;
  - `cacheVersion` is set to the stamp, and the kept failing result justifies it;
  - `KERNEL_ID` is re-exported for the lint boundary;
  - the start_over literals gain `kernel_version`;
  - test 3a draws `[0,0,0,0]` first, which exercises the redraw.
- The luck replay evidence on the device (the dirty harness, `dev-App.tsx.txt`, never committed)
  follows Q2. The Node test is the acceptance proof.

Codex Sol review: appended by the PM.

## Codex Sol first review (49d4dff), verbatim

CHANGES REQUESTED

```text
R1 | should-fix | mobile/app/metro.config.js:19 at 49d4dff
Export a modified source copy without Git metadata while EXPO_PUBLIC_KERNEL_COMMIT contains a previous clean SHA. Git fails, but the empty catch preserves that value; App.tsx reports the old bare SHA in Release, falsely claiming a clean source revision. Delete EXPO_PUBLIC_KERNEL_COMMIT in the catch so the app uses its zero-commit -dirty fallback. Reproduced with controlled Git failure.
```

## Fix round 1 re-check (0fcd507)

Reviewed `fe7b19f..0fcd507` (`33f35e6`, `0fcd507`), its touched code and their direct callers only. Throwaway worktree, full
`npm ci`: `mobile/app` `npm test` and `tsc --noEmit` green at `0fcd507`. **Verdict: APPROVE.**

| Item | Disposition | Verified |
|---|---|---|
| Sol R1 `metro.config.js:19` | `catch` deletes `EXPO_PUBLIC_KERNEL_COMMIT`; `mobile/app/metro.test.ts` (fake failing git, inherited stamp) | holds; with the `delete` removed, "git failing drops an inherited stamp" fails; `*.test.ts` added to `npm test`, excluded from `tsc` like the other tests |
| F-1 | PM accepts `random` optional; `lineage.test.ts:88` drives `openGame` with `random` | my mutant (`openGame` passes `{ ...host, random: undefined }`) now fails that test. Residual, not a finding: the same drop one level up in `localSession`'s `reopen` (`session.ts:127`) still survives; it is a plain pass-through, and the brief allowed `openStory` as the test seam |
| F-2 | `kernel_version` in `joystick.test.ts:75`, `touch.test.ts:51` | holds |
| N-1 | `openGame(db, bundled, host: HostPart)` | holds; all four callers (session `reopen`, smoke, book tests, lineage) updated |
| N-2 | `save.md:37` `:182`, `:136` `authority.ts:209-211` | holds (`:182` is the fault branch) |

New nit (pointers this round moved):
- **N-3 nit, `docs/system/save.md:25`, `:103`, `docs/system/DIFFERENCES.md:13`.** One line early:
  `session.ts:54` and `:59` land on `try {`, not `gameView(...)` (`:55`) and `story.narration()` (`:60`);
  `session.ts:153` is the handle reset, not `remove()` (`:154`), which the old pointer `:161` named.

Open: CI had not yet reported on `0fcd507` when checked (last green: `0bf21ea`).
