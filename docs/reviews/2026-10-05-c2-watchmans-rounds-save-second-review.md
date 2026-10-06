# C2 Watchman's Rounds — save/protocol second opinion

**Verdict: APPROVE.** No findings in this scope.

Fresh independent Codex Sol review; authored none of the work. Local branch
`slice/c2-watchmans-rounds`, exact source
`747113496572892a01224c47cddc0bf4f63d0fdc`, compared with published base
`80c3a072`. Reviewed in a separate worktree; no source changes, merge or push.

## Required behavior

Derived before reading the implementation from the [C2 brief](../briefs/chapter-one/chapter-one-c2-watchmans-rounds-brief-2026-10-05.md),
[save contract](../system/save.md#c2-patrol-attempt-recovery),
[portable contract](../system/protocol.md#c2-patrol-composition-and-admission),
[mechanics](../system/mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
and [cartridge ownership](../system/cartridge.md#c2-watch-route-and-trust):

- Accepted, revision-ordered receipts bind actor/body/original leader, full quest
  references/scopes, activation choice, command/attempt identity, causal movement
  and fatal events, and complete prior/result rows. Current truth agrees in both
  directions; forged or missing proof gives unwritten `save_corrupt`.
- All lawful intermediate rows reopen and permit the next consumer. Fatal combat
  empties the failed attempt before return; Restart retains S3/cursor with a new
  attempt. Completed truth survives later travel, C1 payments, gear loss and death.
- Movement, patrol, Wren, quest and trust have separate owners and share one
  changed-row transaction. Failed/uncertain COMMIT and exact retry cannot expose
  partial state, repeat transfer, credit or resolution.
- API1.22, chapter v024, current hash/initial IDs and both portable twins agree with
  independent answers; ordinary authoring cannot independently write S3 or trust.

## Proof at the reviewed source

All commands used `mise exec --`; output stayed in temporary review logs.

- `node --test mobile/authority/local-story/patrol.test.ts`: **25/25**. Real SQLite
  covers every selected cold boundary, actual cellar death with following Wren,
  Restart, C1 lesson payments, causal corruption, and genuine failed/lost COMMIT
  outcomes at leader departure and terminal join, followed by exact receipt replay.
- `node --test kernel/ts/test/patrol.test.ts kernel/ts/test/patrol_contracts.test.ts
  kernel/ts/test/patrol_content.test.ts`: **9/9**. `mix test` of core patrol,
  content patrol and compose files: **18/18**, including literal answers and the
  two-kernel differential. Neighbor combat/Flee/death/escort/dialogue: **34/34**.
- Independent disk probes: **21/21** forged receipt actor/command/invocation/scope,
  cause/correlation/entry actor/source, full quest ref/scope/terminal, activation
  source/role/choice, attempt/credit and reserved trust cases return `save_corrupt`
  with database bytes unchanged. Completed patrol survives actual later cellar
  death and cold reopen. Actual Wren rescue → patrol → cellar Attack/Flee transfers
  the body and Wren once, retains paused credit/cursor and cold reopens.
- Removing accepted-decision comparison from receipt replay makes the existing
  scope/cause/source/lost-transition controls fail (**exit 1**); restored **16/16**.
  Removing original-identity equality from each independent portable invariant
  fails the counterfeit leader test (TS **exit 1**, Elixir **exit 2** with `--force`);
  restored TS **3/3**, Elixir **4/4**.
- Schema omission sweep: **77** effective required/bound/variant controls change
  the independent fixture answers. The remaining **13** omissions retain the
  subset's implicit closed-property or required-discriminator semantics; all four
  raw required-discriminator omissions are rejected by schema flattening.
  `elixir bin/contracts.exs --check` passes.
- Current chapter compiler checks **4/4**, controlled-seed simulator **1/1**.
  Independent Python re-generation leaves both v024 fixtures unchanged:
  `62f10e30e226c67627628c0017091284bbf1485a473222883fce92b44947b008`.
  Runtime comparison matches **all 109** literal initial IDs; loaded API1.21 patrol
  authoring is refused `KERNEL_API_RANGE_INVALID`.

Ponytail Review: lean already; the typed continuation, independent lifecycle
proof and existing receipt replay serve this concrete consumer. No deletion
finding, dependency, snapshot, migration or speculative framework.

## Verification limit

The developer/PM's terminal browser cold-open timeout remains open. This scoped
approval establishes source save/protocol behavior under real Node SQLite; it
does not clear browser-host reopen or Book interaction acceptance. The suspected
Web synchronous SQLite bridge/bulk receipt response limit is unproven here.
Native work remains paused; no hosted CI or publication claim.
