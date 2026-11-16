# Review: Editor E4b, generic inspector card on rjsf 6 (PR #645, loka-wfrgk.12)

- PR: [#645](https://github.com/lorecrafting/lokacore/pull/645), branch `editor/e4b-generic-card`
- Reviewed commit: `4c1a72cfe3080e1c9405d538a481ef79243ecf73`
- Governing: [gui-editor design §11 and the E4b row](../rnd/gui-editor-design-2026-11-04.md), [editor chrome rulings](../design/editor-chrome-rulings.md), [E4a review, carried items 1-5 and 7](2026-11-05-e4a-edit-model-review.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 4c1a72cf...`): ci success, book-e2e success.
- `/code-review medium`: reported in the PR body, with eight open items ruled below.

## Verdict: CHANGES REQUIRED (one small fix; the rest carried to E6)

## Must be true (written before the diff)

1. Every write goes through E4a `change` and E1 `POST /change` (`{file, was, ops}`), Undo through `POST /undo`; no new route, no new write path.
2. rjsf invents nothing: no schema default, no `const`, no `{}` fill reaches the file.
3. A refusal shows at the field, the draft stays, nothing is written; Hold shows on the card.
4. A prose field opens the Book's edit; the panel writes no player-facing word.
5. The add menu lists exactly the registry's rows of the kind the file lacks; choosing one writes nothing.
6. Author-only: nothing under `mobile/app` imports the card, rjsf or the registry.
7. E4a's carried items landed: shrink-only raise, root-level kinds drawn, recursive `$ref` depth, §6 amendment and Editor column, treatment rows, `ui:field` resolution, `defs` refused.

## Checks that held

- Writes: the walk posted only `/change` with narrow ops (`[{"path":["attributes",0,"value"],"value":7}]`, `[{"path":["policy","fact"],"value":"south_open"}]`) and `/undo {id}`; `kernel/ts/play/write.ts` is unchanged beyond E4a. `FORM_DEFAULTS` is `skipDefaults` and `constAsDefaults: never` (`card.ts:14-17`); `diff` drops empty fills (`card.ts:34-36`).
- Add menu on `weak_guard`: exactly the 24 registry `npcs.*` rows the file lacks; choosing one revealed its field and wrote nothing (file keys unchanged).
- Prose: `TextKey` only shows the key and calls `edit(k)`; `mobile/app/author/inbook.ts:252` handles the `edit` op. No word is written by the panel.
- Author-only: no `mobile/app` file imports `author-panel`, `play/card` or `@rjsf` (three files match the PR's grep in comments and a regex only; the PR's "0 files" is imprecise, nit 10).
- Carried E4a items: all seven present (gate raise, root kinds under `items`, treatment rows, `defs` refusal, §6 note).
- Focused tests 29 pass, panel `tsc` clean, `elixir bin/red_controls.exs` all ok.
- Owner walk, real Chrome, light and dark, copy world `e4b_rev` of `npc_attr_sampler`: select NPC, edit number, add field, Undo, unknown-room refusal, Policy field edit and Undo, Steps field shown; screenshots `e4b-fable-{1..6}-{light,dark}.png` in the session scratchpad.

## Mutants

`bin/mutate_diff.sh origin/main`: 100 rows, 67 red-narrow, 0 SURVIVED, 4 NOT-UNIQUE (`drop return out;`), 29 NO-TESTS (panel `.tsx`, no runner), no TIMEBOX. Better than the handback's table (49 / 14 survived) after the author's hand mutants. Hand mutants on `card.ts` (`bin/mutate.sh`, `test/card.test.ts`), all red: drop the delete op in `diff` (`:30`), `hidden` hiding nothing (`:109`), `proseKey` without the `room_line` to `room` mapping (`:150`).

## Findings

1. **Should-fix, fix in this PR**, `tools/author-panel/src/edit/Generic.tsx:43,54`. `post` awaits `load()`, which `setDraft`s the reloaded doc over `latest.current`, so text typed into another field during the ~1 s after a blur is lost. Reproduced in both schemes: set `value` 8, focus `keywords[0]` (the blur commits), type `zz`; the input reverted to `weak`, only `value` was written. The owner types across fields continuously; this drops letters on every second field. Keep the draft when `latest.current` moved since the post began (or reload only `saved`).
2. **Should-fix, carried to E6**, `tools/author-panel/src/edit/fields.tsx:93` with `Generic.tsx:58-60`. Picking a branch that needs fields (`policy` to `any`) leaves the Ajv sentence `.policy.items must have required property 'items'` at the top of the card, and every later blur in the card is held by it: a Steps edit (`steps[0].fact`) was not written until the branch was completed or the node reselected. Refusal at the field, in plain words, per the chrome rulings.
3. **Should-fix, carried to E6**, `kernel/ts/play/card.ts:42`. A root array of a different length diffs to `{ path: [] }`, which `edit_model.ts` refuses (`a path is a non-empty array`): the card of a root-array kind (`layout`, `scenes`, `outline`) cannot add or remove a row.
4. **Should-fix, carried to E6**, chrome rulings: rjsf's core widgets are unstyled. Seen in the walk: the default `Errors` list at the top duplicates the field refusal; the kind's whole schema description is dumped above the fields; `object*`, `op*any`, `string*` labels; native selects reading `choose`, `string`, `boolean`; a `boolean` checkbox; the top refusal is a `text-destructive` paragraph, not the ruled 1px `refusal` border with `circle-alert`.
5. **Should-fix, carried to E6**, `fields.tsx:20-32`. A revealed prose field draws its generated key but has no way to write it: `TextKey` has no `onChange`, so the file never gets the field (item 4).
6. **Carried to E6**, `kernel/ts/play/ui_schema.ts:66`: two `treatment:*` cards share one slot (latent while every row is generic).
7. Nit (Beads), `bin/toolbox_page.exs` `editor_cell`: the comment says kind-wide rows count; the code does not (latent).
8. Nit, `Generic.tsx:38-44`: `load()` has no error UI; a failed fetch leaves `Loading <rel>`.
9. Nit, `Generic.tsx:111-117`: `uiSchema`/`hidden` run each render; no cost seen in the walk.
10. Nit, PR body: "grep of mobile/app returns 0 files" is three files (comments and a regex, no import).

Accepted as is: letters in a number input are refused by the browser itself (`type=number`), so no card refusal exists to show; Undo of a branch refusal is the draft, not a write.
