# Independent review: E1 dialogue and selected choice binding

- Reviewed commit: `90282979`
- Recorder base: `6ed24201`
- Scope: candidate dialogue/choice witnesses, replay policy, real SQLite test and retained evidence
- Verdict: **APPROVE**

## Review

The existing E1 policy already requires committed dialogue choices and exact authored-path witnesses. The architecture addition clarifies that an accepted `talk` witnesses only a newly opened pending dialogue, while an accepted `choose` witnesses the selected choice on its pending dialogue continuation. The implementation follows this policy: it derives dialogue paths from new pending rows after an accepted talk and derives the choice path from the command's continuation and choice ID. Replay recomputes each witness from the command and before/after state, then requires the explicit receipt path; it does not trust the logged claim alone.

The new test uses the real `DatabaseSync(path)` host and observes committed receipts. It asserts the talk step records only the dialogue path, then replay records that path and the exact selected `accept` path. The retained mutant adds the choice path at dialogue open: both prior focused tests pass and the new test fails with the extra path. This detects the realistic false credit named by the test. The old `study_tracks` assertion is broadened only to accommodate the independently verified dialogue witnesses; it still requires that consequence and leaves the containing recipe pending.

Evidence review: all five retained artifact hashes verify. The privacy scan found no home/temp paths, device labels, UDID/serial labels, or team/signing identifiers. The checkpoint remains bounded and explicitly does not claim final E1 certification, 10,000 sequences, or native proof. The original implementation adds one focused behavior test and extends the existing test-only witness helper; Ponytail review found no unnecessary abstraction or dependency.

Checks run:

- `mise exec -- node --test test/e1_cases.test.ts`: 3/3 passed; this includes the file-backed SQLite dialogue/choice case.
- `mise exec -- npm run typecheck`: passed after installing lockfile-pinned dependencies in the disposable review worktree.
- `mise exec -- elixir bin/check_docs.exs`: 808 docs, 0 broken links, 0 unreachable.
- `git diff --check 6ed24201 90282979`: passed.

No findings. E1 final certification remains pending.
