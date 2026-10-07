# Archive

What remains after the [move-forward trim](../decisions/owner-decision-move-forward-2026-10-07.md);
each file stays because something current still cites it. The current system is [docs/system/](../system/README.md).

- [spec/](spec/README.md): the R0 specification packet as amended until 2026-10-02. Protocol schemas
  cite its sections, and `test/loka/core/registries_test.exs` reads the invariant citations from it.
- [decisions/](../decisions/README.md): older ADR texts and owner decision records still in force or
  named by `protocol/`, code, lint or tests, indexed by the live decisions index.
- [ROADMAP.md](ROADMAP.md): the R0–R6 stage rows; a protocol schema names it.

Everything else archived on 2026-10-07 is at [the last commit that held it](https://github.com/lorecrafting/lokacore/tree/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive).
