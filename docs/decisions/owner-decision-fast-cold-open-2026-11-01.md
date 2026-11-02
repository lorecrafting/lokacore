# Owner decision: fast cold open; no receipt replay at open — 2026-11-01

Written 2026-11-01 in Claude Code (developer), from the PM's brief for Beads `loka-vduxr.34`. The
owner's words are paraphrased.

Owner, 2026-11-01 (paraphrased): opening a save must be fast; weaker detection of hand-tampered saves
is an accepted price.

## Effect

1. Opening a save does not replay receipts. `receiptHistory` stays for tests and dev tooling.
   Receipts stay written; the save format and `kernel_api` are unchanged.
2. No stored state hash replaces it.
3. Kept at open: row parse and validation, a head clock not behind the newest receipt, the revision
   matching the newest receipt, and that row's id and actor binding.
4. A state row or older receipt edited by hand so that it still parses now opens. A row that ordinary
   play or a crash could produce is still handled by the
   [reopen principle](../lessons/storage.md).
5. Commerce recovery no longer validates every receipt; it reads only the rows it needs.

Contract: [save.md](../system/save.md#what-reopen-proves).
