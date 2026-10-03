# Owner decision: one game difficulty — 2026-10-03

Recorded by Codex from this session, verbatim:

> Lets not have multiple difficulties, only one difficulty

## Rule

Loka has one shared gameplay difficulty. Character creation and settings offer no normal/hard/
ironman choice. Combat, recovery and death use the same rule set for all players of the release;
cartridges still own their world numbers under the
[world-parameter rule](owner-decision-world-parameters-2026-10-02.md).

This supersedes the difficulty selection, hard-mode XP loss and ironman permadeath planning in
[00 §§4.3 and4.5](../archive/spec/00-first-cartridge-design.md#43-character-and-progression).
The archived record stays history. Encounter strength, equipment, skill choices and progression
can vary within the shared rules; they do not introduce selectable difficulty modes.

The [provisional mechanics proposal](../design/provisional-story-mechanics.md#6-death-and-return)
now describes one candidate death policy. Its individual odds, costs and penalties remain
proposals; this decision approves the single-difficulty direction, not all of those values.
Installed capabilities and the approved Gate C1 scope are unchanged. A future implementation
slice must amend its governing `docs/system` and contracts before adding combat/death behavior.
