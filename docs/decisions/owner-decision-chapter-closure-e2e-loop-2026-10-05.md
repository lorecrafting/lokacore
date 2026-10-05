# Owner decision: chapter-closure browser E2E loop, 2026-10-05

After each chapter, run a chapter-closure E2E loop against the shared Book browser client:

- Walk the required chapter routes and UI with deterministic browser tests. Keep these model-free and assert observable behavior; do not infer chapter coverage from the existing saved-move test.
- Run an exploratory E2E pass to find usability and route defects that the deterministic list misses. Agent-driven exploration may require a configured model provider, subscription or API key; it is a separate cost-bearing activity from deterministic tests.
- Give the owner a visible headed browser run or a video of the chapter walk.
- Fix findings on an isolated chapter-polish branch. Rerun each failed path and the whole chapter walk after fixes.
- Finish with a fresh independent review of the exact final head before closing the chapter.

When a finding exposes a deep mechanics or save defect, add the narrow behavior test and review it through the owning slice. Keep fixes and review bounded as findings arrive; do not accumulate an unwieldy unreviewed batch.

The E2E loop supplements kernel, authority, save and contract checks. It does not replace them or establish native-device or public-release readiness.
