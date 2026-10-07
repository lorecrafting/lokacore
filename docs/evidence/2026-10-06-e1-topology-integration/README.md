# E1 topology integration checkpoint

Provisional source-bound proof at `53e74d7d4f2cd8ed7388264ac313d7f824196ca8` on the frozen v042 candidate. The [approved literal route](../../reviews/2026-10-06-e1-legal-routes-review.md) is registered in the recorder and semantic replay; its implementation participates in the source check digest. E1 certification remains pending.

- `focused-green.log`: eight focused E1 tests pass, exit 0. TypeScript typecheck also passed.
- `replay-registration-red.log`: removing the topology replay allowlist entry makes the integrated route test fail, exit 1; restored afterward.
- `cli-record.log` and `cli-report-summary.json`: complete recorder exits 2, pending with null verdict and no failure; all 57 literal room visits observed, no room gaps. Exactly one previously approved study_tracks consequence is witnessed; 647 authored obligations remain pending.
- `topology.jsonl` and `cli-topology-replay.log`: retained source-bound topology commands and state/receipt digests replay through the actual invariant checker, exit 0. Artifact bytes can be reconstructed from `protocol/fixtures/missing_child_v042_hash.json` using its canonical payload and independent SHA-256 answer. Other case traces/databases from this run are not retained here; the summary does not certify those receipts.
- `full-gate.log`: `mise exec -- bin/check_all.sh`, exit 0 on the same source. This historical-corpus gate is distinct from the final chapter-specific 10,000-sequence proof.

Capture redaction covers local paths. Generated world/entity IDs and clocks are controlled proof inputs, not owner-device identifiers. No owner save, native lifecycle, browser interaction or UI blur is exercised. Remaining authored paths, final candidate after published fixes, selected 10,000 sequences and independent gate acceptance remain pending. This evidence commit adds documentation after the recorded source; it issues no final certificate.
