# Review: dialogue lines bind their speaker, PR #514 (loka-548k, kernel_api 1.122)

- PR [#514](https://github.com/lorecrafting/lokacore/pull/514) `feat/548k-dialogue-speaker` at `858ac3978668454ba246637078fc65be861de85d`, diff `origin/main...858ac3978` (main at `993a4947b`, #512 merged).
- Governing: "BRIEF loka-548k" with the PM route A ruling and handoff notes (`br show loka-548k`); epic `loka-ewtx` notes (kernel_api by merge order, "keep the higher version"); [dialogue@1](../system/mechanics.md) talk/choose and Ask about a topic; [Book UI](../system/book-ui.md) Line placement; [forward development](../decisions/owner-decision-forward-development-2026-10-05.md) (explicit release-pin refusal, Start over); AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, one question).

## Must be true (written before reading the diff)

1. Talk binds `actor` and `speaker` = the talk target; choose binds `speaker` = the dialogue's bound npc role, never re-resolved, never overriding a role binding.
2. The ask answer binds `speaker` = the asked NPC.
3. Conformance trace values (lantern-traces, adverse-cases) come from cartridge content, not from running the code; IMPORT.md and both kernels' SHA pins move together.
4. A save made before the change is refused at the release pin (Start over, `saves.test.ts:200`), never reopened as `save_corrupt`; so the content hash must change with the narration contract.
5. The local authority rebuilds the same `speaker` the kernel binds (`dialogue-receipt.ts`), or reopen fails.
6. The Book words a line as the speaker's only as the spec says, and book-ui.md states the rule before the code (AGENTS.md "amend docs/system before code").
7. No Book literal names content; the re-shown prompt in received/logs gets the same speaker as the live line.
8. Brief acceptance rows 1-4 met, including the 390 px showcase walk screenshot.

Results: 1, 2, 3, 5, 7 hold; 4 and 6 do not (findings 1, 2); 8 open (question 3).

## Findings

1. **Blocker, `kernel/ts/src/runtime/world.ts:108`** (kernel_api `1.122`, equal to main; showcase and ferry hash fixtures unchanged vs `origin/main`). The narration contract changed but the release pin did not, so a save made on main `993a4947b` keeps its pin and reaches `dialogueDetail`. Any choose that needs a receipt detail (riddle, escort, patrol, `skill.acquire`, exchange; showcase `aldous_lesson`, `cook_lesson`, `carpenter_lessons`) recorded narration without `speaker`; at the head `mobile/authority/local-story/dialogue-receipt.ts:83` compares against participants that now include `speaker` and throws, and the save opens as `save_corrupt`, not Start over. Demonstrated: a riddle save written with main's `rule.ts`, `ask.ts` and `dialogue-receipt.ts`, reopened at the head -> `Error: save_corrupt`; same save with main's code -> `REOPEN kind open`. The suite stays green because `saves.test.ts:200` covers a missing pin, not a same-pin save from before the change. The PR's "Accepted (pre-production): receipts saved before this change no longer rebuild" is the forbidden outcome, not a pre-production loss. Cause: the epic's "keep the higher version" rule collapsed 548k's 1.121 into tc2e's 1.122 when #512 merged first. Fix: a fresh kernel_api above 1.122 (`world.ts:108`, `cartridge.json`), then `bin/regen_hash_fixture.sh` and the hash repins. Open item for the PM: 1.123 is assigned to ysbt, so ysbt and oc5i renumber.
2. **Should-fix, `mobile/app/book/words.ts:196-199` vs `docs/system/book-ui.md`.** The PR body cites book-ui.md Line placement for "a quoted line with a named speaker is attributed", but book-ui.md on main has no such clause (it says an authored line keeps its own text) and the PR does not amend it. Open #513 (`book-ui.md:313-316` on `polish/session-2026-10-23`) says the Book "never parses quotes to add a speaker" and calls a bare quotation a content fix (loka-548k). Failure: once both merge, spec and code contradict each other on the same rule, and the next agent must stop and ask (AGENTS.md). Fix: the PM or designer reconciles the clause under the route A ruling and the Book UI text lands with or before this code.
3. **Question for the PM, brief acceptance row 4.** Does the handback carry the 390 px screenshot of the showcase reeve walk (`Reeve Hal says to you, "Well, stranger?"`)? It is not in the PR body, its comments or the Beads notes. The NpcSpeech story in `LogLines.stories.tsx` covers the wording through `lineWords`, not the live path.
4. **Nit, `kernel/ts/src/mechanics/dialogue/rule.ts:98`.** A role named `speaker` is not reserved by the compiler (only `actor` is); an authored role `speaker` is silently replaced in narration by the npc binding. No cartridge has one. Follow-up Beads: reserve `speaker` like `actor`.

Rated, no finding: `rule.ts:74` (talk names `p.target_id`, choose the bound npc role). `spoken()` and `bind()` resolve through the same entity map, so the target is the npc binding; the divergence needs two entities on one npc definition, which no path produces.

Composition record: not applicable; no new mechanic, `speakerOf` is shared inside dialogue, no capability code names content.

## Evidence

- `bin/mutate_diff.sh origin/main` at the head: 5 mutants, 4 red-narrow, 1 SURVIVED (`ask.ts:68` seq `1`->`2`), the same as the handback table (which clears that row with a hand mutant).
- Hand mutants, each run alone against the importing test file and reverted:
  - M1 `rule.ts:74` talk drops `speaker` -> `dialogue.test.ts` red ("talk opens one pending choice ...", 1 fail).
  - M2 `rule.ts:93` choose `speaker` = the actor's body -> `dialogue.test.ts` red (2 fail: "leave hands the lantern to Bram ...", "choose pins the row bindings ...").
  - M3 `words.ts:198` regex straight quotes only -> `book/speech.test.ts` red ("a line wholly one quotation ...").
  - M4 `dialogue-receipt.ts:74` drops the `speaker` entry -> `hidden_skill.test.ts` red (2 fail).
- PR claims rerun: "talk drops speaker -> red (kernel dialogue tests)" (M1), "receipt drops speaker -> red (hidden_skill ...)" (M4) and "Book regex `^"` only -> red (speech.test.ts)" (M3); all backed.

- Traces: lantern-traces `bram_offer.prompt` 22, `proof.accept` 20, `bram.prompt` 4, carry 1, leave 1; adverse-cases `bram_offer.prompt` 40, accept 39, `bram.prompt` 38, leave 15; every one carries `speaker: bram`, movement and item lines none. Source `cartridges/lantern_proof/dialogues/{bram,bram_offer}.json` (npc `bram`, role `bram:npc`). IMPORT.md SHAs `9f9ff623…`, `627b1e88…` match `shasum -a 256`.
- `/code-review medium` reported in the PR body.
- CI (`gh run list --commit 858ac3978668454ba246637078fc65be861de85d`): graph-diff, ci, book-e2e success.
