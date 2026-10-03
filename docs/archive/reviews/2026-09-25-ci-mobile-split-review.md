# Independent review: PR #30 "CI: native mobile builds only on native inputs"

- PR: [#30](https://github.com/lorecrafting/lokacore/pull/30), branch `ci-mobile-split`
- Commit reviewed: `2f34de8` (`37ebd55` plus a merge of `main`)
- Reviewer: Claude Opus 5.5, fresh agent; authored none of the work.
- Depth: short (config-only slice, no mutation testing, per WORKFLOW "Review stance").
- Brief: [owner decision](../decisions/owner-decision-ci-mobile-builds-2026-09-25.md).

## What must be true

1. Native builds (`mobile.yml`: `android`, `ios`) run on PRs that change native inputs, on
   every push to `main`, and on manual dispatch; build steps unchanged.
2. PRs touching kernel or mobile JS/TS run one Linux job that compiles Hermes bytecode for
   both platforms and fails when `loka-kernel` is absent from either.
3. No file that feeds the JS bundle escapes the bundle filter; files that feed prebuild but
   escape the native filter are caught on `main`.
4. WORKFLOW step 7 reads "every CI job that ran is green on the head"; the AGENTS.md CI
   line matches and stays under budget; `ci.yml` unchanged; no unpinned third-party action.

## Verdict: APPROVE WITH NOTES

No blocker, no should-fix. Two nits.

## Verified

- **Native filter.** `mobile/app/.gitignore` ignores `/android/` and `/ios/`; `git ls-files
  mobile` has neither. There is no `app.config.*`, `babel.config.js`, config plugin,
  `react-native.config.js` or `eas.json`; `app.json` has no `plugins`. So today the prebuild
  inputs are exactly `package.json`, `package-lock.json`, `app.json`, `metro.config.js`
  (and Node, pinned in the workflow itself). The decision record lists `android/**` and
  `ios/**` too; the workflow comment explains why they are omitted. Fine.
- **Kernel package.** `mobile/app` does not depend on `kernel/ts` via `file:`; it reaches
  the kernel only through a relative import (`mobile/authority/local-story/index.ts:3`) and
  Metro `watchFolders`. Expo autolinking reads `mobile/app`'s dependencies only, so a
  `kernel/ts/package.json` change cannot alter native linking. A new kernel runtime dep
  would fail module resolution in the bundle job (no `npm ci` in `kernel/ts`), loudly.
- **Bundle filter.** Nothing in `kernel/ts/src` or `mobile/` imports outside `kernel/` or
  `mobile/`; `mobile/**` + `kernel/**` covers every bundle input, including a future
  `babel.config.js`.
- **The grep inspects fresh Hermes output.** PR #30 run 36191346966 at `2f34de8` logged
  `_expo/static/js/{android,ios}/index-*.hbc (1.7MB)`; output goes to `$RUNNER_TEMP/dist` on
  a fresh runner with no cache step, so no stale artifact. The step runs under
  `bash -e {0}` (log), so the android iteration failing aborts the loop; a missing glob
  makes `grep` exit 2. `loka-kernel` also appears in `contracts.gen.ts` examples, but the
  app imports only `KERNEL_ID`'s module chain; the same weak-smoke semantics as before.
- **CI proof.** #30: `android`, `ios`, `bundle`, `elixir`, `lint`, `typescript` pass at
  `2f34de8`. Draft #31 (only `kernel/ts/src/index.ts`): `bundle` ran and passed; no
  `android`/`ios`. Draft #32 (`App.tsx` import replaced by a constant): export step
  success, "Kernel is in both Hermes bundles" step failure. Both drafts closed.
- **`paths` on `pull_request`** is evaluated on the whole PR diff against the base, not the
  latest push, so a later docs-only push to a PR that touched `kernel/` still runs `bundle`
  on the head. That is what the new merge rule needs.
- **Docs-only merges to `main` running native builds:** not a real problem. The repo is
  public (free Linux and macOS minutes); ~6 min per merge. With `cancel-in-progress`, merge
  B cancelling merge A's run still builds A's changes, since B contains them.
- **Branch protection:** `GET .../branches/main/protection` returns 404 "Branch not
  protected"; rulesets `[]`. So no required-check names break when jobs are skipped.
- **Rest.** `ci.yml` untouched; `mobile.yml` build steps unchanged; `mobile-bundle.yml`
  reuses the two SHA-pinned actions already in use. AGENTS.md 1719 → 1733 words (budget
  2500, `bin/check_docs.exs:56`). Nothing to delete: one 33-line workflow, one job.

## Findings

1. **nit — `.github/workflows/mobile.yml:7-12`.** The native filter names today's files, so
   the first time someone adds `mobile/app/app.config.ts`, a local config plugin
   (`mobile/app/plugins/*.js`) or `react-native.config.js` and then edits only that file,
   the PR runs `bundle` only (green) and a prebuild or Gradle/Xcode break lands on `main`.
   Accepted by the owner's decision ("shows up on main within minutes"); cheap to close by
   adding those paths to the filter in the PR that introduces them. A comment line saying
   so would help the next author.
2. **nit — `docs/WORKFLOW.md:66`.** "Every CI job that ran is green on the head" can be read
   as ignoring a job still queued or in progress when the PM checks (it has not "run" yet).
   Scenario: the PM merges while `ios` is pending on a `package.json` PR. Suggest "every CI
   job started on the head has finished green". Also known GitHub limit: a PR diff over 300
   files can skip a path-filtered workflow silently; unlikely here.
