# C4 hound response — provisional source evidence

Source head `252eb45624a27d5eb90c89a2eff7159e09f9b613` builds from the independently reviewed C4 plan and published C3 main. The chapter still carries published `v029` / API `1.25` / 140 genesis IDs. C4 changes authored content, so that release pin is intentionally provisional until the published D1 predecessor is integrated and an independent successor answer is derived. This head is for fresh primary, save and proposal review; it is not a publication candidate yet.

Deliberate Attack admits the selected living hound and bounded same-plan, co-present helpers from exact population slots. One deterministic hound has the opponent opportunity each round. A wounded selected hound chooses a legal area exit, transfers with its same-group flight stamp, retains its injury and slot, and leaves the fixed roster. No helper refills mid-fight. Flee, death, stale jobs and an empty due roster close the encounter. Book renders the roster and target; local Story classifies pack narration in Combat history. A real rollback-journal SQLite test covers attack, rotation, cold reopen, flight, and byte-preserving refusal of a forged roster.

## Checks on the provisional source

| Command | Result |
| --- | --- |
| `mise exec -- npm --prefix kernel/ts run typecheck` | Exit 0, including tests and play. |
| `mise exec -- ./mobile/app/node_modules/.bin/tsc -p mobile/app/tsconfig.json --noEmit` | Exit 0. |
| `mise exec -- node --test --test-reporter=dot kernel/ts/test/encounter_composition.test.ts kernel/ts/test/population_composition.test.ts kernel/ts/test/combat.test.ts kernel/ts/test/c4_pack.test.ts kernel/ts/test/c4_pack_composition.test.ts mobile/authority/local-story/c4_pack.test.ts mobile/app/book/combat.test.ts` | Exit 0 after the source commit; 39 tests. |
| `mise exec -- mix test test/loka/core/c4_pack_composition_test.exs test/loka/core/encounter_composition_test.exs --force` | Exit 0; 7 tests after the final Elixir guard cleanup. |
| `mise exec -- mix credo --strict` | Exit 0; 0 findings and no new metric exceptions. |
| `mise exec -- elixir bin/contracts.exs` | Exit 0. |
| `mise exec -- elixir bin/check_docs.exs` | Exit 0; 637 documents, 0 broken or unreachable links. |
| `mise exec -- mix format --check-formatted`, normal commit hook, `git diff --check` | Exit 0, including Prettier and architecture scan. |

A provisional `mise exec -- bin/check_all.sh` run reached 360/361 passing ExUnit tests, then stopped at the compiled Missing Child content pin: the source adds C4 chapter content while the pin still names published C3 `v029`. The final successor pin and a complete broad gate wait for D1 publication. The failed gate result is retained as a dependency, not counted as a passing check. The final import-only helper rename was followed by a green TypeScript typecheck and focused suite.

## Red controls observed and restored

| Planted break | Focused failure |
| --- | --- |
| Treat HP equal to the flight threshold as eligible (`<` to `<=`) | Strict wounded-flight boundary test failed. |
| Remove the same-time flight stamp exclusion from the population job | Both controlled equal-time order outcomes failed. |
| Remove full-plan admission proof in the TypeScript and Elixir composers | The literal foreign-plan roster fixture failed in each kernel; older encounter cases remained green. |
| Admit an already engaged helper | Bounded admission test failed. |
| Remove roster rendering from the actual Book Combat component | Component test failed. |
| Omit pack narration keys from local Story's Combat classification | Real SQLite Combat-history assertion failed. |
| Scan one fewer population slot at admission | Six-slot night admission test failed. |

Literal proposal cases also went red against the original permissive composition before the guards were added: dropping a live helper, transferring without a flight stamp, writing a wrong cursor and rejoining a stale member. Both portable kernels now agree with the independent fixture answers. Every source mutation was restored.

Ponytail Review: the implementation uses the existing combat resolver, C3 slots, delta algebra, local Story and Book paths. No dependency, generic pack framework, compatibility adapter or metric suppression was added. The 811-line literal proposal fixture is the largest single addition because it pins full row states across both kernels; shared fixture state and named row edits removed repetitive copies. Correctness self-review checked deterministic selection, full-plan slot provenance, death and flight closure, bounded work, final save validation and prefix composition. No additional substantive finding remains at this provisional head. Fresh independent review is required.

The Book Flee narration fallback in this source overlaps the same correction in D1 PR231. Drop the duplicate when merging published D1; then derive the C4 successor release/hash/IDs and rerun the full gate before carryover review. No native build, simulator, owner save, browser preview, push or PR was used for this provisional source.
