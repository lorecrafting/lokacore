# Owner decision: Fable's depth and UX audit adopted — 2026-10-13

Written 2026-10-13 in Claude Code by anthropic/claude-opus-5-5 (PM).

After reading Fable's [R&D audit of depth, immersion and touch UX](../rnd/depth-and-ux-2026-10-13.md),
the owner said, 2026-10-13:

> Okay i like everything in fables audit. especially the M12-m15 rows stop adding single-player assumptions because we area already there and if we dont need to do doubl ework we dont need to. PLease go with all of fables suggestions

## Effect

- Every suggestion of the audit is adopted and filed in Beads: toolbox rows FD1-FD10 (`loka-kgd.138`-`.147`,
  [toolbox](../MECHANICS-TOOLBOX.md)); Realm instancing `loka-kgd.148`, decision record first; tooling
  `loka-kgd.107.20`-`.25`; Book UX `loka-x6t.39`-`.52` in the parked polish lane.
- The reading-size setting and the high-contrast ink toggle are approved. They supersede, for those two
  settings only, the "no Settings override" ruling of the
  [design foundation](owner-decision-design-foundation-2026-10-07.md); day and night still follow in-game time.
- Native UX items (haptics, background notices, dictation) ship web fallbacks first and native after the mobile pause.
- LLM uses stay presentation-only (trap 4). Player input in single player stays one word (trap 9).
- Realm seams: see the [seams record](owner-decision-realm-seams-2026-10-13.md). A Realm seams batch runs
  after M12 and before M13 (owner, 2026-10-13; Beads `loka-kgd.150`).
