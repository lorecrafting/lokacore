# CI npm download caching review

PR #162 — cache npm package downloads in the simulator, TypeScript and mobile bundle jobs.
Commit reviewed: `1ae1f03202167a6b7386b8d2eb3d8a28edb8ed03`.

## Requirements before reading the diff

Derived from [Checks](../CHECKS.md) and the [delivery workflow](../WORKFLOW.md):

- Preserve all six source-head jobs, test commands, red controls and existing triggers.
- Use the pinned setup-node action's native npm download cache; each modified job must key it on every lockfile that job installs.
- Keep locked clean installs and read-only workflow permissions; cache misses must remain valid.
- Verify the actual source-head CI and accepted cache inputs; no speedup claim without a warm comparison.

## Verdict: APPROVE

Independent reviewer authored none of the implementation. No findings.

- The nine-line, two-file diff only adds native setup-node cache inputs. No jobs, conditions, tests, red controls, timeouts or permissions change. `npm ci` remains in every affected install step.
- Simulator keys `kernel/ts/package-lock.json`; TypeScript keys mobile, kernel and root lockfiles; mobile bundle keys `mobile/app/package-lock.json`. These exactly cover each job's install directories.
- The [pinned setup-node action metadata](https://github.com/actions/setup-node/blob/820762786026740c76f36085b0efc47a31fe5020/action.yml) declares both `cache` and multiline `cache-dependency-path` inputs. Native npm caching reuses package downloads; clean locked installs still run.
- Workflows keep `contents: read`, pinned actions and checkout with persisted credentials disabled. No new secret or write permission is introduced.
- Inspected [CI run 37231776204](https://github.com/lorecrafting/lokacore/actions/runs/37231776204) and [bundle run 37231776212](https://github.com/lorecrafting/lokacore/actions/runs/37231776212) for the reviewed source head: lint, changes, Elixir, TypeScript, simulator and bundle all succeeded. All three changed setup-node steps accepted the inputs and saved caches under distinct lockfile-derived keys.
- No new logic or tests: mutation testing omitted under the workflow's config-only review rule. Speed improvement remains unmeasured until a warm comparison.

Ponytail Review: Lean already. Ship.
