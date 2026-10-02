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
| Docs tidy pass | the gate PR's description | listed |

## Build played

- **PM-recorded:** the owner played a clean Release build of `main` 64a2b12. The device for this
  play is not recorded (null).
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

## Authoring effort (inspected, from git)

Only #100, #107 and #110 touch `cartridges/lantern_proof` since the Early R7/R8 gate (bfc1b89).
Lines are JSON lines; time spent is null (not recorded).

| PR | Files | Lines | Fix rounds (review record) |
|---|---|---|---|
| #100 P3 | 13 new | +290 | 2 (cartridge text changed in both) |
| #107 Polish | 1 (`text.json`) | +3 −3 | 1 (cartridge untouched) |
| #110 Untime | 5 (1 new: `resources.json`) | +21 −22 | 1 (commits "Untime fix 1-4"; the record has no re-review section); `resources.json` came in that round |

## Carries (each in its [ROADMAP](../ROADMAP.md) stage row)

- UI batch from this play, U7 first (a bug), U1-U6, U8, save-error flush left, Polish O-1: Playtest and tune.
- M1, quest from dialogue: its own row ([record](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
- P6 rerun N-1 (authority-rejection line): Presenter split.
- World parameters P6 (fixed seed), P6b row 14 touch-to-photon, the `kernel/ts` audit nits with the
  `target.ts:34` pointer, P5a replay without the key: R7/R8 for chapter one.
