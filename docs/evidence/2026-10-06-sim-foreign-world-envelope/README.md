# Foreign-world simulator envelope evidence

Source baseline: `815f66f9039ca22f80d44112a1ff966eadb8381e`. Fixed source:
`381e1f61adb2776e169e5930d97f7c7acbe73a9c`.
Governing contract: [protocol Step](../../system/protocol.md), another world
is refused `not_found` before action admission.

[Capture](capture.mjs) runs frozen published `missing_child_v030_hash.json`
seeds 1–200. [Baseline](published-v030-baseline-red.log) exits 1: exactly seed
71, zero-based command 11, `gameview_agrees_with_admission/not_found`, 6,758
commands before stopping failed sequences. [Fixed](published-v030-fixed-green.log)
exits 0: 6,761 commands, no failures. The same fixture hash is retained in both.

[Exact offer reproduction](service-repro.mjs) derives Maud's available
`lantern_meal` after moving north/east in published v030. It checks real
foreign-world `not_found`, identical world, oracle agreement, lawful acceptance,
and oracle disagreement for the same current-world offer wrongly refused.
[Output](exact-service-green.log) exits 0. Adapted from D3 evidence commit
`7865ac523e3391b98b94178e0fdd706ec2c9e336`; no D3 source is changed.

One controlled behavior test was added. [Old oracle](old-oracle-red.log) exits 1;
[fixed regression](fixed-regression-green.log) exits 0. Red controls actually
changed the oracle: [any not_found passes](overbroad-not-found-mutant-red.log)
and [any foreign result passes](foreign-accepted-mutant-red.log) each exit 1.
The original source was restored and the test rerun green.

[Full local check](check-all-green.log): `mise exec -- bin/check_all.sh`, exit 0,
including types, all kernel tests (committed regression seeds and 500 fresh sim
sequences), size, formatting, contracts, docs, lint, and red controls. The two
retained evidence scripts additionally pass formatting and TypeScript size checks.
No mobile/native simulator, browser or owner save was used.

Ponytail review: lean already; no dependency, helper or configuration added.
Correctness self-review: the observation provides the actual pre-command context;
the exception requires rejected/not_found, so accepted/fault/wrong-code foreign
commands fail. Current-world offers continue through the original predicate.
Existing callers without context retain their previous behavior.

Raw outputs are path-redacted, retained verbatim after redaction and hashed in
[SHA256SUMS](SHA256SUMS); [verification](SHA256SUMS.verify) records hash verification.
Run from the repository root with `mise exec -- node` followed by either script path.
