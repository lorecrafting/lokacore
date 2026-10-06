# D12 provisional C4 carryover — 2026-10-06

Source merge `22038c5faf51fd3fbb1dd1282f3e051353ac2662` on
`chapter1/d12-practical-skills-provisional` combines prior provisional D12
`bb296c71` and published main `e9db5bdffc9bfc98d1580a65e6e99fff53451497`.
Git merged without conflicts. No manual resolution, new mechanic, schema guard,
test or other source fix was needed. The merged generated contracts pass drift;
C4 roster projection and pack narration coexist with D12 method-aware controls,
current quotes and historical receipt validation.

The [selected brief](../../../briefs/chapter-one/d12-practical-skills-brief-2026-10-05.md),
[primary review](../../../reviews/2026-10-06-d12-provisional-primary-review.md),
[save/protocol review](../../../reviews/2026-10-06-d12-provisional-save-review.md)
and [prior integration](../main-merge-3ff6cdd4/README.md) own their recorded scope
and historical approvals. This checkpoint supplies focused combined-tree proof;
final exact-head independent review and publication checks remain pending.

| Retained check | Result |
|---|---|
| [Compiler/composition](compiler.log) | exit0;4 Elixir tests |
| [Release compilation](release-compile.log), [warnings check](compile.log) | exit0; actual merged chapter compiles |
| [Kernel](kernel.log) | exit0;30 D12/commerce/C4 behavior, composition and schema tests |
| [Host/Book](host-book.log) | exit0;21 tests, including disk-backed D12/C4 SQLite fault, cold-open and replay checks plus transport regression |
| [Kernel types](kernel-types.log), [app types](app-types.log) | exit0 |
| [Contract drift](contracts.log), [formatting](format.log), [core size](core-size.log) | exit0 |
| [Normal merge commit hook](merge-commit.log) | exit0;format, AST, docs and staged Beads checks |
| [Restored view controls](restored-view.log) | exit0;11 tests after both mutations were restored |

Existing focused tests fail under each temporarily planted shared-view break:
removing the careful method from Harvest projection makes the
[Book lesson-to-careful-control check fail](red-d12-view-method.log);
removing the active roster from GameView makes
[the C4 exact admitted-member projection check fail](red-c4-view-roster.log).
Both controls exit1 and restored tests exit0. No overlapping test was added.

An additional [mobile size probe](size.log) exits1 on the inherited
`local-story/save.ts` file/function sizes (348/60/48). The active core size lane
passes; the mobile probe is outside that lane and no size exemption/refactor was
introduced for this carryover. The full accumulated publication gate is pending.

Ponytail Review: **Lean already. Ship.** Correctness self-review checked the actual
shared-view/narration and generated-contract merge, exact method/quote admission,
both custody transfers and save replay alongside pack projection. No D12 mechanic
logic changed; no new dependency, adapter or machinery. No unplanned contract
conflict or open source finding was found.

Successor release/API/hash/IDs, browser interaction, PR and publication remain
**null**. Published C4 v032/API1.28 and its fixtures are predecessor values;
D3 western Ashmere will publish before D12 is independently pinned. No frozen
fixture or bundled asset was changed by D12. No push, PR, preview, native/mobile
run, owner-save access or full publication gate occurred.

Capture uses C4's reviewed `redact()` for output and command headers; retained
logs remove home/worktree/scratch paths and device/signing identifiers.
[SHA256SUMS](SHA256SUMS) hashes the logs; [verification](SHA256SUMS.verify.log)
is separate.
