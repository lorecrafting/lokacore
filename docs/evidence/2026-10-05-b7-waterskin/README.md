# B7 finite water — local source evidence

Implementation branch `b7-well-waterskin`, exact source
`d31b47d8b2474699348675d697b2fa26a34ba181`. The assigned integration base was
`1898dbb5fc512e573c56f038f1a0ccf465e10aab` (C1, v020/API1.18), explicitly
replacing the brief's older B3 pin. Reviewed B4 source
`a3f9897643b01f53707d04a62f51b4073eadcc25` was merged before the final B7 pin;
its fuel, dark-well and recovery behavior is retained. Source author: Sol, high.
Fresh primary and separate save/protocol verdicts, PR, publication CI and browser
proof: null. These checks certify headless Node/SQLite behavior only; native builds,
Hermes, mobile simulator, device background behavior and owner saves were not used.

Governing [brief](../../briefs/chapter-one/b7-well-waterskin-brief-2026-10-05.md),
[PM adoption](../../decisions/pm-decision-b7-well-waterskin-2026-10-05.md),
[composition](../../system/protocol.md#b7-liquid-composition),
[save](../../system/save.md#b7-liquid-recovery) and
[Book](../../system/book-ui.md#b7-water-details) define the selected boundary.
The B7 Book quantity line uses committed saved Text bindings and authored kind/unit
keys, beside fixed narration; it adds no interpolation language.

## Independent release pin

`ashmere_missing_child@0.0.22`, kernel API `1.20`, SHA-256
`0f744a6c12e8cde1c70cac454e16c733bf5ec27265fc6ad2cd7ad1b025e9dbf8`.
The [stdlib Python generator](../../../protocol/fixtures/generate_missing_child_b7.py)
starts from reviewed B4 v021 and independently canonicalizes/hashes the successor;
it imports no kernel/compiler expected-value helpers. Its
[release fixture](../../../protocol/fixtures/missing_child_b7_hash.json) matches
actual compiled bytes and hash. The [96 initial IDs](../../../protocol/fixtures/missing_child_b7_ids.json)
exclude templates and include real slot holders/jobs. Exact consumer IDs:

| Subject | Independent ID |
|---|---|
| Original skin | `5ce172d0-4fa9-8ded-bde5-0f32bc984fcc` |
| Spare skin | `ab8a8c57-b23a-8814-9cf6-293d9141c078` |
| Well Lane source | `1f15fe56-3e56-8cfa-812b-1f231844c782` |

## Checks and realistic failure controls

| Check | Result |
|---|---|
| Exact-source `mise exec -- bin/check_all.sh` | [exit 0](full-active.log); 336 Elixir tests pass |
| Full headless `TEST_REPORTER=dot mise exec -- npm test --prefix mobile/app` | [exit 0](full-local-story-book.log) |
| `mise exec -- mobile/app/node_modules/.bin/tsc --noEmit --project mobile/app` | [exit 0](app-typescript.log) |
| Liquid/compiler-loader focused behavior | 11 pass; restored compiler 3 pass |
| SQLite recovery, Read and B7 Book regression group | 52 pass; one existing phone-capture case skipped |
| New schema required/bounds/const/types/closed-shape sweep | 114 killed; 0 survivors (57 generation refusal, 57 refused by both twins) |

Full active checks include TypeScript simulation, portable fixtures, differential
checks, source-size and planted checker controls. The authored
[consumer transcript](../../../cartridges/ashmere_missing_child/transcripts/liquid.jsonl)
buys two shells, fills both4/4, drinks4/3, pours3/4 and drinks2/4. Quantity,
custody, carrying and committed narration stay bound to exact participants.

Real SQLite tests close/reopen across empty/full/partial/exhausted rows, open nested
custody, ground/drop, sale/buyback and corpse recovery. Actual failed COMMIT and
both lost-acknowledgement outcomes retain prior5/4 or next2/7 atomically; input and
elapsed work stay fenced, and exact retry does not debit twice. Corrupt rows and
historical command/source/actor/event/prior/debit/order are refused intact.
A consistently rewritten command/event identity is also refused against its
existing invocation column; no receipt format or migration was added.

| Planted break | Prior focused suite | New distinct regression |
|---|---|---|
| Omit Pour source debit | green | fails |
| Ignore liquid mass in incoming carrying | green | fails |
| Omit committed Book quantity line | green | fails |
| Hide projection query-budget fault | green | fails |
| Accept rewritten command/event identity with unchanged invocation | green | fails |
| Bypass exact liquid ActionSet target/input/policy admission | green | fails |
| Allow vessel metadata on an otherwise valid configured corpse template | green | corrected compiler and loader cases fail |

The schema and portable guard scripts and redacted logs are retained here. The
behavior red controls use `mise exec -- node --test` on the named affected test
files, with `--test-skip-pattern` for the old focused group and
`--test-name-pattern` for the new case where both share a file. Compiler mutations
use `mise exec -- mix test test/loka/content_liquids_test.exs --force`.
Every mutant was restored before source commit. Tests use independently pinned
fixtures and literal quantities, balances and outcomes.

## Self-review and review attention

Ponytail Review: reuse existing rows, writer groups, custody, checked arithmetic,
carrying, ActionSet, receipts and SQLite transaction machinery. One closed liquid
row and its independent invariant serve the real two-skin consumer. No dependency,
generic liquid factory, template creation writer, physiology, time/RNG/resource
effect or source-size allowance was added. `runtime/proposal.ts` is unchanged.
Cold save recovery shares the existing accepted-receipt replay; its deliberate
linear cold-open limit remains marked with a `ponytail:` comment.

Actual-diff review found and corrected two cross-mechanic boundaries; reviewers
should inspect them explicitly. Liquid candidates now use the exact keyed shared
admission plus the same pure transition as execution. The existing primary-target
mapping recognizes only the typed source/vessel fields, and visibility includes
actual source/vessel/receiver participants while keeping the shared query budget.
One authored override regression checks all three commands against allowed,
wrong-target, wrong-input and denied-policy cases.

Additional full Local Story/Book checks found inherited receipt recovery defects:
missing event payload and missing command payload could throw before typed logical
`save_corrupt`; narrow shape guards now retain the refusal. Actual SQLite index
corruption failed earlier in open than the old narration read, exposing a no-header
replacement guard that prevented explicit Start over. The existing replacement
path now permits only an untimed no-header repair, keeps typed corruption, and the controlled
real damaged-index test verifies the fresh playable result. Removing this guard
fix makes that existing regression fail; not-database/corrupt-page tests also pass.
The existing timed-save witness/closed-transaction path remains intact: a controlled
unreadable timed save refuses a newly readable replacement and stays pending during
real SQLite read/ROLLBACK denial. A broader reset mutation fails this safety test.
No expected wording was weakened without verifying the reset path.

Failed earlier checks were retained during work and fixed: missing schema examples,
invariant citation metadata, strict Credo complexity, inherited source-size excess,
a stale app chapter hash and the recovery failures above. The first template
fixture was rejected by an unrelated corpse constraint; its corrected valid-corpse
control now detects removal of the intended B7 guard in both languages. Independent
reviews are still required; this note is the developer's local proof, not approval.

Captures are redacted before retention. [SHA256SUMS](SHA256SUMS) hashes retained
captures; [verification](verify.txt) records `shasum -a 256 -c SHA256SUMS`.
