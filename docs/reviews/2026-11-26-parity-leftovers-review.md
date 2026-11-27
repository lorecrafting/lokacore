# Review: Builder parity leftovers, cartridge `none` rows (PR #817, loka-hcnlh.56, .52, .81)

- PR #817, branch `builder/parity-leftovers`. Reviewed at `09010b59d56ebb4b4f25dc17fa61f3a4f2b7c113`.
- Governing: [in-game-builder-mode §6.7](../rnd/in-game-builder-mode-2026-11-19.md#67-the-parity-gate-extension) (registry `book` per row, todo only shrinks, red controls); [gui-editor-design §7](../rnd/gui-editor-design-2026-11-04.md) (registry input).
- Why a record: a registry/gate contract change (`none: <reason>` in `kernel/ts/play/registry.json`, `bin/editor_gate.exs`).
- CI at the head (`gh run list --commit 09010b59d…`): ci, book-e2e and graph-diff succeeded.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. `none` is accepted only when the panel and the book side of a schema row both say `none: <non-blank reason>`; one side, a bare `none`, or `none` on a `parity.json` row is refused.
2. No `todo` leaves the set without its baseline line going (a `none` cannot dodge a todo silently), and no `none:` string is mistaken for a file or for `todo`.
3. Each flipped row is really offered by the Book, with a test that fails when the offer goes.
4. A `none` edit never becomes an rjsf `ui:field`.

## Checks run

- Gate at the head against today's `origin/main`: exit 1 only for `parity:inspector-header` and `parity:story-row-sheets` ("rebase if main shrank", #816 merged after the branch). After merging `origin/main` (no conflicts) the gate exits 0 and `elixir bin/red_controls.exs` reports 0 FAIL.
- Planted against the gate, each exited 1 with the right message: book `none` with a panel file; panel `none` with a book file; `none:x` (no space); `none:  ` (blank reason); `None: x` (read as a missing file); `none: x` as a parity row's book.
- Red control proof: replacing the one-side `cond` clause (`editor_gate.exs:167`) with `false` makes `none-one-side` FAIL (exit 0).
- (a) Excluding `policy` from Add mechanic… (`mobile/app/author/build/form.tsx:144`) turns `dialogues.policy.book.create` red. Edit and delete are covered by the same generated rows (`generic.test.ts:203-226`, regex matches `rules.tsx` and `generic.tsx`).
- `bin/mutate_diff.sh origin/main`: 10 mutants, red-narrow 10, the same as the handback.

## Findings

1. Note (for loka-hcnlh.45): `bin/editor_red_controls.exs:16-21, 77, 97-108` plant on `outline.parts.book.*`. Once .45 flips those rows, no schema-path todo is left (the baseline holds only `outline.parts` and `parity:*`). Then `book-accepted`, `todo-unlisted`, `todo-grown` and the `notyet-*` controls must plant on a `parity:` row, or build their own todo. The failure will be loud: red_controls exits 1.
2. Nit (author-side): the panel offers no delete *control*. `templates.tsx:163` is rjsf's array-item Remove, and `Folded` (`templates.tsx:130-137`) folds only optional fields. But clearing the `title` text box drops the key, and `card.ts:34` then sends `{path:['title'], delete:true}`, which the compile refuses. So the claim holds for gestures, not for ops.
3. Note: the panel still shows `api_version` as a text box (PM ruling: keep `none`; this goes away at 6.8). `World.tsx:110` passes `{}` to `uiSchema`, so the `ui_schema.ts:92` guard only affects `Generic.tsx:247`.
4. Nit: `bin/toolbox_page.exs:224` labels a `none` surface `bespoke`. This is latent: no `docs/features.json` declaration maps to the seven `none` rows.
5. Nit: the two sides' reasons do not have to match (`editor_gate.exs:167`). Accepted per the brief.

Open before merge: merge `origin/main` (finding above under Checks; clean).
