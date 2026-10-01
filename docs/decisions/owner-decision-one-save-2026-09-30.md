# Owner decision: one save per story, new game with confirmation — 2026-09-30

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the wording is
smoothed, not quoted. No checker can verify it against the chat.

Owner (paraphrased): one save per story, with no manual bookmarks. Starting a new game
replaces that save, after the player confirms.

Effect ([spec amendment](../spec/IMPORT.md#amendments-since-import), home of the rule:
[10 §31](../spec/10-mobile-commerce-release.md#31-initial-player-run-lifetime-defaults)):

- A story keeps one autosaved current position. The three named manual bookmarks of
  10 §31 (ADR-066) are dropped, and with them restoring a bookmark as a fork.
- New game with confirmation: an explicit player action, confirmed in the UI, replaces the
  save whole with the fresh world under a new lineage and run. It is a new run, not a fork:
  it has no causal parent.
- Unchanged: bounded internal recovery checkpoints and the pre-migration recovery copy
  (both arrive with migration staging, R6 S3b); exact release and capability pins; manual
  export/import (10 §33). An older branch restored from an import or a backup still forks
  a new lineage with a causal parent; crash recovery and receipt replay never do.
- R6 S3a builds the save identity, the pin and `newGame`; it builds no bookmarks or
  restore.
