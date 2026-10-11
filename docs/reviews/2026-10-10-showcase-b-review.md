# Review: showcase slice B, Low Wardle and the hub's south exit (loka-y6yg.2, PR #367)

- PR #367, branch `toolbox/showcase-b`, head `09a3d28702af09c89bc6ca882e41f89cb47bfe40`, against `main` `52790db9`. Content and tests; the record is kept at the PM's request.
- Governing: [plan 1, social district](../showcase/hub-and-first-districts.md#social-district-low-wardle-slice-b), [SHOWCASE.md](../SHOWCASE.md#how-a-batch-adds-a-district) (Opus review against the brief), Beads loka-y6yg.2 (the #364 carry).
- Hosted CI on the head: ci `38096018155`, book-e2e `38096018190`, graph-diff `38096020811`, all success.
- Verdict: **CHANGES REQUIRED**: one blocker, three nits.

## Must be true

1. Every room, exit, fact, NPC, dialogue, recipe, quest and scene in the brief exists. Each step 1-14 outcome is asserted in `showcase_social.test.ts`, or in the app test for step 14.
2. Step 3 ("hp 5, chance 0: no damage; Flee or wait") leaves the district playable: an engagement may not cost the player the rest of the loop.
3. Waits longer than a day are allowed (loka-j2mo is merged). The merged waits assert the same results as before.
4. #364 carry: the accept is pinned at 07:00 on day 1, so step 11 chills (frost) rather than soaks.
5. The hash repin is the compiler's output for the new source.

## Findings

1. **Blocker, `cartridges/toolbox_showcase/cartridge.json:190-191`** (`player_attack.chance` 100), brief step 3.
   - Failure scenario: a fresh world, `wrong` twice, then walk east and wait. No attack command is needed: the engagement's rounds land the player's hits, and the Warden dies in 5 rounds (750 units, about 15 real seconds).
   - What follows, probed at this head:
     - `talk` to the Warden is rejected (`unsupported_capability`), so `toll_gate` never opens.
     - He has not returned by day 3.
     - The force recipe targets a tollhouse detail, and the iron door never opens.
   - So the tollhouse is out of reach for that save. The strongbox, "The mill" and "Wardle walker" are lost.
   - `showcase_social.test.ts:106-108` asserts only the engage.
   - Fix (probed): `player_attack.chance: 0`. The schema allows it (AttackProfile, minimum 0). The engagement holds and both sides miss for 10 rounds. Add a wait-while-engaged assertion that the Warden is alive, and note the value at brief:299.
2. **Nit, brief:373, `showcase_social.test.ts:238`.** "performing either" is not true from the church, where only the church card can be performed. Reword it, and cite loka-kgd.64 at both places.
3. **Nit, `quests/carry_letter.json` `hint_stone`.** If the letter is taken before the accept, the hint "lies on the moot stone" is false while the player holds it. This is recoverable: a probe showed that drop and take completes the objective. No change needed beyond the words.
4. **Nit, `text.json:295`.** The narration says "You drop the letter in the fire", but the letter stays in the pack.

Out of scope, for the PM to file: an NPC with `hp.minimum` 1 loads, then faults `evaluator_error` on the hit that would take it below 1. This is an engine issue, not part of this PR.

## Deviations

1. Mill by up/down: **accept**. The room schema exits are only N/S/E/W/up/down, and brief:253, 260-261 say so.
2. `iron_forced`: **accept**. The fact can never become true (the `fragile` leaf never holds), and the barrier needs an `opens_when` (`barrier_sampler`).
3. Combat block: **overturned**, see finding 1. The smallest fix is player chance 0.
4. Twin card: **keep the twin; do not drop it**. Brief:338 and :382 require the `hall_lectern` twin. It is pinned at :234-239. Cite loka-kgd.64 (finding 2).
5. Rain world: **accept**. The weather oracle checks out: SOCIAL days 1 and 2 are frost and rain; WET day 1 is rain; the release context has rain on day 6 only.

## Checks

- One-day-wait removal: brief:14-16 and the `showcase_fixture.ts` assert are gone. Body 13 and world 8 and 9 keep their assertions; hosted ci is green.
- The #364 carry is asserted at `showcase_social.test.ts:265` (clock 07:00), :287 (chilled), :288 (15000) and :290 (hp 9, 7800).
- Hash: sha256(canonical) equals the pin, and `content_showcase_test.exs` ties the source to those bytes.
- Mutants on the pinned canonical, restored after each run:
  - Tam's rain case changed to frost: social 8, 8-rain and 9 fail.
  - Deadline 63000: social 10-13 fail.
  - `walker_mill` without the church: social 8 fails.
- Claims from the PR body, rerun:
  - Without `letter_late`, social 13 and 14 fail. Backed.
  - Without `recap_after_minutes`, social 14 fails. Backed.
- The PR body reports `/code-review medium`.

## Re-check at `331cce1660b1e0f16a64bfed16a01d7429b174e2` (fix commits `661cdcf1`, `331cce16`)

- Hosted CI on the head: ci `38097116959`, book-e2e `38097116979`, graph-diff `38097120773`, all success. Focused run: `showcase_social.test.ts` 15/15. sha256(canonical) equals the pin.

### Dispositions

1. Finding 1 (blocker): **fixed**.
   - `cartridge.json` now sets `player_attack.chance` 0.
   - Social 2-3 (`showcase_social.test.ts:110-119`) waits 10 rounds and then asserts the Warden is still engaged. It then walks flee, `help`, `reason`, open east and into the tollhouse.
   - Red control: with chance set back to 100 in the pinned canonical, social 2-3 fails at `:113`.
   - Brief:306-310 records the rule.
   - The flee-first path is sound: talking to a hostile Warden is `invalid_state`.
   - Played in the Book harness: after the walk east the page offers only Look and Flee, still does after 30 real seconds, and Flee returns the player to the green.
2. Finding 2: **fixed**. Brief:378 and test:249-250 cite loka-kgd.64; the twin is kept.
3. Finding 3: **accepted as is** (the hint words stay; drop and take recovers).
4. Finding 4: **fixed**. `text.json:295` now says "hold the letter to the fire".

### PM's open questions

- The "ash" texts (`text.json:341`, `:410`) say the letter is burnt while it stays in the pack: **accept as a known limit**. The brief makes `burn` narration only, and a held letter changes nothing once the quest is resolved.
- The player hit and NPC-death lines can no longer be reached: **accept**. The combat block needs the keys, and the combat district will use them.
- "Terminal player cannot wait, move or flee while engaged": not reproduced in the Book, where Flee is offered and works. I did not check the terminal client; if it has no Flee, that is a client gap, not this slice.

### New finding, outside the fix commits

**Should-fix, `mobile/app/book/showcase_recap.test.ts:19`.**
- `b.tap(...)` takes a single argument (`polish-book.test.ts:178`), so this call only goes south. The Reeve's quest is never accepted.
- Brief step 14 says to accept, and the test header says the test catches a recap that "shows the deadline".
- Failure scenario: if the deadline job started narrating a line, the test would stay green.
- Fix: tap each control in turn: `'The Reeve is here., open'`, `/^Talk/`, `'Take the letter to Wat'`, `'Leave the conversation'`, then `'Leave'`.

Verdict: **APPROVE WITH NOTES** (one should-fix: the recap test's accept).
