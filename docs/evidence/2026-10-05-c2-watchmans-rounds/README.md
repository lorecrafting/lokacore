# C2 Watchman’s Rounds evidence

Frozen local source: `747113496572892a01224c47cddc0bf4f63d0fdc` on
`slice/c2-watchmans-rounds`, after published mechanics and C3 planning main
`80c3a0725e2266871f949b9a72577ba84dd2b70e`. This evidence commit adds no source
mechanics. Parent records independent reviews and publication separately.
Chapter 0.0.24/API1.22, 109 initial IDs; independent hash
`62f10e30e226c67627628c0017091284bbf1485a473222883fce92b44947b008`.
[Artifact match](artifact-match.log) proves compiled source equals the standalone
Python known answer. [Runtime](runtime.json): Node24.21.0, actual SQLite3.53.4.

## Focused checks

Commands and exits are in [checks](checks.json). The
[34 passing TS/SQLite checks](focused.log) cover public route and unique credit,
explicit Rejoin and stale draw, real leader-ahead fatal combat, concurrent original
Wren follow/death, cold reopen after every selected boundary, immediate Restart,
corrupt row and causal receipt refusal without rewrite, original C1 payments/gift,
trust-only success and both uncertain-COMMIT outcomes at departure/final join.
The [22 Elixir/compiler/core checks](elixir-focused.log) include actual source
compilation, independent literal malformed contracts/lifecycle/targets,
independent invariant checks and two-kernel differential composition.

Kernel `npm run typecheck` and app `tsc --noEmit` passed
([kernel](kernel-types.log), [app](app-types.log)). Active core
[TS size](ts-size.log), [purity/import scan](purity.log), Elixir size,
contracts/features regeneration, format and the normal commit hook passed.
After every planted mutation was restored, the same focused suites passed again;
Elixir used `--force` to avoid same-second stale compilation
([TS/SQLite](restored-focused.log), [Elixir](restored-elixir.log)).
No full-active or hosted CI result is claimed: the parent runs the one accumulated
publication check line under the normal hook. Native/simulator/Hermes timing: null.

## Actual planted controls

[Schema controls](schema-controls.log): **91 planted required/bound/closed-shape
breaks, zero survivors**. Each changed guard was removed separately, contracts
regenerated, then the literal patrol contract fixtures run; unsupported schema
shapes fail generation. Closed union branches are aligned by their discriminator
against published B6, so a relocated existing B6/B7 arm is not counted as a new C2
guard. [Script](schema-sweep.py), [summary](schema-sweep.log).

[Behavior controls](behavior-controls.log),
[ownership controls](ownership-controls.log): **ten actual breaks** each pass the
old focused same-layer suite and fail the new focused patrol suite. These cover
portable full-prior comparison, exact drawn attempt/cursor, credit on leader entry,
checkpoint deduplication, fatal credit reset, ordinary reserved trust writes,
original portable row identity, route adjacency, and the separate TypeScript and
Elixir reaction lifecycle bypass. The
[behavior script](behavior-mutants.py) and [ownership script](ownership-mutants.py)
retain the exact edits and commands. No mutant is committed to production source.

## Real Book walkthrough and open limitation

On a separate disposable local origin, the Book showed original Tobin’s legacy
lesson control beside the exact labelled Watchman’s Rounds control. Start was
retained across an early refresh; Continue left the player behind, with the map
showing Tobin at the next room. After the first join, chapel detour/return kept the
attempt paused until [explicit Rejoin](book-rejoin.png). Ordinary travel to the
actual cellar, surviving installed rat combat and Flee preserved paused state;
return again required Rejoin. The remaining real paired joins reached
[committed completion narration](book-completed.png) and
[resolved 4/4 Journal](book-journal.png), with no payment or skill/item reward.
The [retained DOM trace](browser-trace.log) records this observed route.

**Terminal browser reopen remains unproved.** The first terminal reload, settled
retry and fresh tab displayed
[“Sync operation timeout”](book-reopen-failure.png) during web SQLite startup.
The error was caught by startup; no exception stack was exposed. Parent has a
separate published-main/C2 diagnosis. No save reset, deletion, worker patch or
platform change was performed here. Browser fatal/Restart is not claimed; real
fatal/Restart and terminal cold reopen are proven by file-backed SQLite tests.

## Integrity

Capture sanitizes home/worktree/scratch and device/provisioning identifiers.
[SHA256SUMS](SHA256SUMS) hashes retained files; [verification](verify.txt) records
all matching. No native device, owner preview or owner save was used.
