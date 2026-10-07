# Local and hosted check audit — 2026-10-06

Read-only audit of the checks at `06ca984f`, followed by the scoped selector in this change. Job times below are execution times from the last 20 hosted runs (10 `ci`, 10 `book-e2e`); queue time is excluded. Historical local timings are observations from linked evidence, not new measurements on this head.

| Area | Before | Observed time | Change |
|---|---|---:|---|
| Local pre-push | Full Elixir, lint and red controls on every push; TypeScript selected by a partial path list | Full passing line: 155.57 s ([B8 evidence](2026-10-05-b8-maud-services/final-integration-checks.json)) | Metadata and Book-only pushes run docs and Beads guards; source pushes run full local line, closing the incomplete TypeScript input list. |
| Hosted `changes` / `lint` | Every PR/main push | 7–10 s / 16–29 s | Retained. Lint checks docs links, tracker export and skip guards. |
| Hosted Elixir | Any non-Markdown PR change; every main push | 61–87 s | Skip only metadata or Book-only ranges after a green code ancestor. |
| Hosted TypeScript | Same | 100–155 s | Same. Authored cartridges and Elixir content compiler inputs keep this job. |
| Hosted headless simulator | Same | 58–113 s | Same. Source changes retain the 10,000-sequence CI run. |
| Hosted Book browser | Every PR/main push, including docs | 68–238 s | Skip metadata-only ranges after an ancestor whose browser job actually passed; Book and game source changes run it. |

[PR #238](https://github.com/lorecrafting/lokacore/pull/238) (Book room presentation rules) was Markdown-only: its [CI run](https://github.com/lorecrafting/lokacore/actions/runs/37495247880) took 25 s with code jobs skipped, while its [browser run](https://github.com/lorecrafting/lokacore/actions/runs/37495247950) took 238 s. Its main merge then reran [full CI](https://github.com/lorecrafting/lokacore/actions/runs/37495838033). [PR #236](https://github.com/lorecrafting/lokacore/pull/236) (D9 village reactions and Study dependency correction) changed Markdown plus `.beads/issues.jsonl`, yet ran the full engine line.

We did not split the three code jobs further: TypeScript tests compile the authored chapter through Elixir, and a kernel/content/contract edit can change all three results. Browser remains active for game source because current browser behavior depends on those changes. This is a conservative first area split. Checker, workflow, lockfile, generated Markdown, protocol and unknown paths run the broad line. Failed ancestry/API lookup runs broad checks. `mix hex.audit` stays in the hosted Elixir job for source changes; dependency updates always enter that lane. Existing native build workflows remain manual-only.

The selector's planted cases cover metadata, Book-only, mixed code, generated Markdown, rename, empty/non-ancestor range and GitHub API failures. A deliberate wrong classifier must make the planted check fail. Red-control scripts mutate fixed paths, so they run sequentially in an isolated checkout.

## Erratum: local-story authority scope (2026-10-06)

The original selector skipped every `mobile/` path in the code lane, including
`mobile/authority/local-story/store.ts`. That was broader than the owner decision
that save changes retain broad code checks. The corrected selector excludes the
local-story authority directory from the mobile app exception, with a planted
save-edit comparison that fails under the original selector. App-only changes
still skip code jobs and run browser checks. The timings and observations above
remain historical; this correction adds no native or separate authority test lane.

Focused correction controls: the original selector and original controls passed;
the new save-edit control against the original selector failed with
`FAIL ci_scope local-story save change runs code: want run, got skip`. Restoring
the corrected selector passed the same controls, including app-only code skip
and browser run. Shell syntax and `git diff --check` also passed.
