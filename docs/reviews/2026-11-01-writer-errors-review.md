# Review: writer errors, PR #585 (loka-vduxr.45)

- PR [#585](https://github.com/lorecrafting/lokacore/pull/585) `authoring/writer-errors` at `afa392f9237eea2240bb59e7eab5ed2c9993960d`.
- Governing: [cartridge.md](../system/cartridge.md) Bundles (INVALID_JSON), Still to write, Scene files; `protocol/cartridge.schema.json` Diagnostic and DiagnosticCode; [guide](../guides/writing-the-game.md) Write a scene.
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. Scene errors name the scene file:line in scene words. They never refuse a merge the spec allows (same-key JSON fills what the scene does not write).
2. The release placeholder check refuses the same set of keys as before, now at a file:line.
3. INVALID_JSON stops the compile. No error is lost; at most it is deferred.
4. `- ~` compiles in dev. Two of them stay distinct. Release refuses it. No silent collision with a written choice.
5. A change to what a diagnostic's `data` carries is documented where the protocol documents data.

## Checks that held

- (2) Mutants are red: `content.ex:68` `==`/`!=` (12 of 13 fail), `content.ex:87` `key not in inline` (11 of 13).
- (3) Mutant `content.ex:144` filter on a wrong code is red (`content_explain_test.exs:251`). Probe: an INVALID_JSON plus a bad `.scene` line reports only the JSON error. The scene error shows on the next compile, so it is deferred, not lost.
- (4) `- ~` on line 3 plus `- Todo 3` on line 5 is refused `repeated_choice` at line 5, so nothing is lost. The `todo_<n>` key and its `_done` fact move when lines move. That affects dev only, since release refuses `~`.
- `bin/mutate_diff.sh origin/main`: 11 mutants, 6 red-narrow, 5 BASELINE-RED (all `content.ex`). The full suite is green, and the three hand mutants above cover those lines. The handback (10 of 10 at 20483a025) was an earlier head.
- PR claims rerun: the `.policy` guard red control (the test is at `content_explain_test.exs:228`, not `:227`; mutant `explain.ex:236` `and`/`or` is red there). The INVALID_JSON red control (as above).

## Findings

**should-fix** `lib/loka/content/scene_files.ex:58-76`. A scene whose prompt or choices come only from its same-key JSON now fails. On main both compiled (probes on `speech_sampler`: scene without prompt plus `dialogues/hi.json` `prompt`; scene without choice plus JSON `choices.go`). `cartridge.md` still says "a choice only its JSON adds ... follows" and "merged over the scene". The prompt case also prints a false second error, "`prompt` is also written in the scene `hi`" at `dialogues/hi.json`: `filled/1` adds the placeholder prompt after the refusal. The false overlap already exists on main after any bad line, but the new refusal now triggers it in exactly the case it targets. A workaround exists (`- Go` in the scene, its fields in JSON compiles), so this is not a blocker. Fix: skip `no_prompt`/`no_choices` when the same-key JSON supplies the field, or keep them and state in the spec and guide that a scene writes its own prompt and at least one choice, with no false overlap.

**should-fix** `lib/loka/content/refs.ex:73-74`. `FACT_TYPE_MISMATCH` now carries `data {fact, type}` at every reference-field site, not only `when:`/`needs:`. The `cartridge.md` sentence names only scenes. `protocol/cartridge.schema.json:1141` documents no data for this code, and the other emitters (`derived.ex`, `spells.ex`, `standing.ex`, `topics.ex`, `dialogues.ex`) still emit `data {}`. Repair loops read data (08 §6). The fixture `reward_storage_invalid.json` pins code and path only, so it is not stale. Fix: amend the schema description ("data {fact, type} at a reference value; {} elsewhere"). This is a protocol diagnostic contract change, so a second opinion is required ([Review count](../WORKFLOW.md#review-count)).

**nit** `lib/loka/content/scene_lines.ex:85`. The collision message says "repeats a choice" at `- Todo 3`, but the writer sees no repeat (the other line is `- ~`).

## Verdict

CHANGES REQUIRED: two should-fix.

## Fix re-check (b094edb6b)

Scope: 3767e62ef, 33cf4376a and b094edb6b, the code they touch and its direct callers. CI at `b094edb6bae8d6abcd9dd7582409707ed41be285`: ci, book-e2e and graph-diff all succeeded.

- (1) Holds. Probes on `speech_sampler`:
  - A scene with no prompt plus `dialogues/hi.json` `prompt` compiles, with no overlap message.
  - A scene with no choice plus JSON `choices` gets no `no_choices` error.
  - JSON `"choices": {}` is still refused, by both the scene and the JSON schema.
  - Mutants are red: dropping the `no_choices` pair, dropping `json != rel` (`scene_merge.ex`), and moving `unwritten` back before `filled` (`scene_files.ex`). One mutant survives: `not in [nil, %{}]` changed to `!= nil`. It is near-equivalent, because the JSON schema still refuses an empty `choices`.
- (2) Holds. `refs.ex` matches main, so the protocol is unchanged. `needs: coins` on an int fact prints "`coins` is a number". The mutant that drops `scene_fact` is red (`content_explain_test.exs`).
- (3) Holds. `- ~`, `- ~` and `- Todo 3` give `todo__3`, `todo__5` and `todo_3`. The mutant that reverts to `todo_<n>` is red.
- The touched tests pass (93).

**should-fix (new, in fix 2)** `lib/loka/content/explain.ex:177`. `scene_fact` looks up the type under the scene's word in `facts.json`. A dotted fact name maps to a snake_case key (`cartridge.md:11`), and dotted names are common (`crypt.gate_open`, `lamps.lit`). So with `"pouch.gold"` (int) in `facts.json`, `needs: pouch_gold` prints "`needs:` needs a true/false fact, and `pouch_gold` is . Name a fact…". Fix: match the name with `.` replaced by `_`. The test uses an undotted name.

Verdict: CHANGES REQUIRED, one small should-fix. The three earlier findings are resolved.
