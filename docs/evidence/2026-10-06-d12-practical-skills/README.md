# D12 provisional practical-skills proof — 2026-10-06

Source `1444c6b482b87fdb9af30824279ee7384015c092`, branch
`chapter1/d12-practical-skills-provisional`; selected planning/review base
`c70a0416c94e733428695b609e71d1e9cd60c9fa`; inspected published predecessor
`815f66f9039ca22f80d44112a1ff966eadb8381e` (D1).
Governors: [brief](../../briefs/chapter-one/d12-practical-skills-brief-2026-10-05.md),
[mechanics](../../system/mechanics.md#d12-practical-skill-consumers-selected-contract),
[declarations](../../system/cartridge.md#d12-practical-skill-declarations),
[invocations](../../system/protocol.md#d12-harvest-method-and-buy-quote-composition),
[recovery](../../system/save.md#d12-lesson-careful-harvest-and-discount-recovery),
[Book](../../system/book-ui.md#d12-practical-lessons-and-benefits).

Local checkpoint only. Final predecessor, successor release/API/hash/IDs, PR and
browser proof are **null**. Provisional source retains D1 version/API labels;
frozen fixtures and bundled assets are unchanged. Tests use controlled D1 identities
and source-owned D12 fields. D4/C4/D3 may publish first: merge and independently
re-pin before final proof. No broad full gate, push, preview, browser/native simulator,
phone or owner-save work occurred. Independent primary/save reviews remain pending.

## Focused results

| Retained check | Result |
|---|---|
| [Compiler](compiler.log) | 4 tests, exit0; actual source references, original teachers and invalid tuning |
| [Kernel](kernel.log) | 24 tests, exit0; literal alias, exact two lowest IDs, combined carry/stock/skill boundaries, seven discounts, Sell and both stale-price directions |
| [Host/Book/transport](host-book-transport.log) | 45 tests, exit0; D1/C1/B3/B5 and new writers |
| [SQLite/Book/S9](sqlite-book-s9.log) | 5 tests, exit0; latest extended cold/save/COMMIT/replay controls |
| [Book boundary](book-boundary.log) | 1 test, exit0; final authority-mediated view import |
| [Kernel types](kernel-types.log), [app types](app-types.log), [contract drift](contracts.log) | exit0 |
| [Headless simulator](headless-sim.log) | 18 tests, exit0;500 fresh sequences and existing red controls |
| [Normal commit hook](commit-hook.log) | passes |

Both original teachers accept 2p lessons below qualification,3p→1p and teacher+2p,
without duplicate fee/grant on replay; low funds refuse. Existing C1 tests retain
recipient-overflow and duplicate-fee guards. Careful load11960g accepts to12000;
11980g refuses both while ordinary one remains legal. Physical cold saves retain
both herb IDs through Drop/Take and careful2 + ordinary1 through S9, receiving
exactly three existing bandages and no extra payment. Discounted Buy remains lawful
when later MV falls below qualification. All three writers exercise known-failed
COMMIT, uncertain absent/committed outcomes, fencing, cold open and replay.
Corrupted transfer/event and a fully funded forged quote with consistent money
rows return `save_corrupt` without changing file bytes. Headless Book controls
cover both teachers, literal careful input, patch ownership/refresh and bound Buy.
Browser interaction remains pending. Focused size/format and `mix credo --strict` pass.

## Controls and self-review

[Control exits](controls.csv), with raw `mutant-*.log`: missing second transfer,
one-item carry check, ignored careful/discount qualification, missing Book literal
input and accepting an opted stale quote are old-green/new-red. Generic price-guard
removal is already red in existing commerce tests; no separate overlapping test was
added. The historical quote control edits command price, resource `from`/`to` and
saved balances together: removing the opted quote guard opens that counterfeit
save; [restoration](historical-restored.log) refuses it.

`schema-00.log`…`schema-19.log` retain20 controls: eight required-field removals,
eight numeric-bound removals and two method-enum removals fail the behavior check;
two closed-object removals are rejected by generation. Restored drift is green.

Correctness self-review fixed the [D1 helper's three failures](d1-helper-before-fix.log)
by naming its intended free swim dialogue, routed a new Book test's kernel import
through the authority helper, and corrected a counterfeit control that originally
used a field outside the resource-operation contract. Ponytail Review cut an
unnecessary replay-proof boolean and redundant local; reused paid acquisition,
skills, finite selection, carrying, conserved commerce and revision replay. No new
framework, stock ledger, dependency, saved qualification or quote token. No open
source finding/spec conflict; this is not independent approval.

Proposed PR: optional 2p lessons, qualified finite two-item careful gathering and
Peg's shared current discounted Buy quote compose the existing skill, dialogue,
containment, commerce and authority contracts. Free swim, ordinary Harvest and Sell
retain their behavior. Focused proof above passes; release/publication gates remain
provisional.

Outputs redact home/worktree/scratch paths; no device/provisioning/account identifiers
were captured. [SHA256SUMS](SHA256SUMS) hashes retained files;
[verification](SHA256SUMS.verify.log) is separate.

Final local D3 integration, active v034 pins, isolated browser, current-source mismatch refusal and full lane are recorded in the [v034 proof](final-v034/README.md). Earlier provisional nulls and no-browser statements above remain historical checkpoints.
