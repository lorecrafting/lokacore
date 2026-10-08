# Docs and checks hygiene review

PR #303, branch `chore/docs-checks-hygiene`, head `a8ef943b`, base main `294062aa`. Independent
reviewer. Sources: Fable docs review batch B, F11, F46 and hygiene F9; PM rulings skip F6, F7, F48,
the STATE.md half of F45 and the F38 "awaiting" line. Governing text: [WORKFLOW Review stance](../WORKFLOW.md#review-stance),
[CHECKS](../CHECKS.md), AGENTS.md Simplicity.

**Verdict: CHANGES REQUIRED**

## What must be true

1. The anchor check accepts every fragment that GitHub resolves (heading slugs and explicit `<a id>`/`<a name>` targets) and rejects the others.
2. The red controls fail when the check's core logic is broken: slug, duplicate suffix, relative-path resolution.
3. The beads control does not read the live tracker and still kills realistic checker breaks.
4. Docs edits fix links only and do not change the meaning of decision or review records. Permalinks resolve to the deleted files.

## Findings

1. **blocker**: `bin/check_docs.exs:45-64`. Slugs come from headings only, so explicit `<a id>` aliases are ignored. `docs/system/*` has 30+ of them, added in `57b555b5` to keep links stable across heading renames. 22 of the 35 fragments this PR rewrote were working links through such aliases (for example `save.md#d7-deer-recovery-planning-contract`, alias at save.md:1009). Scenario: a new link to any alias fails CI although GitHub resolves it. The decision and review-record rewrites that only replace alias links are not needed. They may be reverted once aliases are honoured; the PM decides.
2. **blocker**: `bin/docs_red_controls.sh:20`. Every planted target is either an absolute `$PWD/...` path or a self link. With `Path.dirname(abs_file)` at check_docs.exs:80 replaced by `root`, the red control and the repo check both stay green, and `../system/x.md#...` anchors are never checked (a target that fails `File.regular?` is skipped). The same holds for the duplicate `-1` suffix mutant (check_docs.exs:62 always `base`) and for deleting the link-text strip (line 55). None of the three is planted.
3. **should-fix**: `docs/MISSING-CHILD-PLAN.md:90` says "their repairs are closed". `loka-arch-d10-*` 02–05 are open (tracked post-E3 risks). Scenario: a reader concludes that no architecture follow-up remains. Fix: "correctness defect resolved; maintenance risks tracked in Beads".
4. **nit**: `docs/WORKFLOW.md:193` says "its header says what it prints", but session_status.sh:2 says only "live tracker and PR state". The three drift categories are no longer described anywhere in prose.
5. **nit**: check_docs.exs:59 keeps `_`, so the heading `_emph_ word` slugs to `_emph_-word`; GitHub gives `emph-word`. Setext headings are also not parsed. Neither occurs in the repo today.

## Mutants

Anchor check:
- Killed: inverted membership, no downcase, no punctuation strip, no space-to-hyphen, duplicate count starting at 1, broken self-link path.
- Survived: path resolved from root, no duplicate suffix, no link-text strip (finding 2).

Beads checker, new control:
- Killed: `set()` comparison instead of sorted, wisp test, `--complete` off, em-dash title pattern.
- Survived: no sorted term, no `len` term, no unique-ID check, no dependency check. The old control at `294062aa` also lets all four through, so these are pre-existing gaps and not a regression.
- `len` is implied by the sorted term (equivalent mutant). Only the sorted term catches a same-count swap (one code missing, one duplicated), and no variant plants that.

## Checked, no finding

- 5 distinct permalinks at `f8513671` resolve with `git cat-file`. Deleted INDEX.md and REVIEW-GUIDE.md are identical at `f8513671` and the base, and no non-Markdown file references them.
- Slug probes for inline code, `C++ & Rust`, em dash, Unicode and percent-encoding match GitHub.
- Agent `model:` frontmatter matches the WORKFLOW `sonnet`/`opus` rows. The `#building-mechanics-by-composition` target is the one WORKFLOW:70,90 already uses.
- LATER-ENDINGS keeps "awaiting" (F38 ruling).
- CI on `a8ef943b`: all 7 jobs pass.

## Fix round 1 (`23bb022c`)

**Verdict: APPROVE**. Nothing is open.

1. Finding 1 is closed.
   - check_docs.exs:47 now reads `<a id>`/`<a name>` targets.
   - All decision and archive-spec anchor rewrites now match base. The only remaining rewrite is `WORKFLOW.md#beads-rust-pilot` in the 10-06 review record, and that fragment has no heading or alias at base.
   - The a3 links are unchanged from base and resolve through the cartridge.md:556 alias.
   - The repo check passes: 0 broken anchors.
2. Finding 2 is closed. docs_red_controls.sh now plants a `sub/` file with `../` links, a `-1` suffix, a heading with link syntax and an alias. It also checks that exactly 4 anchors are reported. Mutants run once each, all killed:
   - path resolved from root;
   - no duplicate suffix;
   - no link-text strip;
   - aliases dropped;
   - inverted match;
   - broken same-file link.
3. The new swap variant kills the beads mutant that drops the sorted comparison (it survived in round 0).
4. MISSING-CHILD-PLAN:90 now names ARCH-D10-02 to 05 as open. WORKFLOW:193 lists the three drift categories, which match `beads_pr_drift.py` as described at review time.
5. Nit 5 has no change, by PM ruling.

When this round was written, CI on `23bb022c` showed changes and lint passing, with browser, elixir, sim and typescript still pending.
