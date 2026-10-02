# Review: presenter boundary (owner addendum), PR #113

- PR: #113, branch `presenter-boundary`, commit reviewed `d3de32d`
- Kind: docs only (short review, no mutation testing)
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

From [07 §The session boundary](../spec/07-offline-storypacks-to-mmo.md#the-session-boundary) and 01 core principles (host-neutral `ActionInvocation` and `GameView` contracts):

1. The renderer talks to one `GameSession`. `LocalStorySession` and `RemoteRealmSession` both implement it.
2. The renderer receives host-neutral `GameView` and emits host-neutral `ActionInvocation`. It never builds authority-internal Commands and holds no copy of the rule semantics.
3. One authority per running session. The addendum must not contradict this.
4. Statements about today's code are true. Each fact lives in one place (AGENTS.md, Writing docs).

## Checks

- Spec: the addendum restates 07 correctly. It changes no spec text. 1–3 hold.
- Code: `mobile/app` imports `smoke.ts` (App, SaveError, Book, Footer, MapDrawing, model, pages, joystick.test) and `words.ts` (`model.ts:5`). `GameView`, `ActionInvocation`, `NarrationRecord` and `ErrorCode` are generated in `kernel/ts/src/contracts.gen.ts`. The claim is true, but "imports `smoke.ts`" leaves out `words.ts`, which the original decision already names.
- Anchors: `#the-session-boundary` and `#addendum-2026-10-02-one-presenter-for-every-engine` both resolve.

## Findings

**S1 (should-fix) `docs/ROADMAP.md:55`.** The Presenter split row restates all three addendum bullets: protocol types only, the local authority implements the session, and the import check with its exceptions. Both docs carry the same import-check rule. A later edit to one (for example, allowing `protocol/fixtures`) would leave the two out of step. Fix: keep the link to the addendum and one clause ("adds the `GameSession` boundary and its import check").

**S2 (should-fix) `docs/decisions/owner-decision-presenter-split-2026-10-02.md:44`.** The addendum says the words "key on the registered codes". Refusal codes are registered (`protocol/error_registry.json`, `ErrorCode`). Outcome codes are not: `DecisionResult.outcome` is a bare `Key`, and `taken`, `activated` and the other outcomes appear only as rule output and schema examples. Scenario: the Elixir engine returns a different outcome key for take. Nothing catches it, and the phone shows no answer line. Fix: limit "registered" to refusal codes, or say outcome keys are a shared, unregistered vocabulary. Adding a registry is not asked for.

**S3 (should-fix) `docs/decisions/owner-decision-presenter-split-2026-10-02.md:38`.** "with only protocol types in it" cannot hold as written. The session also needs lifecycle and reply types that are not in `protocol/`: `Failed` and start over (`smoke.ts:225`, used by `SaveError.tsx`), and the `stale_view`, `conflict` and `pending` reply kinds. Scenario: the developer either breaks the rule or adds schemas that no spec asks for. Fix: "protocol types plus the session's own lifecycle and reply types, which name no engine internals".

## Question

- Q1 `mobile/app/App.tsx:9` imports the Lantern cartridge from `protocol/fixtures`. Loading a cartridge is local-authority work. Under Realm the server supplies it. Should the import check (or the session) cover this import, or is `protocol/` exempt by design?

## Fix round 1: `c78364c`, verdict APPROVE

I re-checked only the fix hunks.

- S1: fixed. `docs/ROADMAP.md:55` now has one clause that links to the addendum. The addendum is the only place that states the import rule.
- S2: fixed. The registry claim now covers refusal codes only (`error_registry.json`). The addendum now says outcome codes have no registry. An unknown outcome code shows no answer line. This is a stated known limit, which is acceptable because no spec requires an outcome registry.
- S3: fixed. The session may hold its own lifecycle and reply types (a save that does not open, Start over, and `stale_view`, `conflict` and `pending`) if they name no engine internals. This matches `Failed` in `smoke.ts:225` and the reply kinds.
- Q1: resolved. The check covers the renderer and now includes `protocol/fixtures/`. The app shell picks the session and gives the local session its bundled cartridge. This is consistent with 07, where the app selects one authority.

No new findings.
