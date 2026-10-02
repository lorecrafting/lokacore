# Gate R6P record: checklist, human proof, carries (2026-10-02)

The slim gate record ([owner decision](../decisions/owner-decision-slim-gates-2026-10-02.md)) for
[pre-release-proof](../spec/pre-release-proof.md#evidence-required-to-finish-r6p) :82-88. It holds
no verdict; the gate reviewer rules. R = the [P6 rerun](2026-10-02-r6p-rerun-iphone11/README.md),
P = [P6b](2026-10-02-r6p-iphone11/README.md); line numbers are in those READMEs.

## Checklist

| Spec item | Proof | Status |
|---|---|---|
| :84 each choice path by touch | G1 below | recorded; reviewer rules |
| :84 explain its consequence | G3 below | recorded; reviewer rules |
| :84 quit at a choice, airplane resume, no developer instructions | G3 below; P:51 (row 13) is not this (old hash `050cba8c`, cable kill, not at a choice) | recorded; reviewer rules |
| :84 confusing interactions | G1 below; P:55-58 are agent Simulator runs, excluded | recorded; reviewer rules |
| :84 authoring effort | below (inspected) | recorded |
| Tester's exposure ([r6p plan](../decisions/owner-decision-r6p-plan-2026-10-01.md)) | Tester below | recorded |
| :86 build and cartridge hash, OS, device | R:15-33 | linked |
| :86 conformance profile | R:33, P:32-33: null (none exists) | reviewer rules |
| :86 both path transcripts, save/restore | R:42 (row 4), planted control | linked |
| :86 latency | R:40 (row 2) | linked |
| :86 input responsiveness | P:52 (row 14, handler-to-frame proxy only); G2 below | partial; touch-to-photon carried |
| :86 failures before/after commit, narrative boundary | R:45-47 (rows 7-9) | linked |
| :86 lost response replays after the choice is gone | R:48 (row 10) | linked |
| :86 no reroll on duplicate | R:49 (row 11); P:107-109 | linked |
| :88 known answers on the actual adapters | R:43-44 (rows 5-6), R:17-21 | linked |
| :88 per-step diagnostics carry canonical bytes | R:42-43 | linked |
| Carries in stage rows | Carries below | linked |
| Docs tidy pass | the [gate review](../reviews/2026-10-02-r6p-gate-review.md) | linked |

## Build played

- **PM-recorded:** the owner played a clean Release build of `main` 64a2b12. The device for this
  play is the iPhone 11 (iPhone12,1), iOS 26.6.2, the wired phone of the rerun (device-reported by
  `devicectl` at the install; the owner deleted the earlier app first, so the play started from a fresh
  install).
- **Inspected:** `git diff --exit-code 73927a1 64a2b12 -- kernel lib mobile protocol cartridges`
  exits 0 (empty), so the code, protocol and cartridges are those of the measured build 73927a1.
  Cartridge content hash `9b0969438f5ddad877c88506ffe295c5084e3014d607ef0ba24c922ee5db2821`.

## Tester

**PM-recorded from session records, not owner words:** the tester is the project owner. Before this
play they read the R6P plan, the Lantern text in reviews and the UX notes, and played earlier Lantern
builds on the iPhone (the P5b install; P6b rows 13 and 14 on an instrumented build). They are not a
naive tester.

## Play: the PM's notes, copied exactly (owner words paraphrased)

- G1. Sequence (record exactly; no verdict on pre-release-proof:84, the reviewers judge it): owner played leave by touch, reported they could not find the lantern; PM then sent the full route (Landing north -> Green, east -> Reed Bank, east -> Lantern Shelter, tap [brass lantern] to take, walk back west, west, south) and that the gate does not open by touch; owner then wrote they had found the lantern, gave it to Bram and completed the story (unknown whether they used the route). Then, after PM asked, owner played carry after Start over: "it worked" (paraphrased). Confusing interaction: the lantern hard to find.
- G3. Sequence (record exactly): PM gave a step-by-step procedure (Start over, play to Bram's choice, airplane mode on, swipe the app away, reopen); owner: the choice was still there and they could finish from it (paraphrased). PM asked "what each ending changed, for example what the Landing says"; owner read back the Landing text: carry -> "The ferry rocks at its rope. The search party will wait on Bram" (room.landing.player_led); leave -> "...The search party will go out with Bram and the lantern" (room.landing.party_led). Owner gave no explanation of the consequence beyond that text.
- G2. Touch feel (P6b row 14 carry), owner when asked (paraphrased): taps and drags responded right away; no lag, no missed taps. But sometimes a joystick drag up or down moved the whole app into a sliding mode (gesture conflict; see U7).

U7 is in the [ROADMAP](../ROADMAP.md) Playtest row.

After the [gate review](../reviews/2026-10-02-r6p-gate-review.md)'s ruling (G-1), the owner gave their own
explanation of the consequence (paraphrased): "carry (leading) meant I went with the party; leaving meant
Bram's party goes out." No verdict here; the reviewer re-checks it against the consequence clause.

**Owner acceptance (2026-10-02, paraphrased):** the unaided-completion clause of :84 is deferred to a
fresh tester who has not seen the game, in the Playtest row, before the first release.

## Authoring effort (inspected, from git)

Only #100, #107 and #110 touch `cartridges/lantern_proof` since the Early R7/R8 gate (bfc1b89).
Lines are JSON lines; time spent is null (not recorded).

| PR | Files | Lines | Fix rounds (review record) |
|---|---|---|---|
| #100 P3 | 13 new | +290 | 2 (cartridge text changed in both) |
| #107 Polish | 1 (`text.json`) | +3 −3 | 1 (cartridge untouched) |
| #110 Untime | 5 (1 new: `resources.json`) | +21 −22 | 1 (commits "Untime fix 1-4"; re-check in the record); `resources.json` came in that round |

## Carries (each in its [ROADMAP](../ROADMAP.md) stage row)

- UI batch from this play, U7 first (a bug), U1-U6, U8, save-error flush left, Polish O-1: Playtest and tune.
- M1, quest from dialogue: its own row ([record](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
- P6 rerun N-1 (authority-rejection line): Presenter split.
- World parameters P6 (fixed seed), P6b row 14 touch-to-photon, the `kernel/ts` audit nits with the
  `target.ts:34` pointer, P5a replay without the key: R7/R8 for chapter one.

## Gate passes only after the save fix

The Astra audit below is FAIL. The gate passes only after the fix slice (branch `r6p-savefix`) merges. The
owner played 64a2b12; the gate build will include those fixes, so the builds are not identical. The fixes
touch only the load, replay and recovery paths and the log length, not what the owner touched by hand.
R6P-A01 is fixed there; P4A-2 (index damage loses readable pending reports) is a different case and stays
carried to R12.

## Codex Astra gate audit (gpt-6-astra, 64a2b12)

FAIL

```text
R6P-A01 | blocker | mobile/authority/local-story/smoke.ts:251 @64a2b12
Finish Lantern offline, leaving one pending report; damage only the final receipt.response to '{', reopen, then confirm Start over. Narration reading raises “malformed JSON”; this catch loses the authority's newGame callback and enables whole-file deletion. The intact pending report is erased. Reproduced: reports 1→0; the authority's in-place newGame preserves that same report.

R6P-A02 | blocker | mobile/authority/local-story/store.ts:114 @64a2b12
Remove the player's containers row from an otherwise readable save, then reopen. load accepts the incomplete state and openStory returns “open”. The first screen() throws “Cannot read properties of undefined (reading 'variants')” outside the opening-error handler, leaving no corruption/recovery screen. Reproduced with the player-body row missing. Parsing JSON alone does not establish a playable save.

R6P-A03 | blocker | mobile/authority/local-story/store.ts:190 @64a2b12
Commit Scan at revision 1, then corrupt its response to the valid JSON text 'null'. Reopening succeeds; retrying the original invocation returns {kind:'saved', replay:true, revision:1, decision:null}. The receipt reader validates neither the response shape nor its integrity, so corruption is advertised as a confirmed replay instead of an integrity failure. Reproduced; violates §14's original-outcome guarantee.

R6P-A04 | should-fix | mobile/authority/local-story/smoke.ts:202 @64a2b12
Retrieve the lantern, return to Bram, and repeatedly Talk/Close without restarting. Every cycle permanently appends log lines; nothing caps or discards them. Reproduced: 100 cycles retained 316 lines; 1,000 retained 3,016. The same-room UI copies/renders the growing log on subsequent actions, so memory and rendering work grow without bound. Changing rooms merely advances the UI's starting index; retained history remains allocated.
```