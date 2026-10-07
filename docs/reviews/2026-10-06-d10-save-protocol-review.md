# D10 save/protocol independent review

**APPROVE — no findings in this scope.** Fresh reviewer; authored none of the implementation. Local branch `chapter1/d10-map-where-knock`, published base `8dbd14bb`, source reviewed `806bfe4f3a507fad21b4da793518031ab0300f3b`. Scoped followup `b8c4e8ec897c49e5fb43c839bed9d7f07678a791` changes only current-source Elixir test references and the added dream-room test coordinate; inspected and approved. This record does not close the separate foundation/proposal review, browser proof, full gate or publication.

## Required behavior

Derived from the [brief](../briefs/chapter-one/d10-map-where-knock-brief-2026-10-05.md), [decision](../decisions/pm-decision-d10-finding-way-2026-10-06.md), [save clause](../system/save.md#d10-discovered-place-and-observation-recovery), [protocol clause](../system/protocol.md#d10-knowledge-and-knock-composition) and storage/contract lessons:

- Visits bind the actor and accepted entry; observations bind exact visible NPC, room and logical time. Genesis, body transfers and accepted Look supply truth.
- Changed rows and receipt commit together before adoption. Failure, uncertain COMMIT, reopen and identical invocation retry retain exactly prior or committed truth.
- Recovery rejects malformed or unsupported knowledge and forged history without repair or byte changes; pin mismatch remains explicit.
- Source compiler and independent artifact loader validate map references/coverage/coordinates, door response references and API floors.

## Checks and evidence

Independent focused run, exit 0: `mise exec -- node --test --test-reporter=spec mobile/authority/local-story/d10_knowledge.test.ts kernel/ts/test/d10_contracts.test.ts kernel/ts/test/knowledge_composition.test.ts` — 8 tests passed. Includes executable in-memory required/bound schema mutations, independent literal composition fixtures, real rollback-journal SQLite cold reopen through walking/ferry/water/drowning, deferred-constraint failed COMMIT, lost successful COMMIT acknowledgement, fenced input and exact receipt retry.

Independent disposable SQLite probes, exit 0: after ancestry selection and five northward moves in v042, separately removed observations, forged NPC/room/actor, inserted duplicate logical observations or malformed keys, and altered accepted receipt actor, command ID or observation effect. All nine variants returned typed `save_corrupt` with callable in-place Start over and preserved complete file bytes. Probe files and databases were removed; no owner save or production source was changed.

Existing pin checks, exit 0: `mise exec -- node --test --test-reporter=spec --test-name-pattern='pin|release|mismatch' mobile/authority/local-story/saves.test.ts mobile/authority/local-story/recovery.test.ts` — three matching save tests passed; recovery file had no matching subtest. Missing pinned release refuses untouched, restart/replay retain identity, and installed-release selection remains pinned.

Inspected compiler short-reference expansion and semantic negatives, generated schemas, transcript and retained [developer mutation evidence](../evidence/2026-10-06-d10-source/README.txt). Elixir compiler checks and source mutations were inspected from that evidence, not independently rerun here. Existing receipt-history binding and exact full-state replay guards remain intact; D10 enables that path for knowledge-only cartridges and validates unsafe row JSON before canonical comparison. The PM-reported 24 authority fixture failures reproduce on published main; this review does not reclassify that baseline debt as D10 failure or claim the full suite passed.

Ponytail Review: lean already; no speculative storage, replay service, migration or dependency to remove. No findings.

## Final pin recheck — 2026-10-06

**APPROVE, scoped recheck at `3a4ec6d2d645c6e7f566157e1e339859d2c68f9e`; no new findings.** Inspected the complete followup from `b8c4e8ec`: save/authority source and the 211-ID oracle are unchanged. Parsed all five changed JSON schemas and compared them after removing descriptions: validation semantics are identical. Generated contract changes are descriptions. The separately reviewed F1 invariant correction rejects forged success over present-null rows; portable composition already refused those rows. No legal-save behavior or receipt guard changed.

The truthful Knock answer advances the exact v042 content hash to `5d8b0e3a16b209733707a8450cee5a4330965092498cf1d31ab8fdae9a50fc8b`. Independently recomputed that hash from canonical content. A disposable real SQLite save under the prior v042 hash refused the current bundle with `pinned_release_missing`, exact prior/installed hashes and callable in-place Start over; its complete file bytes remained unchanged. A separate fresh save pinned the new hash, knew only Ferry Landing, committed ancestry and a northward move, then cold-reopened retaining exactly Ferry Landing and Well Lane. Both probes passed; temporary files were removed and no owner save was accessed.

Final-head focused rerun, exit 0: `mise exec -- node --test --test-reporter=spec mobile/authority/local-story/d10_knowledge.test.ts kernel/ts/test/knowledge_composition.test.ts` — all 6 tests passed, including failed/lost COMMIT, replay, corrupt-row preservation and the new invariant regression. This addendum remains save/protocol scoped; final browser and publication gates are PM-owned.
