# Review: content colon sweep and colon_labels lint, PR #525 (loka-pxa0)

- PR [#525](https://github.com/lorecrafting/lokacore/pull/525) at `117468f9d85b3782ef65f8a70222d4d003ada900`, diff `origin/main...117468f9d` (main at `ca954938e`).
- Governing: `br show loka-pxa0` (owner quote 2026-10-30); [book-ui.md:323-338](../system/book-ui.md) (novel prose, no colon label; dialogue `Nell says to you, "..."`; a self-attributed line kept as written); [CHECKS.md](../CHECKS.md) `mix loka.lint`; AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work. Record on PM request (not a contract slice).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, three nits).

## Must be true (written before reading the diff)

1. No sentence-opening `Label: value` or `Name: speech` line remains in any cartridge's lowered text (text.json plus inline prose).
2. Rewrites keep keys, meaning and quoted speech; narration second person, present tense; speech `X says (to you), "..."` or self-attributed.
3. The lint refuses one-word `<word>: ` labels on every cartridge and fails on a planted one; its tests kill narrow mutants.
4. Fixtures, transcripts and story views are regenerated, not hand-edited; kernel_api and every `at_least` unchanged.

Results: 1 holds (own sweep of every cartridge via `Source.load`: 31 colon strings remain, all mid-sentence prose; inline prose lowers into the same `text.json` map, `lib/loka/content/prose.ex:5`). 2 holds except finding 2. 3: finding 1. 4 holds: `sh bin/regen.sh` at the head left a clean tree; no `cartridge.json`, schema or kernel source in the diff.

## Findings

1. **Blocker, `lib/loka/content/lint.ex:255`** (`["”’]?`, a label opening the sentence after a closed quote). Mutant: drop `["”’]?`. The whole `content_lint_test.exs` stays green. The mutant is not equivalent: `You say, "Hush." Price: a penny.` is refused at the head and passes under the mutant. None of the developer's eight mutants touched this branch. Fix: add that string to the bad list at `test/loka/content_lint_test.exs:180-186`.
2. **Should-fix, `cartridges/toolbox_showcase/text.json:1677`, `cartridges/codex_sampler/text.json:25`** (meaning kept). The badge labels lost "you have walked green, gate, tollhouse, mill and church" and "you have visited all five rooms". Nothing else carries that text. The walker and wanderer reactions only assign the fact; the earning step in `walk_social.jsonl` has only `move`, `entity_entered_room` and `fact_changed`, no narration. Scenario: the player reaches the church and Lore shows "Wardle walker", with no line in the game saying what earned it. Keeping the label a title is right, because it also labels Ask-about cards. Fix: a narrate step on earn in the badge reactions, for example `You have walked green, gate, tollhouse, mill and church.`
3. **Nit, `lint.ex:255`, false negatives.** These pass the lint:
   - `Nell lowers her voice: ale's a penny.`, the four-word lead-in form the issue names.
   - `You climb the stair; Nell: ale's a penny.`, a label after `;`.
   - `(Cooking: learned)` and `—Cooking: learned`.

   The developer declined a wider rule; the record keeps the gap visible.
4. **Nit, `lint.ex:255`, false positives.** The lint refuses ordinary prose: `It burns: you drop it.`, `You wait: nothing happens.` and `One word: flamma.`. It also refuses speech inside quotes after a period: `Nell says to you, "Wait. Listen: the tide turns."`. The PR body says speech inside quotes is the speaker's own, but only a label straight after the opening quote is exempt.
5. **Nit, `cartridges/trial_sampler/text.json:31`.** `reads the charge aloud: wanted in the square.` is left because `mobile/app/book/arrest.test.ts:37` pins it, yet the showcase twin of this line was rewritten. A one-string test edit is not barred by AGENTS.md.

Meaning checks (settled): the ancestry lines (`Broad shoulders give you strength 15.` and the others), the Nell lines (self-attributed, `narration` of a dialogue choice, no speaker binding), the guard and watchman lines, the fast_travel boards, `"Antidote."` and `You are too late;` all keep their meaning and quotes.

## Test the tests

- `bin/mutate_diff.sh origin/main`: 0 mutants (0 run), matching the handback.
- Planted `Cooking: Learned.` in `derived_sampler` `ancestry.hardy.description`: red, "every cartridge's ... label rules".
- Mutant `{0,2}` -> `{1,2}` (one-word labels pass): red, the new test at `:187`.
- Mutant drop `["”’]?`: SURVIVED (finding 1).
- Claim rerun: "High tide: ..." restored in the showcase makes two tests red (baseline and label rules): backed.
- Claim rerun: `arrest.test.ts` pins the trial_sampler charge verbatim (`:37`): backed.
- Focused runs at the head, all green:
  - `mix test` content_lint, content_showcase, content_derived_sampler: 24 passed.
  - kernel/ts transcripts, codex, trial, showcase_social.
  - mobile `book/arrest`, `book/readable`.

CI on `117468f9d`: ci, book-e2e and graph-diff all success (one `gh run list --commit`). The PR body reports `/code-review medium` (9 findings).
