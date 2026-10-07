# E1 loader carry integrated independent review

- Reviewed local branch `proof/e1-loader-integrate`, source `03eb7089`, against published post-D10 status base `87ac4cbb`.
- Fresh independent reviewer; authored none of the source or tests.
- Verdict: **APPROVE**. No findings or open items within this scope.

## Requirements

Derived from [cartridge implicit dependencies](../system/cartridge.md#compiler), [artifact and loader](../system/cartridge.md#artifact-and-loader), [scene cursor ownership](../system/mechanics.md#scene1-mechanicsscenerulets), and [contract lessons](../lessons/contracts.md): position/scene require effective `fact@1`; malformed untrusted artifacts refuse at the first failing stage with deterministic diagnostic order; lock/manifest, content-hash and installed-capability mismatch refusal remain intact; valid current v042 content still loads. Frozen fixtures and their expected answers must remain unchanged.

## Proof

- Independent focused run: `mise exec -- node --test kernel/ts/test/cartridge.test.ts`, exit 0, 78/78; restored run also exit 0, 78/78.
- In a disposable detached worktree, replacing the loader with `87ac4cbb` made only the new dependency test fail: malformed position content returned `ok: true` instead of the literal refusal; 77 existing tests passed. Removing only the scene guard separately made that test fail on the scene case. Both red controls exited 1; source restored before the final green run.
- Seven independent controlled probes, exit 0: missing fact dependency; wrong fact version; manifest/lock mismatch; malformed lock schema; bad hash preceding dependency refusal; installed fact capability missing; current `missing_child_v042_hash.json` content loading successfully with the installed kernel.
- Correctness pass: dependency diagnostics join the existing lock-stage collection and retain its path/code ordering; schema and hash validation precede it. No artifact rewriting, mismatch relaxation, new protocol contract or frozen-fixture edit.
- Ponytail/Ponytail Review: lean already; no unnecessary machinery or dependencies. The new test catches a distinct admission bug and uses literal expected diagnostics.

This approves only the preserved loader carry on the post-D10 integration base. Final A–D E1 certification, hosted checks and publication remain separate PM gates.

## Hosted exact-head second opinion

```text
Verdict: APPROVE — loader integration only; not final E1 certification.
Head: fec404d338b647ef2e59217f5521105ddd47da39
Base: 87ac4cbbad74c3ddeef61ccc24089878e57a104c

Findings: none.

Verified: effective fact@1 dependency, diagnostic precedence,
hash-correct malformed artifact refusal, frozen v042 loading,
and unchanged save/pin refusal. No needless complexity.

Evidence: 78/78 focused tests; old-loader and scene-only red
controls each fail only the new test; 11 refusal/precedence probes
pass; exact-head hosted workflows green. Read-only; no mutations.
```