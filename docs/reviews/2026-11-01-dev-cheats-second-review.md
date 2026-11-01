# Dev cheats: second opinion (PR #546, loka-vduxr.6)

Reviewed `39222b1a2853b92994b226783564b7cbf8d55c61` (branch `engine/dev-cheats`), required because the slice changes `protocol/action.schema.json` and save checks. Governing text: audit A11, [cartridge.md Author preview](../system/cartridge.md#author-preview) line 887, [storage lesson](../lessons/storage.md). CI at this head: `ci` success, `book-e2e` success (the earlier head `5d49aff96` had `ci` red on the panel types).

## What must be true (written before the diff)

a. Only the preview path sets `host.dev`, and a production bundle cannot set it.
b. On a release host a `dev_*` invocation answers `unsupported_capability`, `step` answers `permission_denied`, and no replay route decides a `dev_*` command.
c. A release refuses any save holding an accepted dev receipt, however encoded; a save holding only a refused cheat opens.
d. Every accepted cheat reopens on a dev host and the next command does not throw, mid-play too.
e. The lost-ack `adopt` path works on a dev host.
f. Non-dev saves, receipts and content hashes are unchanged, apart from the `kernel_api` pin.
g. No cartridge action can name `dev_*`, in Elixir or TypeScript.

Result: a holds by read (`App.tsx:55-56,97`, `metro.config.js:29-45`, `panel.tsx:29-32`). b and c fail (finding 1). d, e, g hold. f holds for hashes and fixtures, with one note (finding 3).

## Findings

1. **Blocker.** `mobile/authority/local-story/receipt-save.ts:20` and `receipt-history.ts:36`. The release refusal reads with SQLite `json_extract` (first duplicate key); replay reads with `JSON.parse` (last duplicate key). Rewrite an accepted receipt's command as `"payload":{"type":"move",...,"type":"dev_go_to_room",...}`, or as `"payload":{"type":"move"},"payload":{...}`. `DEV_RECEIPT` sees `move`, and `receiptHistory` routes the parsed `dev_` type to `stepDev` with no host check. Run on a release host, SQLite 3.53.4: `toolbox_showcase` opens at `room.boar_run.title`, the next `look` and `rest` are accepted, a reopen stays there. History-skipping `codex_sampler` opens at `room.mill.title`. Controls: an unchanged dev save, escaped values and escaped keys are all refused. It needs an edited save file. The run edited a dev save; by read a release player could write one from scratch, since command ids are computable and `stepDev` is deterministic (not run). On a history-checked cartridge the replay otherwise proves saved state came from `step`, so by read this is the edit that gets cheat state past it. It contradicts `cartridge.md:887`, `rule.ts:2-3` and the PR body's "only a host with `dev: true` calls it". Fix: read with the parser replay uses. A throwaway JS scan of accepted receipts in `receipt-save.ts` refused every forged form, and all `dev-cheats.test.ts` tests passed. Passing `dev` into `receiptHistory` too would remove the route; add a forged-duplicate test either way.
2. **Nit.** `kernel/ts/src/mechanics/dev/rule.ts:39-48`. The comment and the `escort` clause cite a mobile escort-save fact proof; `escort-save.ts` has no fact reference since #544. Scenario: an escort choice's fact is refused with no proof behind it. No fixture has such a choice; only the kernel test pins the refusal.
3. **Nit.** `protocol/action.schema.json:47`. Shared `ActionInput` now allows `room`, `fact`, `value`, so a malformed `look` with `value` on a release host answers `unsupported_capability` and writes a rejected receipt. Reopens fine. Reasoned against the base, not run there.
4. **Nit.** PR body is stale: `kernel_api` 1.133 and #544 at 1.132 (live 1.137), `receipt-save.ts:32` (the check is `:31`), `/code-review` stops at `b51d918eb`, before the rebase.

## Checks

- Dev saves: go-to and set-then-reopen sweeps over 49 fixtures, with pending choices and notices, found no cheat-caused brick. During an expedition attempt go-to and facts answer `invalid_state`; after a completed or failed one go-to reopens and `rest` is accepted. Failures matched the no-cheat control (below).
- Mutants: 16 narrow, null controls green, all killed (host gate, dev save check, accepted filter, `step` refusal, replay via `step`, underwater, escort, expedition, deadline, scene, same-value, patrol, water, running, choices, `resolveDev` targets).
- PR-body claims rerun: "only a host with `dev: true` calls it" is refuted by finding 1; "`step` refuses them (`permission_denied`)" is backed by the `step` mutant going red. `/code-review` is reported.
- Hashes: only `invalid.json` added under `protocol/fixtures`; seven story SQL files differ by the `kernel_api` pin.

## Separate from this slice: frozen samplers cannot reopen

Harness artefact, not a player bug. On `origin/main` `2d781bfee` and at this head, two plain `openGame` calls with no command answer `save_corrupt` (`session.ts:94`) on exactly `cartridge_sampler`, `reward_storage`, `sampler_v008`, `sampler_v009`, `sampler_v010`; the other 42 fixtures reopen. Cause: these hand-pinned fixtures (`FROZEN`, `bin/regen.sh:37`) predate `40778a26e` (2026-10-04, authored receptacles), so `trunk` holds `tin_whistle` without `container: true`. `fresh.ts:141` gives it capacity 0, and `custodyValid` (`created.ts:272`) sees 1 of 0. That check runs only with `world.death` or a consumed holder (`created.ts:48`), so the older `sampler_v007` passes. Live source has `container: true`: a compile of `cartridges/cellar_sampler` reopens. With the flag removed, `mix loka.compile` refuses it. A hand-written cartridge of this shape would still pass the TypeScript loader; no shipped path carries one (`toolbox_showcase` reopens).

Not checked: toolbox dialogue choices and deadline jobs mid-state were not reached by the walker; other SQLite versions; the fix was a throwaway, not reviewed code.

Verdict: CHANGES REQUIRED
