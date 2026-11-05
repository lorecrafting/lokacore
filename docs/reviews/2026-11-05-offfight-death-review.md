# Review: a death outside a fight shows the dead page, then Let go (PR #634, loka-kgd.210)

- PR: [#634](https://github.com/lorecrafting/lokacore/pull/634), branch `fix/offfight-death`
- Reviewed commit: `1b02c538623ebe3a3797aaea6b61ae4e3064b798`
- Governing: [book-ui.md](../system/book-ui.md) line 133, Falling and Dead page; [spirit-state-rulings.md](../design/spirit-state-rulings.md) (owner option B, the slice tests); [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 1b02c53...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.
- Verdict: **CHANGES REQUIRED** (one blocker).

## Must be true (written before the diff)

1. An off-fight death shows the dead page. It has the died-in room's title, that room's kept log ending with the receipt's lines, and no paragraphs. The status row is hidden, including while catching up.
2. A death that closes an encounter keeps the Combat page.
3. Let go turns to the recovery room, its log cleared and then opened with the receipt's lines. With revival the player enters the spirit state. With a scene open the scene shows and there is no spirit state.
4. A reopen or a fault shows the recovery room solid.
5. No new player-facing words.

## Checks that held

- Item 2: when `s.closing` is set, `fall` sets `s.fell = s.ended`. The test "a death that closes a fight keeps the Combat page" passes.
- Item 5: DeadPage uses `LABEL.letGo`, and the catalogue keeps its wording.
- Title and log until Let go: `s.room` and `s.down` (`spirit.ts:42`) hold them, and so do the probes.
- Fault (open item 1): the spec says "A fault ends the dead page the same way". `spirit.ts:51` follows it and a test covers it. Not a finding.
- PR-body cites rerun and backed: `Body.tsx:73` set to `if (false)` fails 6 tests; `presenter.ts:268` changed to `said ||` fails 2.
- Hand mutants: `read` set to false in `letGo` fails 3 tests. Dropping the `s.down` guard at `logs.ts:205` fails 1.
- Screenshots kgd210-1/2/3: the World page, then the dead page "Burrow" (bleed lines, "You fall.", Let go), then the spirit "Shrine" page with the Rise ring. They match the spec layout. The demo receipt has no waking line, so the full line order is shown by the unit tests only.
- The headless-demo canvas error is pre-existing. By code reading, `PageTurn.tsx:163` calls `warm` before the size is known, and this PR leaves that file unchanged.

## Mutants

`bin/mutate_diff.sh origin/main` ran 36 mutants: 28 red-narrow, 8 SURVIVED, no TIMEBOX rows. This matches the handback. The survivors at Body:73 and presenter:268 turn red under the hand mutants above.

## Findings

1. **Blocker (open item 4).** At `mobile/app/book/DeadPage.tsx:39`, `<LogLines lines={p.log} />` draws the live log. Lines that arrive after the death therefore land on the dead page.
   - Failure scenario: die in the cellar with a shrine revival, then publish the line `road.crows`. The page then reads "The cellar … You die. You wake at the shrine. Crows lift off the road. Let go". That is a recovery-room line under the died-in room's title.
   - This breaches the Dead page rule: the log ends with the receipt's lines, and the recovery room is not drawn until Let go.
   - Fix: stop the drawn log at the receipt's end, as `logs.ts:205` already does for cues. Add a test that publishes a line after `die` and asserts the line is absent.
2. **Nit, Beads (open item 3).** `updates.ts:115` turns the page only for a terminal update. A death in the same room while Contents, the Map or an NPC page is open shows the dead page with no page turn. The rule still holds. The reverse also happens: a death from a press on the World page turns the page (`Book.tsx:107`), where the spec says the page changes in place.
3. **Nit, Beads (open item 2).** A second death before Let go draws "The shrine" with both receipts. The second death did happen in the shrine, and the case is rare.
