# Owner decision: fast cold open; no receipt replay at open — 2026-11-01

Written 2026-11-01 in Claude Code (developer), from the PM's brief for Beads `loka-vduxr.34`. The
owner's words are paraphrased.

Owner, 2026-11-01 (paraphrased): opening a save must be fast; weaker detection of hand-tampered saves
is an accepted price.

## Effect

1. Opening a save does not replay receipts. `receiptHistory` stays, called only by tests.
   Receipts stay written; the save format and `kernel_api` are unchanged.
2. No stored state hash replaces it.
3. Kept at open: row parse and validation, a head clock not behind the newest receipt, the revision
   matching the newest receipt, and that row's id and actor binding.
4. A state row or older receipt that still parses now opens, whoever wrote it. The owner's words named
   hand edits; the price is wider: wrong rows from a kernel or writer bug persist instead of refusing
   (tests' `coldReopen` is the only catch, before ship), and a stale page from a bad restore can open
   and save the next action on the wrong state. The PM told the owner, recommending acceptance; the
   owner has not objected and has not explicitly confirmed (2026-11-01). A row that ordinary play or a crash could produce is still
   handled by the [reopen principle](../lessons/storage.md).
5. Commerce recovery no longer validates every receipt; it reads only the rows it needs.

Contract: [save.md](../system/save.md#what-reopen-proves).
