# Independent review: web-first mobile pause (PR #191)

- Reviewed commit: `aa9628a19f3dc76bd37b6b2284b9d65ba9fcf9cd`
- Scope: CI workflows, local checks and governing documentation; config/docs review
- Verdict: **CHANGES REQUIRED**

## Requirements

The owner's 2026-10-05 direction pauses Android/iOS development, builds, simulator sessions and mobile CI checks until further notice. The Node TypeScript game simulator remains active as an engine correctness gate. Elixir/TypeScript kernel, contracts, content and documentation checks remain active. The pause and a later restart must be clear to future agents; browser preview is a separate prospective slice.

## Review

The `ci.yml` jobs retain Elixir, TypeScript, lint and `sim`. Its mobile app compiler/tests, mobile lint/format/size, Hermes bundle and native triggers are removed or filtered. Both dedicated mobile workflows have only manual triggers in source and GitHub reports each `disabled_manually`. `bin/ci_base.sh` still requires successful `elixir`, `typescript` and `sim` jobs before a Markdown-only skip; CI at the reviewed head has all five jobs green. `WORKFLOW.md` describes browser preview as a possible later slice. The new decision, owner-rules, architecture and CHECKS links agree on the pause and restart.

Findings:

- **F1, should-fix — `AGENTS.md:140`:** The mandatory agent entry point still says “CI runs them all” and instructs agents to “run everything locally,” while this PR intentionally defers mobile checks. A Claude Code handoff following that line can mistake the paused mobile checks for required PR gates or re-enable them. Amend this short checks paragraph to point to the active checks and the temporary owner decision.
- **F2, should-fix — `bin/check_all.sh:34`:** The old no-argument size check included tracked and untracked nonignored files. The new explicit `git ls-files` selection includes tracked files only. A new untracked `kernel/ts/src` file over 300 lines passes the local size check before staging, weakening the active non-mobile gate. Include untracked nonignored files in the non-mobile selection, as line 36 already does for Prettier. Keep CI's tracked-only selection if desired.

`git diff --check origin/main...HEAD` passed. The exact-head CI run completed successfully (`changes`, `elixir`, `lint`, `sim`, `typescript`). No code mutation test is needed for this config/docs slice.
