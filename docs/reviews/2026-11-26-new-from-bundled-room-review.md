# Review: New room, NPC and item from a bundled room (PR #809, loka-hcnlh.78)

- PR #809, branch `fix/new-from-bundled-room`. Reviewed at `b90ad66e055bc90017fd9517bf83c1e127b72234`.
- Governing: [cartridge.md Source shortcuts, Area bundles](../system/cartridge.md) (a bundled definition is exactly its `<dir>/<key>.json`; file and bundle = `DUPLICATE_DEFINITION`; a bundle's rooms count for its area folder), `lib/loka/content/areas.ex` `check/1`, `lib/loka/content/extends.ex:38` (abstract).
- Why a record: asked for by the PM brief.
- CI at the head (`gh run list --commit b90ad66e0…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body.
- Verdict: **CHANGES REQUIRED** (one blocker: a test gap; the code is correct).

## Must be true (written before the diff)

1. A patch to a room only a bundle holds (back exit, detail) lands in that bundle at `rooms.<room>`; no `rooms/<room>.json` beside it.
2. The write goes through the starter's undo hook, so the panel's Undo restores the bundle's old bytes.
3. A new room in `areas/<a>/rooms/` next to `areas/<a>.json` compiles and belongs to area `a`.
4. The entry an area falls back to is never an abstract room (compiler: `"abstract": true`).
5. Non-bundled paths keep their behavior.

## Checks run (detached worktree at the head; no servers started)

- `mix test test/loka/content_starters_test.exs` 28 passed; `node --test test/author_mapedit.test.ts` 26 passed (it includes the byte-identical undo after the new bundle gestures).
- Probe on a copy of `speech_sampler` (bundle `areas/village.json` plus an `areas/village/` folder): `mix loka.new rooms granary --from mill north --area village` wrote `mill.exits.north` into the bundle and `areas/village/rooms/granary.json`. `mix loka.compile --allow-placeholders` passed, with granary in the artifact and `mill → granary`. Only the `~` placeholders fail a compile without that flag. Area membership is source-side (`Areas.check`): granary's folder is `village`.
- The bundle's data and key order are kept, but the whole file is reformatted (Finding 3).
- `bin/mutate_diff.sh origin/main`: 3 mutants, red-narrow 2, **SURVIVED 1** (`starters.ex:244` `and → or`). The handback says "0 mutants" (Finding 2).
- Red controls (developer's, confirmed red on the new Elixir test): `Area.into_bundles` removed; `Enum.min → Enum.max` in `first_room`.
- Removed pin `--from marsh` refused: it asserted only the bug, and its `bundle(dir, "marsh")` setup served nothing else. The missing-room refusal (`nowhere`) still stands.
- Abstract skip `r["abstract"] != true` matches `extends.ex:38` `%{"abstract" => true}`.
- Two patches to one bundle (`area.ex:87`): the only templates that patch two rooms are transport (`<name>_far`) and population (`<name>_camp`), and each second room is new by name. They meet only when the author already has a bundled room by that name (Finding 4).

## Findings

1. **Blocker (test gap)**: `lib/loka/content/starters.ex:244`. The `and → or` mutant survives the suite, but it breaks real behavior. Probe: bundle-only area `marsh`, root NPC `keeper`, then `write(dir, "dialogues", "talk", …, {"marsh", nil})`. Correct code binds `npc: "keeper"`; the mutant binds `npc: "marsh"`, which is the room. The cause is that `held` (room keys) now joins the membership test for every kind. Fix: in the bundled test, add one starter that needs a non-room kind with `--area marsh` (dialogue or service) and assert its NPC.
2. **Should-fix**: the PR body "Runs" claims `bin/mutate_diff.sh origin/main: 0 mutants`. The rerun at this head gives 3 mutants with 1 SURVIVED (Finding 1). Correct the table.
3. **Nit**: `lib/loka/content/starters.ex:326` (`Parts.pretty_over`). A one-room patch rewrites the whole bundle in 2-space style. In `speech_sampler` every inline `{ "prose": … }` in rooms, NPCs and dialogues expands (+79/−21 lines). Key order and values are kept, Undo restores the bytes, and `play/write.ts` `json()` already formats #807's bundle edits the same way. Not byte-for-byte as the brief asked; the cost is diff noise only.
4. **Nit (author-side)**: `lib/loka/content/starters/area.ex:87` `Map.put`. Bundle `marsh` holds `alpha`, `marsh`, `ferry_far` (all placeholder), then `new transports ferry --area marsh` returns `{:ok, …}`. `alpha`'s detail patch is silently dropped and the compile fails. The PR's "the clash refusal still fires" holds only when `ferry_far` has words. Cheap fix: `Map.update(files, bundle, new, &Merge.merge(&1, new))`.

## Re-check: fix round at `e0b6ba73e`

Commits reviewed: the fix round only, up to `e0b6ba73e`. CI on that head: graph-diff, book-e2e and ci are all green.

- **Finding 1, closed.** The bundled test now adds root NPC `keeper` and `dialogues greet --area marsh`, and asserts `npc == "keeper"`. Red control: the `starters.ex:244` `and → or` mutant turns that test red.
- **Finding 2, closed.** The PR body's mutate table now matches the rerun.
- **Finding 3, open (nit).** The bundle is still reformatted. The cost is diff noise only.
- **Finding 4, closed.** `area.ex:87` is now `Map.update(…, &Merge.merge(&1, new))`, and a new test sends two room patches into one bundle. Red control: reverting to `Map.put` turns that test red.
- **Size allowance.** `content_starters_test.exs` went to 740 lines (the file is 739). The allowance is tight, and the only growth is the two tests the findings asked for. Accepted.
- `mix test test/loka/content_starters_test.exs`: 29 passed.

**Verdict: APPROVE WITH NOTES** (Finding 3 stays open as a nit).
