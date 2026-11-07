# Owner decision: scene structure is edited in the GUI — 2026-11-06

Recorded 2026-11-07 by the Book UI designer (Claude Code, Opus 5.5) for loka-wfrgk.100.5, from the PM's brief. The owner's words are paraphrased.

Owner, 2026-11-06 (paraphrased): yes, the scene structure should be editable in the GUI: adding, removing and reordering lines and pages, speaker lines and choice labels, in `.scene` dialogues and `.cut` cutscenes.

- This reverses ruling 11 of the [GUI editor design](../rnd/gui-editor-design-2026-11-04.md#8-owner-rulings-needed), which said choice labels are not edited because the slug is the key.
- Owner, 2026-11-07 (paraphrased): separate a choice's key from its words instead of building rename. Ruling 9 ("rename a key is out of v1") stands unchanged; a choice keeps its key when its words change.
- Owner, 2026-11-07: old dev saves may stop replaying past a choice changed outside the card; accepted for now.
- Ruling 12 still holds: the scene stays text, and no edit reflows the owner's lines.
- The design is in the [scene structure rulings](../design/scene-structure-rulings.md).
