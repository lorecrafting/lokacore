# Owner decision: component specs live with the components — 2026-10-22

Written 2026-10-22 in Claude Code (designer), from the PM brief for Beads `loka-x6t.83`. The owner's
words are paraphrased.

Owner, 2026-10-22 (paraphrased): consolidate the design files; component specs live with the
components; make it enforceable. The owner chose a Fable designer for this slice.

## Effect

1. Each exported Book component's spec is a doc comment on its export: a one-line form, then `Use:`,
   `Rules:`, `States:` and `Story:` ([format](../BOOK-UI-COMPONENTS.md#component-catalogue)).
   Storybook shows it on the Docs page of the story whose meta names the component.
2. [BOOK-UI-COMPONENTS.md](../BOOK-UI-COMPONENTS.md) keeps cross-component guidance, the token roles and
   the page turn; its catalogue is a one-line index (component, file, story).
3. Behaviour rules stay in [Book UI](../system/book-ui.md); a comment links them and never copies them.
4. [`catalogue.test.ts`](../../mobile/app/catalogue.test.ts) fails when a comment, its `Use:` or its
   story is missing, or the index and the code disagree.
5. The designer still writes or approves the comment text.
