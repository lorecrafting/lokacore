# Review: toolbox row 29a, spell cast admission (loka-kgd.81)

- Branch `toolbox/m8-spells`, head `1529a59d3e72e6f58131c56ea5cfbb0e350f3713`, diffed against merge-base `dfd2a8a0` with `origin/toolbox/batch-m8` (44 files). No PR (batch model). Contract slice: `RecipeTarget` kind `spell`, `cast` command, `level_compare` leaf, kernel_api 1.51.
- Governing: [toolbox row 29a](../MECHANICS-TOOLBOX.md#ranked-toolbox) and design note 5, [spell cast admission](../system/mechanics.md#spell-cast-admission-toolbox-row-29a), [spell declarations](../system/cartridge.md#spell-declarations), [composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.81`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix for a PM ruling, two nits).

## Must be true (written before the diff)

1. Light from reagents and mana: a cast pays both, and is refused with no change when short of either.
2. Ward needs a quest-taught word, a level and a stat; each gate is enforced separately.
3. An unknown word and an unlearned word are refused the same way; no refusal, view or event shows which words are spells.
4. A secret word from lore works after it is read; typed case does not matter.
5. Both kernels apply the same content checks: the kernel_api floor and unique words.
6. Cartridges without spells keep their bytes and GameView. Chapter 1 does not change.

## Proof

- Focused baseline green: `spells.test.ts`, `speech.test.ts`, `use.test.ts`, `tags.test.ts`; `content_spells_test.exs`, `content_use_test.exs`.
- Chapter 1: `ashmere_missing_child` compiled at the head gives `5d8b0e3a…fc8b`, the pin at `mobile/app/chapter.test.ts:141`.
- Rejections are the same: a throwaway probe compares `cast xyzzy` with the unread `cast noctis` on a fresh world. Both decisions are `{"kind":"rejected","error":{"code":"invalid_state"}}`, the step result has no other fields, and the query-step count is not shown.
- Mutants, all red: castAdmission without its policy check (`spells.test.ts`), `level_compare` `>` for `>=`, spells kept in `keyed`, Elixir duplicate words `> 2` and Elixir level floor 1.50 (`content_spells_test.exs`, `mix test --force`). The first mutant is also the planted red control.
- Two claims rerun. "Item consumption is food@1-only" holds: `kernel/ts/src/foundation/compose.ts:257-260` (edible or bandage). "Chapter bytes unchanged" holds (see above).
- Book: `mobile/app/book/buttons.ts:124` and `:172` drop any action with an input, the same path as say, whisper and shout. `spells_sampler` is not in the Book catalogue, so a green book-e2e says nothing about cast; nothing breaks, and nothing is shown.
- Receipts: the typed word is bounded by `^[a-zA-Z]{1,32}$` (`action.schema.json` Word), the same as say, whisper and shout. Accepted events carry the recipe key, not the word. This is not a privacy regression.

## Findings

1. **blocker**, `kernel/ts/src/commands/actions.ts:101`: mutant: the cast offer filter replaced by `true`, so cast is offered in every cartridge. These stay green: `speech`, `world`, `use`, `missing_child_finale`, `journal`, `showcase_world` and `e1_cases`, and no golden pins the engine verb list. Failure: Chapter 1's GameView gains an available `cast` action, against the Opt-in clause ("Cartridges without spells keep … GameView (no cast verb)"), and no test notices. Fix: one assertion that `cast` is absent from a cartridge with no spells.
2. **should-fix (PM ruling)**, reagents as pools (`docs/system/mechanics.md:2268`, `cartridges/spells_sampler/resources.json`). Row 29a's acceptance ("light from reagents and mana") is met as written. Design note 5 asks for "reagents consumed (the crafting input consumption)", and no such primitive exists outside food@1, so this is a scope reading and the PM must rule on it. A concrete cost follows: a reagent pool is a body resource, so the GameView lists `ash` at 0 as band `dying`, tone `danger` (`kernel/ts/src/view/resources.ts:21`; probe on a fresh sampler world). Every cartridge that follows the documented pattern shows its reagents as a vital meter. The PM should either accept pools and record in the row that item reagents wait for `loka-kgd.83` (adding the meter problem to `.83` or `.82`), or hold 29a until `.83` is done.
3. **nit**: there is no PR, so the `/code-review medium` result is only in the Beads notes. Carry it into the batch PR body.
4. **nit**, `kernel/ts/src/commands/actions.ts:162`: a room contribution that names a spell key compiles (`contributions` accepts any recipe key) and is silently dropped (`Object.hasOwn(all, k)`). Failure: an author's `add: ["lux"]` does nothing and gets no diagnostic.

Not checked: whether TS `nodes()` (`cartridge_refs.ts:109`) and Elixir `leaf?` (`levelling.ex`) reach every policy site alike for the 1.51 floor. The walker is the shared one that the variety floor already uses.

## Fix re-check at 94537eb8

- Head `94537eb8bda734968e4f986ae306f2e06f031998`: fix `0de8b2da` plus the merge of `origin/toolbox/batch-m8` (W21 fear 1.50, loka-6ql4). Hosted ci and book-e2e are green. Only the fix commit, the code it touched and the merge resolution were reviewed.
- Finding 1 (blocker), resolved: `spells.test.ts` compiles `ashmere_missing_child`, chooses an ancestry, and asserts `look` is offered and `cast` is not. Rerun mutant (filter set to `true`): red.
- Finding 2 (PM ruling), resolved: pools are accepted. The row cell, `mechanics.md` (Admission) and `loka-kgd.83` record the ruling and the meter note.
- Finding 4 (nit), resolved: both kernels refuse a spell key in a room contribution with UNRESOLVED_REFERENCE at the same contribution entry (`cartridge_recipes.ts` `contributions`, `recipes.ex` `known/2`). Mutants: TS filter dropped (red, `spells.test.ts`); Elixir spell guard dropped (red, `content_spells_test.exs`, `--force`).
- Finding 3 (nit): still open; carry the `/code-review` result into the batch PR.
- Merge: TS `INSTALLED.kernel_api` is `1.51` (`world.ts`). `invalid.json` holds exactly the union of both sides (898 base, +7 spells, +2 fear = 907; none missing, none extra, no duplicates; parsed and compared). `mechanics.md` has the fear section, then the spell section, both whole. Focused tests are green: `spells`, `fear`, `validate`; `content_spells_test.exs`, `content_fear_test.exs`, `contracts_test.exs`.
- Verdict: **APPROVE WITH NOTES** (nit 3 open).
