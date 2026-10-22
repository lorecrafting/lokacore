# Archive

What remains after the [move-forward trim](../decisions/owner-decision-move-forward-2026-10-07.md);
each file stays because something current still cites it. The current system is [docs/system/](../system/README.md).

- [spec/](spec/README.md): the R0 specification packet as amended until 2026-10-02. Protocol schemas
  cite its sections, and `test/loka/core/registries_test.exs` reads the invariant citations from it.
- [decisions/](../decisions/README.md): older ADR texts and owner decision records still in force or
  named by `protocol/`, code, lint or tests, indexed by the live decisions index.
- [ROADMAP.md](ROADMAP.md): the R0–R6 stage rows; a protocol schema names it.
- [design/](design/room-view/README.md): the 2026-09 UI explorations, the room-view direction and the
  2026-10-07 foundation audit ([foundation](design/foundation/README.md), [UI exploration](design/ui-exploration/README.md)); the live references are in [docs/design](../design/README.md).
- [LATER-MECHANICS.md](LATER-MECHANICS.md): the story-bound C2/C3/CC mechanic queues, superseded by the
  [mechanics toolbox](../MECHANICS-TOOLBOX.md); its acceptance seams are still cited.
- [LATER-ENDINGS.md](LATER-ENDINGS.md) and the [later story reconciliation](pm-decision-later-story-reconciliation-2026-10-04.md):
  Chapter 2 and 3 planning, archived 2026-10-10 when those chapters left release scope; LATER-MECHANICS cites them.
- [MISSING-CHILD-PLAN.md](MISSING-CHILD-PLAN.md): the deleted Ashmere chapter's 33-slice completion plan,
  archived 2026-10-21; the Beads export check and the chapter-one briefs read it.

Everything else archived on 2026-10-07 is at [the last commit that held it](https://github.com/lorecrafting/lokacore/tree/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive).

The per-chapter detail sections of `docs/system/book-ui.md`, removed on 2026-10-22, are at [the last commit that held them](https://github.com/lorecrafting/lokacore/blob/c88762e38eb9c3747f1de0b87e6536d58424c24e/docs/system/book-ui.md).
