# Pre-push remote main fallback — independent scoped review

**Verdict: APPROVE.** Exact source
`963252bedb2efa4ac217a1bdbf2b7d4ecceaf8d5`. Scoped re-review of the new-branch
TypeScript-check fallback; fresh reviewer authored none of the change.

The stale-tracking finding is closed: the hook skips TypeScript only when the
local `<remote>/main` SHA matches the advertised destination `main`; missing or
mismatched refs run the full checks. The push-URL finding is closed: `ls-remote`
queries pre-push's actual destination URL (`$2`), including named remotes with a
separate push URL. Source changes still trigger TypeScript checks. No findings.

The supplied controlled bare-remote cases cover matching, stale tracking,
unknown remote, source changes and split fetch/push URLs; the destination mutant
fails the stale split case. `sh -n` and `git diff --check` pass. Ponytail: one
stdlib check, no extra machinery.
