# Chapter-closure browser E2E loop

Reviewed exact head `bfd8b20e4d972b4de742a9da5913f4699742e5eb` against `05e72a3cb831b9facf50c05b08f54581ce7d0c1c`.

Verdict: **CHANGES REQUIRED**.

- **Should-fix E2E-1 — `docs/decisions/owner-decision-chapter-closure-e2e-loop-2026-10-05.md:6`:** State that agent-driven exploration uses an already authorized provider/subscription or a local model, with no new purchase required; if none is available, record the exploratory pass as pending rather than imply spending is part of closure. The current wording transparently says it may require a subscription/API key, but mandates the exploratory pass without defining the no-new-spend path. The runner supports local models and deterministic tests need none.
- **Nit E2E-2 — `docs/web-preview.md:41`:** Link the runner's [Debugging a run](https://e2e.tester.army/docs/debugging) page for `--headed` and `--video`. The cited Expo guide is not the direct source for these runner flags; the e2e overview supports the deterministic/model-driven distinction.

Verified the current `mobile/app/package.json` uses e2e `^0.17.0` and the documented `npm run test:e2e -- tests/book.e2e.ts --headed --video` invocation follows the runner's optional `--video` argument rule. The existing test is accurately described as a single saved-move-after-reload check, not chapter route/UI coverage. Workflow and E3 language preserve the mobile pause, isolated fixes, reruns and exact-head review. No model or paid-service requirement is added to deterministic tests; no native or public-release proof is claimed.

No source files changed. Docs were reviewed against the workflow, owner rules, E3 brief, web-preview instructions, package manifest and current installed runner version. No tests run for this docs-only review.

## Independent Sol fix check

Reviewed exact source head `f8f91c4f` against the prior reviewed `bfd8b20e`; authored none of the source. Requirements: no new spending for exploration, model-free deterministic coverage, direct evidence for headed/video flags, and preserved bounded fixes and exact-head independent review.

Verdict: **APPROVE**. No open findings.

- **E2E-1 closed:** the decision now permits only an already authorized provider/subscription or a local model, forbids new paid services, and records agent exploration as pending when unavailable while deterministic and human walks proceed. The workflow and E3 link that governing decision.
- **E2E-2 closed:** web-preview links the runner's [Debugging a run](https://e2e.tester.army/docs/debugging) page. Independently checked its headed/video instructions and optional video-mode argument rule; the documented test path precedes `--video`.

Validation: `mise exec -- elixir bin/check_docs.exs` with writable temporary mise state: 525 docs, zero broken links, zero unreachable; `git diff --check` passed. Short docs-only correctness and simplicity review found no additional issue; no implementation or tests changed, so mutation testing does not apply. Prior review preserved.
