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

Everything else archived on 2026-10-07 is at [the last commit that held it](https://github.com/lorecrafting/lokacore/tree/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive).
