# E1 watch rounds proof and blocked marsh Start

Separate branch `proof/e1-night-watch-paths`, based on recorder checkpoint `a1322ea`. The [watch recipe](../../../kernel/ts/test/e1_watch_rounds.ts) and [focused test](../../../kernel/ts/test/e1_watch_rounds.test.ts) implement only legal real-authority/SQLite proof inputs for [S3](../../system/mechanics.md#s3-finite-watch-patrol-c2-selected-contract) and the [selected C2 route](../../system/cartridge.md#c2-watch-route-and-trust). Author source: `513d21504cadba7b73712b612893b0040c6f3147`. Neither case is registered with the reviewed recorder; E1 certification remains pending.

## Watch result

`watch-rounds.jsonl` retains a fresh road-born run: 31 committed commands and 24 cold reopens. The route starts S3 at Watch Post, sends Tobin to North Gate, then legally detours into Watch Cell. Walking beside Tobin while paused earns no credit. Rejoin preserves the original attempt and earns zero. Subsequent Green/East Gate/Green/North Gate/Post joins have literal credit counts 1/2/2/3/4. The final four checkpoint names are East Gate, North Gate, Village Green and Watch Post; the quest resolves with literal outcome `completed` and trust true. A new Continue is refused with `invalid_state` after completion; another cold reopen preserves trust and all four credits.

The production authority is the sole state writer. No adjusted start, hidden state change, Wait, wall-clock sleeping, alternate mechanic or native/owner save is used. The recipe reopens stored continuation draws before each choice and committed patrol rows before the next consumer. `caseHost` independently redecides each receipt, checks invariants and compares decision/state bytes. The focused check repeats the route from a fresh database and compares the deterministic digest, then replays all recorded commands from the exact fresh world through `AUTHORITY_KERNEL`.

- `green.log`: three focused existing/new E1 tests pass, exit 0. TypeScript typecheck, formatting and focused TS size check also passed.
- `last-join-*`: omitting only the closing Watch Post player move passes the old case suite (exit 0), but fails the new watch check (exit 1).
- `rejoin-*`: omitting explicit Rejoin likewise passes the old case suite and fails the new watch check (exit 1). Both mutations are restored.
- `retained-replay.log`: reads retained JSONL commands, reconstructs the admitted fresh world using retained identity/RNG and checks its initial-state hash. Watch replay finds no failed invariant. The blocked Night receipt reproduces its exact recorded invariant failure; the replay command's exit 0 means the expected failure was reproduced, not that Night passed.

The watch start record binds actual source/check/policy and artifact/content identities, plus explicit recipe/test byte digests. The existing recorder check digest is retained separately because this proof recipe is unregistered. `certification: false` is explicit. Test-host all-zero revisions remain placeholders in unit runs; the retained watch trace uses its actual source revision. Generated IDs are deterministic proof inputs, not device identifiers. Capture redaction covers local paths; the hashes protect unchanged raw bytes.

## Marsh blocker retained

`night-start.jsonl` and `night-start-summary.json` bind original source `a1322ea00941c7ff0e61f5901fc93cca058530b7`. Minimal fresh commands: select road-born; Move south, south, east to Hound Run; invoke `begin_marsh_watch` on gnawed bones with literal `{transition: "start"}`. The real authority commits an accepted Start, production composition returns changes, production apply returns state, and cold SQLite reopen accepts an active expedition with cursor zero. Independent simulator replay fails `delta_preconditions_hold` at zero-based command 4.

The installed [precondition checker](../../../kernel/ts/src/runtime/invariants_delta.ts) lacks `expedition.transition` handling: generic `link` expects `from/to`, while generic `initial` falls back to the clock instead of the expedition row. Diagnostic `gate(state, ops, result)` passes; removing only the expedition operation from the independent check makes it pass. No production authority/loader failure was observed. This is the C6 checker coverage defect under [S27 Start](../../system/mechanics.md#c6-s27-night-in-the-marsh-selected-planning-contract); the original receipt is preserved for its owning fix and replay after publication. No local workaround or passing Night claim is included here.

## Limits

This checkpoint proves only the legal watch success/detour/Rejoin/refusal route and reproduces the blocked marsh Start. Watch death/Restart, transaction fault schedules, exact authored obligation binding, recorder registration, the published checker fix and final 10,000-sequence run remain outside this checkpoint. The reviewed recorder branch is unchanged. No full gate was started during the parallel gate hold; focused checks are author evidence awaiting independent review. This documentation commit follows the recorded source and issues no final certificate.
