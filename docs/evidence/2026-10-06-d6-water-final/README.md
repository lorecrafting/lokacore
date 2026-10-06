# D6 water depths — final local source integration

This is developer evidence for the unpublished D6 source branch, integrating
published D3/D12 and the docs-only C5 plan at `f014aa26`. It is not an
independent review or a publication record. Final source review and hosted CI
remain for the release workflow. The active chapter is v035/API 1.30; its
independently derived hash and 190 starting IDs are in the pinned v035 fixtures.
Frozen earlier fixtures were not edited.

The local full pre-push gate passed (`full-gate.log`): Elixir 375/375, Credo,
contract generation and examples, docs/tracker guards, TypeScript 720/720,
headless simulation, size guards and formatting. The actual bundled chapter
also passed two browser paths (`browser.log`): both underwater bottoms and free
Surface with lit loot, and controlled drowning followed by Chapel recovery
and cold refresh. The real file-backed SQLite bought-torch recovery test passed
(`custody-green.log`). Removing only the historical recovery custody branch
made it fail `save_corrupt` (`custody-red.log`). Removing the shared
`job.cancel` `requiredUnless` guard made the frozen combat fixture fail
(`schema-red.log`). These failures are intended red controls.

The D6/D12 merge initially exposed two contract omissions. Five water contract
definitions now have valid literal examples. The existing conditional required
keyword preserves legacy combat cancellation's required encounter ID while
allowing a generation-bound water cancellation. The merged Elixir complexity
findings were resolved by splitting predicates without changing their
conditions. Documented file size allowances cover the merged water and D12
paths. Ponytail Review found no new dependency, state copy, adapter, or
speculative helper; the extracted functions are direct local predicates needed
by the required gate. Self-review checked both cancellation shapes, the
original-root bought-item save path, and the actual diff. No known behavioral
blocker remains; independent review is still required.

All retained logs were redacted by `capture.py`. `SHA256SUMS` covers the files
except itself and `verify.txt`; `verify.txt` records a successful verification.
