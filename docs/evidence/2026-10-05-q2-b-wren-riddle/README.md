# Q2-B — Wren encounter and durable riddle: headless checks

Scope: [PM adoption](../../decisions/pm-decision-q2-b-wren-riddle-2026-10-05.md).
Chapter0.0.10/API1.9 starts from merged Q2-A. Q2 remains active after the riddle;
escort/message return and child-status resolution belong to Q2-C.

The controlled tests run the actual Q1 report → Study → bound meeting → riddle path.
They cover all-hours NPC presence and protected attack targets, no preactivation/Study/Talk
credit, bank multiplicity/refusal, eventless wrong retry, correct once-only resolution,
both original NPCs dead/departed/substituted, and truthful journal stages. Real SQLite
cold opens before/wrong/correct preserve roles and route narration to Vesper; exact replay
and changed-answer conflict, malformed saved evidence, elapsed control freshness, and
failed/lost COMMIT reconciliation are exercised. The React test presses the actual NPC
bank, Backspace, Clear and Submit controls. It is not native layout or device evidence.

Commands used:

- `mise exec -- mix test test/loka/content_missing_child_test.exs`: independent Python
  chapter declaration equals the compiler artifact, exit0.
- `mise exec -- node --test kernel/ts/test/wren_riddle.test.ts mobile/authority/local-story/wren_riddle.test.ts mobile/app/book/riddle.test.ts`:
  eight focused controls, exit0.
- The affected dialogue/save/presenter/combat suites: 93 tests, exit0
  ([retained result](restored-compatibility.log)). The initial broader recovery routing
  and missing-metadata fallback caused legacy routing failures; recovery was narrowed to
  riddle answers and rejected reply shapes preserved ([initial failure](initial-routing-failure.log)).
- `mise exec -- bin/check_all.sh`: full local gate, exit0, recorded in `local-check-all.log`.

[Behavior mutations](behavior-mutants.json): 12/12 killed, individual red logs alongside.
The [initial sweep](initial-behavior-mutants.json) had one surviving role-binding mutant:
its corruption case already failed narration consistency. The test now coherently substitutes
both the saved role and narration; only original binding validation rejects it.
[Schema sweeps](schema-typescript.json) and [Elixir sweep](schema-elixir.json): all 19 new
required/bound constraints killed per kernel by literal controls in
`protocol/fixtures/riddle_contracts.json`. The helper independently killed 12 compiler/loader
guard mutants ([summary](contract-helper-checks.json)); it retained classifications, not raw guard logs.

Ponytail Review: existing ordered dialogues, policies, facts, continuation and changed-row
receipts compose the encounter. The only new input is a bounded answer; active journal
variants are bounded and presentation-only. No graph, follower/message scaffolding,
dependency, transcript or new save table. Correctness self-review narrowed recovery routing,
checked exact command/world/choice/binding/evidence and bank-sensitive freshness, and retained
the real transaction failure paths. No remaining self-review finding.

All captures use a `redact()` that removes local worktree, home and scratch paths. No native
tooling, Simulator, Metro, development preview or owner-save operation was used. Primary and
separate protocol/save reviews and remote exact-head CI remain the PM's merge gates.
