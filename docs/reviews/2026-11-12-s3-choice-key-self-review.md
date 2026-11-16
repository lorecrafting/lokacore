# S3: a choice's key, pinned when its words change (self-review)

Written 2026-11-12 08:10 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017.

**This is NOT an independent review.** [WORKFLOW.md](../WORKFLOW.md#lean-default) asks a grammar
change to take a fresh reviewer. None could be found: Anthropic OAuth expired, OpenRouter had no
credits, Antigravity was rate-limited for ~4.8 h, and the owner directed that this session do its
own review with the one available model. Treat every judgement below as the author's. What it can
still carry is the evidence: the findings below were all found by re-reading the code and running
it, and two of them would have shipped.

- Beads: `loka-wfrgk.100.5.3` (S2, #707), `loka-wfrgk.100.5.4` (S3, #715)
- Slice head reviewed: `dd9878cc5` plus the self-review fixes in the commit that adds this record
- Governing spec: [scene-structure-rulings.md](../design/scene-structure-rulings.md) §2, §3, §4

## What the slice does

A `- ` line may end with ` #<key>`. The compiler keys the choice by it and the label's words are the
line without the suffix (`lib/loka/content/scene_lines.ex` `choice_key/2`, `label/1`,
`@explicit`). The card's choice-words field rewrites the words and pins the key the line already had
in the same line edit (`kernel/ts/play/scene_choice.ts` `rewordedChoice/4`), so no referrer moves.

## Findings from this self-review

1. **`scene_choice.ts` shipped with a malformed doc comment** (`export /**` mid-comment), so the
   `reword` docs attached to the `Row` type and the function had none. Cosmetic, but it is the kind
   of thing that only survives because a reviewer never read the file. Fixed.
2. **A duplicate orphaned comment** above `KEYLINE` in `kernel/ts/play/scene_structure.ts`, a
   leftover from moving `Row` into the new file. Fixed.
3. **A spec deviation, the one that mattered.** §2 ("Hand-written `- ~` choices") says writing words
   into a `- ~` pins `#choice_<n>` when the choice has no referrer yet, and its current `#todo__<n>`
   otherwise. The code pinned `todo__<n>` unconditionally, and two tests asserted that wrong
   behaviour, which is how it survived the earlier review round. Fixed: `reword` now takes `refers`
   and asks `freeKey` for a key when the placeholder is unnamed; the route passes `inUse`. Tests
   updated in `kernel/ts/test/scene_op.test.ts`, plus a new route test that plants a twin entry on
   `todo__8` and asserts the reword keeps `#todo__8`.
   - Mutation check: dropping `&& !refers(held)` makes the new route test fail (400 where 200 is
     expected). Restored and re-run green.
4. **A size exemption was papering over a misplacement.** `scene_structure.ts` carried
   `// size: allow 310`; `rows` builds the `Row` type defined in the new file, so it moved there and
   the file fell to 291 lines with the marker deleted.

## Judgements I asked an independent reviewer for, answered by me

- **Is `rewordedChoice` right for each key source?** Explicit suffix keeps its suffix; slug pins
  `#<old slug>`; `~` keeps `todo__<n>` when referenced and takes `choice_<n>` when not. Verified by
  running it: `- ~` at line 4 with no referrer → `- Go north #choice_1`; `- Take the ring` →
  `#take_the_ring`; `- Take the ring #ring1` → `#ring1`.
- **Is the file split sane?** `scene_choice.ts` holds the key rules and `rows`, and re-exports
  through `scene_structure.ts`, so the card and the route keep one import site. The split was forced
  by the 300-line limit. Rather than leave the `// size: allow 310` exemption the earlier commit
  added, `rows` moved next to the key rules it belongs with, which brought
  `kernel/ts/play/scene_structure.ts` to 291 lines; `bin/check_ts_size.mjs` reports nothing for it
  and the marker is gone. `KEYLINE` had to stay behind: `edit` reads it too.

## Evidence run for this record

- `sh bin/related_tests.sh . HEAD` → `RELATED_TESTS_ok` (scene_card, scene_op, scene_structure)
- `mise exec -- mix test test/loka/content_scene_choice_key_test.exs --force` → 2 passed
- `MIX_ENV=test mise exec -- elixir bin/contracts.exs --check` → exit 0
- `npx tsc -b` in `tools/author-panel` → exit 0

## Known gaps, not fixed here

- **A choice with no referrers that is reworded keeps a `todo__`-shaped key if it was already
  written by hand.** Only the `~` case is handled; a hand-written `- Words #todo__9` is left alone,
  which is right (an explicit key is explicit) but means `todo__` keys can persist in content.
- **`branch_setup`'s key-survival guard was deleted** rather than left dead; nothing asserts that a
  *slug* choice with referrers cannot lose its key on a reword, because the pin makes it
  unreachable. If a future op rewrites a `- ` line without pinning, that guard is needed again.
- **The `.cut` page rules in §1 are S4's**, not covered by this slice or this record.

## What an independent reviewer should still look at

The `refers` predicate is built from the twin's `choices` plus a walk of the compiled artifact for
`choice_id`, `outcomes` keys and `choice_resolved`. That walk is not itself tested against a riddle
or a quest outcome; the tests use a twin entry. Whether the walk covers every referrer the ruling's
table lists is the one substantive question this self-review cannot settle.
