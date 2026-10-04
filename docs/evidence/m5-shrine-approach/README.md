# M5 chapel-approach content evidence

[PM scope and provenance](../../decisions/pm-decision-sampler-shrine-approach-2026-10-04.md)
govern the development release; [the brief](../../briefs/m5-shrine-approach-content.md)
defines acceptance. [Provenance](provenance.json) records the inspected prototype
filename/hash, exact prose adaptations and independent IdSource inputs/ordinals.
[Validation](validation.json) records this focused developer batch and the first full-prepush stale-pin
failure; it is not a final successful pre-push, independent review or device proof. No owner app/save was touched.

The existing independent compiler answer/cross-loader tests passed, as did both
original sampler quest/save outcomes. The private controlled authority probe
walked the literal route to the nave, invoked Look and returned through reciprocal
exits; its commands/assertions are recorded in validation. No repository test was
added. Removing the nave's south exit made the existing compiler-answer test fail;
the restored source passed. Actual redacted logs are retained beside the records.

The first full pre-push refused publication because the app test retained the old
current-development hash. Its literal pin was updated from the independent oracle;
`mise exec -- node --test mobile/app/sampler.test.ts` then passed unchanged behavior.

Commands run in the isolated checkout, with `MIX_ENV=test` and `ERL_FLAGS=+S 2:2`:

- `mise exec -- mix deps.get`
- `mise exec -- mix test test/loka/content_sampler_test.exs test/loka/cartridge_cross_kernel_test.exs`
- `mise exec -- node --test mobile/authority/local-story/sampler.test.ts`
- `mise exec -- node <private one-off route probe>` (exact controlled inputs in validation)
- `mise exec -- mix test --force test/loka/content_sampler_test.exs` (planted missing-exit failure)
- `mise exec -- mix test test/loka/content_sampler_test.exs` (source restored)

[Checksums](SHA256SUMS) cover the retained records/logs; the checksum list excludes
itself and its [verification result](hash-verification.txt). Historical 0.0.2 proofs
remain unchanged and do not establish 0.0.3 IDs/hash.
