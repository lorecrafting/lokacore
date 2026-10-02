# R6P human proof: the owner plays the Lantern by touch (2026-10-02)

The record for [pre-release-proof](../spec/pre-release-proof.md#evidence-required-to-finish-r6p)
:84. It holds no verdict; the Gate R6P reviewers rule on it. Owner words are paraphrased by the PM
and marked (paraphrased). The device rows are in the [P6 rerun](2026-10-02-r6p-rerun-iphone11/README.md).

## Build played

- **PM-recorded:** the owner played a clean Release build of `main` 64a2b12 on the iPhone 11.
- **Inspected:** `git diff --exit-code 73927a1 64a2b12 -- kernel lib mobile protocol cartridges`
  exits 0 (empty), so the code, protocol and cartridges are those of the measured build 73927a1.
  Cartridge content hash `9b0969438f5ddad877c88506ffe295c5084e3014d607ef0ba24c922ee5db2821`.

## Tester

**PM-recorded from session records, not owner words:** the tester is the project owner. Before this
play they read the R6P plan, the Lantern text in reviews and the UX notes, and played earlier Lantern
builds on the iPhone (the P5b install; P6b rows 13 and 14 on an instrumented build). They are not a
naive tester.

## Play, in order (owner words paraphrased)

- **G1, both choice paths by touch.** The owner played the leave path by touch and reported they
  could not find the lantern (paraphrased). The PM then sent the full route (Landing north to Green,
  east to Reed Bank, east to Lantern Shelter, tap [brass lantern] to take, walk back west, west,
  south) and said that the gate does not open by touch. The owner then wrote they had found the
  lantern, gave it to Bram and completed the story (paraphrased); it is unknown whether they used the
  route. After the PM asked, the owner played carry after Start over: "it worked" (paraphrased).
  Confusing interaction: the lantern is hard to find.
- **G3, quit at a choice, airplane resume, consequence.** The PM gave a step-by-step procedure (Start
  over, play to Bram's choice, airplane mode on, swipe the app away, reopen). Owner: the choice was
  still there and they could finish from it (paraphrased). The PM asked "what each ending changed, for
  example what the Landing says"; the owner read back the Landing text: carry gives "The ferry rocks
  at its rope. The search party will wait on Bram" (`room.landing.player_led`); leave gives "...The
  search party will go out with Bram and the lantern" (`room.landing.party_led`). The owner gave no
  explanation of the consequence beyond that text.
- **G2, touch feel (P6b row 14 carry), when asked (paraphrased):** taps and drags responded right
  away; no lag, no missed taps. But sometimes a joystick drag up or down moved the whole app into a
  sliding mode (a gesture conflict, U7 in the [ROADMAP](../ROADMAP.md) Playtest row).

## Authoring effort (inspected, from git)

Only #100, #107 and #110 touch `cartridges/lantern_proof` since the Early R7/R8 gate (bfc1b89).
Lines are JSON lines; time spent is null (not recorded).

| PR | Files | Lines | Fix rounds (review record) |
|---|---|---|---|
| #100 P3 | 13 new | +290 | 2 (cartridge text changed in both) |
| #107 Polish | 1 (`text.json`) | +3 −3 | 1 (cartridge untouched) |
| #110 Untime | 5 (1 new: `resources.json`) | +21 −22 | 1 (commits "Untime fix 1-4"; the record has no re-review section); `resources.json` came in that round |
