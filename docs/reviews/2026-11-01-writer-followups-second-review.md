# Second review: writer follow-ups, PR #568 (loka-vduxr.27, .22, .28)

- PR [#568](https://github.com/lorecrafting/lokacore/pull/568) `tools/writer-followups` at `ef679cfbf4a1c945219130e203bdb2a1e0c8a5cf`.
- Scope: the schema change, the `ALLY_ENGAGE_UNUSED` warning, `ENTRY_GUESSED` pooling against TS `spokenBy`. Not the first review's two author-panel nits (817648d31).
- Governing: [mechanics.md Branching dialogue](../system/mechanics.md), [cartridge.md](../system/cartridge.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); four targeted mutants below.

## Must be true (written before the diff)

1. The code is additive to the closed `DiagnosticCode` enum and generated files follow.
2. The ally warning is true and its fix works; it never fires where the fix is wrong.
3. Warning severity keeps the build and hides no error.
4. Elixir warns exactly when `spokenBy` would guess, with pooled entries in key order.

## Checks that held

- (1) Additive. Generated contracts and graph are consistent. The loader never emits the code; TS uses `DiagnosticCode` only as a type. No registry entry (`HOSTILE_QUEST_SPEAKER` has none). No kernel_api or hash change: a compile-only warning changes no kernel behaviour.
- (2) True: `hostileAt` (`disposition.ts:124-126`) needs `attackable`, which excludes allies (`combat/shared.ts:33`), and is the only path to the line (`disposition.ts:80`).
- (3) Warnings split at `compiler.ex:71`. Every `cartridges/*` compiles; the only warnings printed are `TOUCH_LINK_MISSING`, none of the two codes here.
- (4) Both kernels agree on: same target from two entries, a pool into a shared shut hub, a named sibling, key order, a gated link.
- Mutants: dropping `not in seen`, dropping pooling, and a chain that does not add to `seen` are killed; removing the warning is red (1/2).
- PR claims rerun: "No kernel_api or hash changes" (diff stat); the `selection.ts:173` cite (the guard is there).

## Findings

**blocker** `test/loka/content_targets_test.exs:49`: the suite stays green when the warning fires on any ally disposition. Mutant: match `%{"disposition" => _}` in `combat.ex:77`; every Elixir test naming allies stays green (review step 3: a suite that stays green is a blocker). The plain case has no disposition, so its comment's "fires for an ally without one" is untested. Failure: an ally with only `friendly` is told to remove a line it does not have. Fix: one case, an ally with `friendly` and no engage, no warning.

**should-fix** `lib/loka/content/explain.ex:61` and the `docs/system/cartridge.md` Author rule: the fix text fails compile for an ally with `disposition.hostile` (one who refuses talk while hostile). Probe on `targets_sampler`: hostile plus engage warns; removing engage as told gives `SCHEMA_VIOLATION` at `npcs/guard.disposition` (`standing.ex:78`); `unattackable: true`, hostile, no engage compiles clean. Fix: name that third route in both places.

**should-fix** `lib/loka/content/dialogue_links.ex:141`: pooling warns where TS never guesses. Shut `a_one`->`a_x`, shut `b_two`->`b_y`, policy-less unmarked `z_open`: `spokenBy` opens `z_open` whenever both fail, and no fall-through runs, yet Elixir warns `ENTRY_GUESSED` (a fixture case with `warned: []` fails). On main each single-way entry was silent, so pooling adds this. Following "mark entry: true" then shuts out `z_open`. The `:126` comment's "whose entries all fail" is not checked. Fix: an always-open sibling suppresses the group.

**nit** `lib/loka/content/dialogue_links.ex:149`: the warning's target is the first link, not what opens. `a_one`->`m`, `m` shut->(`b_two` shut, `q`): TS opens `q`, the warning names `b_two`. Same on main.

**nit** `protocol/cartridge.schema.json` (Diagnostic description): the warning list this PR extends still omits `OUTCOME_MISMATCH` (`dialogues.ex:333`) and the `cut_scene_line` `SCHEMA_VIOLATION` (`source.ex:98`).

## Against the first review

Same on the schema and that the warning is true. It records the shared fixture passing; the disagreement above is a case outside that fixture, and its check (5) covers shipped cartridges only.

**Verdict: CHANGES REQUIRED.**
