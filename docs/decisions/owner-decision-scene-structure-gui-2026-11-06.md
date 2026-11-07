# Owner decision: scene structure is edited in the GUI — 2026-11-06

Recorded 2026-11-07 by the Book UI designer (Claude Code, Opus 5.5) for loka-wfrgk.100.5, from the PM's brief. The owner's words are paraphrased.

Owner, 2026-11-06 (paraphrased): yes, the scene structure should be editable in the GUI: adding, removing and reordering lines and pages, speaker lines and choice labels, in `.scene` dialogues and `.cut` cutscenes.

- This reverses ruling 11 of the [GUI editor design](../rnd/gui-editor-design-2026-11-04.md#8-owner-rulings-needed), which said choice labels are not edited because the slug is the key.
- It narrows ruling 9 ("rename a key is out of v1") for choice keys only. A label rename carries its key's referrers, and refuses the referrers it cannot carry safely.
- Ruling 12 still holds: the scene stays text, and no edit reflows the owner's lines.
- The design is in the [scene structure rulings](../design/scene-structure-rulings.md).
