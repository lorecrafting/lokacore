# D8 real-coin dependency review — APPROVE

Independent planning review of `4ab053d3feed65ee8a437bf624a30027b4a88849` against base `e082768acbc1b322907e736ef8ef4667bc331bbd`. The reviewer authored none of the change and repeated the review in a clean separate detached worktree at that exact head.

D8's provisional crow transport allowlist names only `old_coin`. D6 owns the real coin and bottom-room source; the installed cartridge has neither, while D5 owns the reachable canopy and expressly excludes the coin. The added D8→D6 edge is the smallest accurate dependency. The completion plan, D8 brief and Beads graph agree, and `br blocked` reports D8 blocked by D6. No findings or actionable complexity concern.

The reviewer verified `br show` and `br blocked`, `python3 bin/check_beads_export.py` and `git diff HEAD^ HEAD --check`. This is a planning-only review; it claims no source, mutation or browser proof.
