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

## Re-check at f0093ef457b29d753b5f636530d49bb6f7a667d6

CI at this head: ci, book-e2e, graph-diff completed, success. Only the fix commit's findings were checked.

| Finding | Disposition | Proof |
|---|---|---|
| Friendly-only ally test | Fixed | The any-disposition mutant in `combat.ex` now fails (16/17). |
| Ally advice | Fixed | Compiled on `targets_sampler`: disposition removed, `unattackable` plus `hostile` without `engage`, and `friendly` kept all pass with no warning; `hostile` without `engage` still gives `SCHEMA_VIOLATION`. |
| Schema warning list | Fixed | `OUTCOME_MISMATCH` and `cut_scene_line` added; they match the warning sites. |
| `shut_groups`, reported case | Fixed, new defect below | The new fixture row passes both kernels; removing the exclusion fails (16/17). |
| Target names first link | Filed `loka-69yuw` | Agreed, same on main. |
| Hanging 5001 ms mutant | Filed `loka-votey` | First review's item; matches. |

**should-fix** `lib/loka/content/dialogue_links.ex:142`: `always` treats every policy-less entry as one that opens, but `spokenBy` also needs a shown choice (`selection.ts:168-171`). Shut `a_one`->(`a_x`, `b_y`) beside policy-less `z_open` whose only choice has a failing policy: TS opens `a_x` (fixture row passes), Elixir no longer warns (expected `["a_x"]`, row fails). The fix swaps a false warning for a missed real guess, which `ef679cfbf` did warn. Fix: count an entry only if it has a choice with no policy, and add this row.

**blocker** `test/fixtures/dialogue_entry_cases.json`: three conditions of the new `always` line are untested (review step 3). All stay green, 17 passed: (a) exclusion across all speakers (`always == []`); (b) a policy-less keyword entry counts; (c) a named entry does not count. Failure for (a): another NPC's policy-less dialogue silences this speaker's real guess. Probes that kill them, on this head: a row with `z_other` spoken by `other` (`opens: a_x`, `warned: [a_x]`, passes both kernels) for (a); a named policy-less `z_n` (`opens: z_n`, `warned: []`, passes both) for (c); a shut entry beside a policy-less keyword entry, Elixir only, for (b).

**Verdict: CHANGES REQUIRED.**

## Final re-check at acf36c5f7e776eac7ab2f71c25337e657bddfeef

Only the two re-check findings and `opens?/1` were checked.

- `z_n` row: the developer is right; my re-check wording "a named entry does not count" named only the mutant, and the row is correct. `spokenBy`'s `tried` filters on `keyword` and `selected`, never `name` (`selection.ts:162-165`); `d.name` only stops the fall-through after a failure (`:173`). A TS mutant skipping named entries fails the shared cases.
- Shared cases pass in both kernels. Elixir mutants fail 16/17: `always == []`, keyword counts, named not counted, choice condition dropped.
- Should-fix on a policy-less entry whose only choice fails: fixed, row passes both kernels.
- Filed: `loka-vduxr.31`, `loka-69yuw`, `loka-votey`. Agreed.

**blocker** `lib/loka/content/dialogue_links.ex:149`: `Enum.any?` to `Enum.all?` in `opens?` stays green, 17 passed (review step 3). Failure: a policy-less hub with one plain and one gated choice opens in TS, yet the mutant warns `ENTRY_GUESSED`, the original false positive. Fix: add a fixture row, shut `a_one`->(`a_x`, `b_y`), `z_open` with `bye` and a `gate: policy` choice, `opens: z_open`, `warned: []`. Run here: the row passes both kernels and fails the mutant.

**nit** `lib/loka/content/dialogue_links.ex:149`: `opens?` and its "always opens" comment ignore `offered` (`selection.ts:99`). A policy-less entry whose only plain choice teaches a concealed skill offers nothing in TS, so a real guess goes unwarned. Read from the code, not run. Disposition: file it, or fix the comment.

**Verdict: CHANGES REQUIRED.**
