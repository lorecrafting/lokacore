# E1 selected active journal variants — author checkpoint

Governing clause: [E1 exact candidate proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy).
Source commit: `77ce30a45461eee7c68c2fdbeab42065e7957665`, based on
`24e752bec256ce45300aeefaa0aa7f27cd4eee58`. This bounded author checkpoint
is not E1 certification; the verdict remains null.

[report.json](report.json) binds the clean source/check/policy identities, admitted
v042 candidate bytes, pinned Node and real SQLite host. Two complete fresh legal
routes, rescued/prior and stays/prior, each committed and replayed 49 commands,
including the finale. Their intermediate active journal projections witness nine
exact paths across variants 1–4: following, deliver, answered and met.
The recorder requires the first satisfied variant's exact projected text and
credits only its root and required `all` children. Replay requires each path in
its own retained committed step; a resolved final journal grants no active credit.

Three variant-0 paths remain pending because neither route separates the escort.
The two bell-objective `any` children in the base checkpoint also remain outside
this slice. There was no new integrated 18-case run or 10,000-sequence proof.
Independent review, final source binding and the other E1 obligations remain open;
E2/E3 browser receipts and paused native proof are unchanged carries.

Checks actually run (all commands through `mise exec --`):

| Check | Result | Receipt |
|---|---|---|
| `node --test kernel/ts/test/e1_obligations.test.ts kernel/ts/test/e1_journal.test.ts` | exit 0, 5 tests | [focused.log](focused.log) |
| `npm run typecheck` in `kernel/ts` | exit 0 | [typecheck.log](typecheck.log) |
| `elixir bin/check_docs.exs` | exit 0 | [docs.log](docs.log) |
| `node bin/check_ts_size.mjs kernel/ts/test/e1_obligations.ts kernel/ts/test/e1_journal.test.ts kernel/ts/test/e1_case_host.ts` | exit 0; host remains 325 lines | [size.log](size.log) |
| Clean-source capture and semantic replay | exit 0, 2 complete routes | [capture.log](capture.log) |

Distinct red controls, restored before the source commit:

- Disable journal witness binding: the old obligation suite passes 4/4
  ([old-suite-mutant.log](old-suite-mutant.log)); the new test fails on the missing
  met root/child ([new-test-mutant.log](new-test-mutant.log)).
- Select the last satisfied variant instead of the first: the old suite passes
  4/4 ([precedence-old.log](precedence-old.log)); the new test fails on the missing
  answered root/child while met remains satisfied
  ([precedence-new.log](precedence-new.log)).

The one new SQLite test checks literal projection order on both return branches,
no sibling or resolved-journal credit, cold reopen, semantic replay and removal of
intermediate receipt paths. Test source identities are explicitly synthetic;
the retained route files use the real clean commit identity.

Reproduce the bounded capture from the source commit with an unused output directory:
`mise exec -- node --input-type=module - OUTPUT < capture.js.txt`, using the
retained [driver](capture.js.txt) from this folder while the checkout is clean.
The driver uses the existing ending routes and semantic replay. The full runner
and its integration checks belong to the parent checkpoint; this slice did not
run `bin/check_all.sh` or push.

Author Ponytail Review: lean; existing policy traversal reused, no new dependency,
helper module or host changes. `e1.ts` already includes `e1_obligations.ts` in its
check digest. Correctness self-review checked first-match precedence, full quest
reference, player scope through GameView, active state, projected text, accepted
commands and receipt-required replay. No open author findings; independent review
is still required.

[SHA256SUMS](SHA256SUMS) hashes the redacted receipts, traces, report and capture
driver; [SHA256SUMS.verify](SHA256SUMS.verify) records verification.
