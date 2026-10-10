# Review: toolbox row G9, social verbs say, whisper, shout, engine half (loka-kgd.71)

- Branch `toolbox/m7-say`, head `49b5dca458533b6e1d4354cda399f7ac6c47222b`, base `origin/toolbox/batch-m7` `322513f7` (merged in; 58 files). No PR (batch model); the developer's `/code-review medium` result is in the Beads `loka-kgd.71` handoff. This is a contract slice (commands, input, event, schema, capability, `kernel_api` 1.48), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [social verbs](../system/mechanics.md#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half), [speech declarations](../system/cartridge.md#speech-declarations), [G6 walk](../system/mechanics.md#sense-cues-sound-smell-and-heat-toolbox-row-g6), [save](../system/save.md), toolbox [trap 9](../MECHANICS-TOOLBOX.md#traps), ADR-075 §6 amendment A5 (archived, in force).
- Hosted ci and book-e2e green on the head (PM).
- Verdict: **CHANGES REQUIRED** (one blocker: test gaps, three surviving mutants on spec'd rules; two should-fix).

## Must be true

1. The typed word is untrusted: every path refuses it unless it is a string of 1 to 32 ASCII letters, then case-folds it before use; it never reaches narration; an event carries only an authored keyword.
2. Whisper: only the addressee, a living NPC in the room (else `not_present`; not an NPC `not_found`). Say: each living NPC in the room. Shout: each living NPC within one exit through G6's walk (hidden exits block, closed doors pass). EntityId order.
3. A keyword dialogue opens only by say or whisper of its word (first by key whose speaker hears and answers); talk never offers or opens it; a shout opens nothing.
4. No speech while the actor's conversation is open, and the view and the step agree.
5. `speech@1` opt-in; keyword and `spoken` trigger need `speech@1` and 1.48, keyword plus riddle refused; TS loader and Elixir compiler agree; `invalid.json` additions only.
6. Chapter 1 bytes, receipts, sim pins unchanged; the new artifact is pinned.
7. A say-opened dialogue row survives a phone save and reopen.

## Proof

- (1) Kernel `step` (raw Command, schema skipped): `5`, `['ward']`, `''`, `"ward\n"`, 33 letters, missing: all `invalid_state`; 32 letters accepted; `WaRd` opens `elder_ward`; `hello` gives events without `word`; no narration. Phone `story.invoke` (real boundary): `5` invalid_type, `wörd`/`"ward\n"`/33/`''` pattern_mismatch, `{}` unsupported_capability. Elixir schema uses `:dollar_endonly` (`lib/loka/core/contracts.ex:129`), so `"ward\n"` agrees with JS.
- (2) Whisper to the watchman next door `not_present`, to a non-NPC id, `__proto__` or junk `not_found`. Hidden-exit mutant in `senses.ts:47` caught by `senses.test.ts`.
- (5) `invalid.json` +199/-0. Mutants E1-E4 (Elixir floor 1.47, riddle check, spoken floor 1.47, `owned` dropped) all red in `content_speech_test.exs`; T1-T4 (TS twins) all red in `speech.test.ts`. Diag paths differ by kernel as for the existing floors.
- (6) Head `mix loka.compile cartridges/ashmere_missing_child` sha equals `missing_child_v042_hash.json` (handoff claim backed). Only additions under `protocol/fixtures`. `content_speech_test.exs` pins the speech artifact; `transcripts.test.ts` replays `speech.jsonl` against it (asserts a KAT for every transcript).
- (7) Throwaway real-SQLite test (scars harness): say WARD, reopen: the prompt is restored; same invocation replayed: stored receipt, same continuation; choose, reopen; shout, reopen: all open. **Decision: no committed phone save test required.** No reopen validator reads a row's opening command except `riddle-save.ts:89` (`openEvidence`), and keyword plus riddle is refused by both compilers; `checkRow` and `committedDialogue` read the row and its Choose receipt only; `dialogue_hub.test.ts` already reopens dialogue rows opened by a non-talk command (choose).
- Red control rerun: `typeof` guard removed from `folded`: `speech.test.ts` fails with a TypeError (handoff claim backed).
- Behaviour mutants (`speech.test.ts`): red: regex dropped, sort dropped, view pending filter dropped, depth 2, whisper heard by room, shout kept in room, talk ignoring `keyword`, unauthored word echoed, no case-fold, shout opens, `answer` ignoring hearers. Survived: M1, M3, M5, M12 below.

## Findings

1. **blocker** (suite green under core mutants; handoff says "12 behaviour mutants all red"):
   - M3 `kernel/ts/src/mechanics/speech/shared.ts:26` `living(w, id)` dropped: green. Scenario: a slain watchman (corpse stays in the watchhouse) still fires its `spoken` reaction on a shout of "help", and a dead elder still answers "ward". No test has an NPC with hp; the brief names dead NPCs.
   - M12 `kernel/ts/src/mechanics/speech/rule.ts:16` `not_present`/`not_found` swapped: green. Scenario: a whisper to an NPC in the next room reads `not_found`, against mechanics.md.
   - M1 `shared.ts:15` `{1,32}` to `{1,31}`: green. Scenario: a legal 32-letter keyword can never be said. Fix: one case each.
2. **should-fix** `kernel/ts/play/text.ts:97`: `loka play` builds a `say`/`shout` Command from any token. `say x9` crashes the CLI (`obs.ts:26` "invalid observation record ... /data/command/payload/word pattern_mismatch"), and ADR-075 A5 requires rejecting free text before the Command. Fix: answer a host message unless the token matches `^[a-z]{1,32}$`.
3. **should-fix** `docs/system/mechanics.md:2205` vs `kernel/ts/test/speech.test.ts:204`: the spec says speech while a conversation is open is `invalid_state`; Step returns `unsupported_capability` (admission, the verb is not offered), and the rule guard at `rule.ts:13` is unreachable through Step (M5 green). Scenario: a client written to the spec expects `invalid_state`. Fix: state the observed code and pin it in the test.

## Not checked

Sim generator emitting word-less say/shout (filed P3 by the PM); Book half (`loka-kgd.72`); mobile full suite; Elixir compose differential beyond hosted CI.
