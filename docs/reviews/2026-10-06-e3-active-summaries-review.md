# Independent review: active system summaries

- Reviewed commit: `594d5a7e5b7aa849f259d1fcf0f6d37fec440213`
- Base: published main `37a2af0c`
- Scope: four corrections in `docs/system/architecture.md`, `future.md`, `protocol.md` and `save.md`
- Verdict: **CHANGES REQUIRED**

## Review

The architecture rows match the existing `mobile/packages/game-view/session.ts` host-neutral boundary and the empty `mobile/packages/ui/` package. The protocol registry has 45 entries; replacing the stale count with a link to the registry is accurate. D2 is installed in mechanics and its exact Read recovery contract agrees with the save summary. M1-A and the current bundled chapter define `real_elapsed` behavior as installed.

- **E3-SUM-1, should-fix — `docs/system/future.md:64`:** Removing `real_elapsed` from Production Story app drops the remaining production work from the summary. M1-A (`docs/system/mechanics.md:584-586`) explicitly says it does not implement a clock source, background driver or recurring catch-up; the S4 scope record also assigns the real-elapsed product carry to the roadmap. Keep the installed elapsed policy out of the future list, but retain a concise item for the unimplemented app clock/resume integration and its governing record.

`mise exec -- elixir bin/check_docs.exs` passed on the reviewed commit: 784 docs, 0 broken links, 0 unreachable. `git diff --check 37a2af0c 594d5a7e` passed. No behavior tests apply to this documentation-only correction.

Ponytail review: Lean already. Ship.
