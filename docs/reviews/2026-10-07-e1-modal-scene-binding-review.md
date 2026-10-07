# E1 modal scene acknowledgement binding independent review

Source change: `5304ca16609600c5a8b5c243ab1529379c7b5663`; merged recorder source: `77733cfed72b254f8650c653541ba1d29046ef7d`; evidence checkpoint: `306769bceee4ed7f45dac82ecd6d00681578cbc4`.

**APPROVE** the bounded modal scene binding, no findings. This does not certify E1; the retained report is `pending` with 568 authored obligations open.

## Review

- The rule binds only after `decision.kind === 'accepted'`, on `continue`, when a modal scene is displayed in the prior world and the command's line matches its current index. The installed scene rule additionally requires the exact durable scene reference and line. This matches the mechanics contract: `n` visible narration steps are followed by structural `await_ack` and `end`.
- The first acknowledgement witnesses the scene definition and visible step 0; subsequent acknowledgements bind the corresponding displayed step. The final acknowledgement binds the last displayed step and the two structural paths only if the resulting view has no running scene. Presentation-only dream notices do not populate the modal `gameView.scene`, and their choices/beats remain outside this witness rule, as the architecture clause now states.
- The real SQLite focused case checks all three Bell Rung acknowledgements against literal expected paths, confirms display alone earns none, and replays the retained command sequence. The retained mutation control that credited the scene on display passes the prior three focused tests but fails the new case. The five ending traces are bound to merged source `77733cfe` and each retains its modal scene witnesses.
- The clean merged-head report binds source SHA `77733cfe`, check hash `c91caad3…`, and policy hash `02d71791…`; all 16 real SQLite cases and semantic replays pass. It exits 2 with `certification_verdict: null`, leaving ten presentation-only dream paths and 568 authored obligations pending. Candidate identity, remaining authored receipts, final sequence proof and E2/E3 remain separate gates.
- The docs clause matches the installed mechanics/cartridge structure and does not rewrite archive history. The brief links to the evidence checkpoint and describes its pending scope. The retained `SHA256SUMS` entries verify. `case-SHA256SUMS.verify` records successful verification of the complete isolated output; its database files are not all included in the committed evidence directory. Privacy scan found no local/scratch paths or restricted device, team or provisioning identifiers.
- Independent checks on the exact head: focused E1 suite passed 16/16; `mise exec -- npm run typecheck` passed; `mise exec -- elixir bin/check_docs.exs` reported 816 docs, 0 broken links and 0 unreachable files; `git diff --check` passed.
- Ponytail review: minimal. The change adds one narrow witness branch and a behavior-level SQLite test, reusing the current host, view and replay; no new dependency or framework.

## Limits

This approves only modal scene acknowledgement binding on the reviewed source. Presentation-only dream evidence, remaining authored obligations, selected 10,000-sequence proof, final independent E1 review and E2/E3 browser receipts remain pending. E1 certification is not granted.
