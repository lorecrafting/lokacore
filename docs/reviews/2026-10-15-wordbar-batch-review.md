# Review: word bar batch head (loka-x6t.39: S1 loka-jsqq, S2 loka-1lpq, S3 loka-a9pn)

- Branch `toolbox/batch-wordbar`, exact head `5259f08eda7774c38bbcb6f10bf7d144190a1bc5`, base `43ee6605` (diff `43ee6605...5259f08e`). No PR (batch model); every slice already reviewed, this is the cross-slice batch-head review only.
- Governing: owner rulings in `br show loka-x6t.39` (2026-10-14: touch-first, keyboard only for Say behind a control, cast = learned words only, ask never in the bar); [book-ui.md Word bar and FD7 Ask](../system/book-ui.md); [mechanics.md 29a/29b/G4](../system/mechanics.md); [cartridge.md Spells/Speech/Phrases](../system/cartridge.md); [realm seam 6](../decisions/owner-decision-realm-seams-2026-10-13.md); [reviewer stance](../../.claude/agents/reviewer.md).
- Verdict: **APPROVE WITH NOTES** at 5259f08e.
- Written 2026-10-15 by anthropic/claude-fable-5-1.
- Known, not reported: loka-j64e (learned-but-not-castable shows "not now"); the S2 seam-1 cast test owed by the Realm second-actor row.

## Must be true (written before the diff)

1. Held tool page: one card per available use pair, "<label> <target name>", `target_ids [target, tool]`, kept on the tool's page; the target's page has none; no duplicate with any other card.
2. NPC page: Ask about cards only (FD7); no whisper card there; the Word block sits on the World page after the action cards and before the log; ask is never a chip.
3. `spell_words` = learned spells only, availability = cast admission; `phrases` static. The Book's Cast chips are exactly the available `spell_words` (refused ones shown with their reason, not pressable); Say/Whisper/Shout chips = `phrases`; a whisper row only per NPC offering whisper; the wordless Say press is never sent.
4. Unlearned words never in GameView, Book text, refusal reasons (code only), logs, stories or fixtures.
5. Seam 6: a typed word is never echoed into the page or log; speech@1 commands unchanged.
6. Owner rulings (above) met end to end.
7. loader_floors 1.98 cases for spells and speech.phrases; invalid.json covers the phrases and learned schema floors; transcripts hold known answers; `WordBar.stories.tsx` is discovered by `storybook:smoke` (`.storybook/main.ts:82`) in book-e2e.

Holds: 1 (`view/use.ts:30-47` lists pairs under the tool only; `buttons.ts:198-203` sets `detail_id` to the tool; `model.ts:135` routes by `detail_id`), 2 (`model.ts:108` keeps WORDS out of page cards; `buttons.ts:121` ask cards carry `target_ids [npc]`; `pages.tsx` draws `word` after actions, before the log), 3 (`buttons.ts:142-176`; `WordBar.tsx:28` draws the wordless press only as the Type a word control; `word_bar.test.ts:80-97`), 4 in code and samplers (`view/spells.ts:30` emits a code only; `spells.test.ts:234,261`; no unlearned word in transcripts or views), 5 (`word_bar.test.ts:97`; no diff under `kernel/ts/src/mechanics/speech` or `commands`), 6, 7 (`invalid.json` 23990-24046 for learned; `loader_floors.json` 1.98; `speech.jsonl` re-run with the new content hash). Item 4 fails in one story (finding 1).

## Test the tests (scratch worktree, focused files, each reverted)

| Mutant | File | Result |
| --- | --- | --- |
| m1 learned check dropped from `spellWords` | `kernel/ts/src/view/spells.ts:22` | `spells.test.ts` fails ("lists learned spells only"); `word_bar.test.ts` fails too (Book tests run the real kernel) |
| m2 refused cast word drawn as a chip | `mobile/app/book/buttons.ts:173` | `word_bar.test.ts` "refused ones carry their reason" fails |
| m3 pair card names the tool, not the target | `mobile/app/book/buttons.ts:200` | `use_on.test.ts` "bucket offers Quench a cart" fails |
| m4 word chips land on page cards (`group` WORDS filter dropped) | `mobile/app/book/model.ts:108` | `word_bar.test.ts` two tests fail |

Re-run header claims (no PR body): `spells.test.ts:261` "every available spell_words entry casts" and `use_on.test.ts` "each press is admitted" pass at this head. Hosted CI at 5259f08e: `ci` and `book-e2e` success.

## Findings

1. **Should-fix.** `mobile/app/stories/WordBar.stories.tsx:49-57` (`CastWithRefusedWord`). The fixture puts a word the text key calls unlearned (`spell.ignis.unlearned`, "Not yet learned.") into `spell_words` with a `reason.message` the kernel never sets (`view/spells.ts:30`; `gameview.schema.json` SpellWord: "one learned spell's word"). Failure scenario: Storybook is the Book's source of truth (loka-bhb); a polish session or the owner takes the story as behaviour and expects a "Not yet learned" chip, which contradicts the ruling "cast = learned words only" and the no-leak rule for stories; the real page shows `<word>, cast: <code text>` (`word_bar.test.ts:103`). Fix: make the refused word a learned one with a reason the kernel can give (cost or cooldown code, no message), keeping the story's own break ("refused word dropped or shown without its reason").
2. **Nit.** `mobile/app/stories/WordBar.stories.tsx:13` names the wordless press `'say'` while `buttons.ts:150` labels it `', say'`; harmless because `WordBar` keys on the missing `input.word`, but the story's chips are not the Book's.

Disposition: finding 1 is a story fixture, no code or contract change; fix in the batch or file it against loka-x6t.39 before ready.
