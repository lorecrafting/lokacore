# Review: resident `mix loka.compile --serve` for the editor (loka-wfrgk.16)

- PR: #643 `editor/resident-compiler`
- Reviewed commit: `13fbceab5147b693b4eda6b8f482aa2918ed0389` (base main `6d627756a`)
- Governing: [cartridge.md#author-preview](../system/cartridge.md#author-preview) (one compile per save, serial,
  a failed compile keeps the last good artifact, the resident sentence added in-PR),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance), AGENTS.md "Writing tests" and
  "Production modules carry no test-only functions"
- Independence: Fable, authored none of the slice; detached worktrees `loka-wfrgk.16-rev` (hand control, real
  watcher) and `loka-wfrgk.16-mut` (mutants), both removed
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. A served compile is byte-identical to the one-shot: artifact, diagnostics, placeholder map, status, said lines;
   no state carries from one request to the next.
2. A dead, wedged or halted resident never loses or hangs a save: that save runs one-shot and a new resident starts.
3. Compiles stay serial under rapid saves; the last save wins; one resident per watcher.
4. A world switch or a watcher crash leaves no BEAM; nothing of the old world compiles after the switch.
5. A lib/ edit reaches the next compile (no stale beams).
6. Tests pin behavior with expected values independent of the implementation; mutants on the new logic die.

## Checks that held (own hand control, `scratchpad/wfrgk16/drive.py`, `watch.py`, `switch.py`)

- Bytes: one resident, 7 requests over toolbox_showcase, resource_sampler, a copy with `"comand"` (status 1,
  `error: actions/pray.json:33`), speech_sampler with a `~` (allowed and release), then toolbox_showcase again:
  every reply equals the one-shot's `{status, stderr}`, `a.json`/`d.json`/`h.json` identical or equally absent. EOF
  exits 0, no process left.
- Process shape: `mise exec` execs into `beam.smp`, so the pid author.ts holds is the BEAM; SIGKILL on it mid-request
  gives stdout EOF, exit -9, no leftover.
- Real watcher on a copy of toolbox_showcase (SSE `timings`): compile 942 ms on the first save (BEAM boot), then
  328 / 298 / 261 / 248 / 244 ms warm; publish 72–108 ms. Machine shared with two other agents' walks; the PR's
  208–223 ms is plausible on an idle one. Three saves 150 ms apart: two compiles, the last overlay holds the third
  edit, still one resident. A SIGKILL of the resident 130 ms after a save: that save compiled (234 ms, one-shot path),
  the old pid dead, a new resident up.
- World switch: `POST /world {"name":"other"}` → watcher exit 75 in 10 ms, resident BEAM gone 30 ms later; watcher
  SIGKILL → resident gone in 30 ms. `ps` filtered on `beam … loka.compile --serve` empty before and after.
- Stale lib: a comment appended to `lib/loka/content.ex` → next request exits 75 in 95 ms, no reply; a lib edit
  compiled by another `mix compile` → exit 75; a lib syntax error → the resident exits 1 with the Elixir error and
  the one-shot fails with the same error (the PR body's "the resident keeps the old code" is inaccurate, the
  author sees "Not compiled; the preview keeps the last good cartridge" either way; `start()` runs once per compile,
  so no restart loop). `mix compile --force` takes 2.6 s here: the 60 s wedge limit covers a lib recompile.
- Tests: `test/mix/loka_compile_serve_test.exs` compares served to one-shot in-process over every cartridge with
  literal status anchors; `author.test.ts` kill test pins one resident start, restart, exit 75 and no compile of
  the old world. Focused runs green.
- Post-self-review commits: 933cae952 drops `resident === run` from the kill path (safe: on the `close` path the
  child is already closed, on the wedge path `run` is still `resident`); c623c8075 `@stale 75`; 13fbceab5 `run/1`
  returns `:ok` (the cross-kernel test reads it).

## Mutants

`bin/mutate_diff.sh origin/main` at head: 24 mutants, 14 run, NO-TESTS 10 (all `author.ts`: the test spawns the
watcher instead of importing), red-narrow 14; same table as the handback. `loka.compile.ex:36 != -> ==` shows red
with no test line because the in-process `System.halt(75)` ends the test VM. Own `bin/mutate.sh` mutants against
`kernel/ts/test/author.test.ts`: `if (live) start();` dropped → red; `resident = run;` dropped → red;
`answer?.();` in the `close` handler (author.ts:165) dropped → **SURVIVED** (finding below).

## Findings

- **Should-fix** `kernel/ts/test/author.test.ts:348`: the resident is killed before the save (356), so the test only
  covers a death while idle. A death mid-request runs through `author.ts:165` (`close` → `answer?.()`); with that
  line gone the save hangs until the 60 s wedge timer, and the suite stays green. Hold the stub with `.block`, wait
  for `start …` in the log, then `SIGKILL` the first pid, as the serial test already does at :264-266.
- Nit (docs) PR body "a lib compile error leaves the manifest as it was, so the resident keeps the old code": the
  resident exits 1 with the compile error (the `compile` task raises); fix the sentence in the handoff, no code.

Developer's open items: (1) `author.ts:163` guard: correct, keep; its drop needs wedge + kill + a late `close` to
show, no test asked. (2) `loka.compile.ex:36` exit untested: accept; a suite test needs a lib edit inside the suite
or a test-only seam (forbidden by AGENTS.md); reproduced by hand above. (3) no restart backoff: accept; at most
two BEAM boots per save on a broken lib, `start()` runs only after a compile. (4) 60 s wedge over a lib recompile:
accept, 2.6 s measured. (5) diagnostics after the writes: one-shot disk-full edge, author-side, nit.

No blocker: served bytes equal one-shot bytes, and no BEAM survives a switch or a crash.
