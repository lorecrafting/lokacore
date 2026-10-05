# PM adoption: Q3 fox through a silent bell

2026-10-05. Under the owner's Chapter 1 mechanics and in-game copy delegation,
adopt the terminal-only fox choice in the [Q3-F active contract](../system/cartridge.md#q3-f-fox-and-silent-bell).
After either completed Q2 return, an actor with active Q3 may leave the Belfry
bell silent. The exact-detail recipe assigns fox allegiance without ringing.
One fact-change reaction resolves Q3/fox, and the evidenced quest resolution
starts a two-line modal `bell_silenced` scene. Aldric's cold response is scene
narration, not a disappearing NPC or a new global relationship behavior.

Q2 active, failed/lost or absent cannot select fox. Ring and Silence share the
first terminal winner: neither may change the accepted allegiance later.
The existing typed reaction, quest-resolution scene hook and API1.12 express
this consumer; no generic effect interpreter, new event shape, scene control,
room, story point, dawn scene or export is adopted. Current-release saves must
validate the fox terminal against its own committed Silence receipt and the
retained lawful Q2 return, as [specified for recovery](../system/save.md#bell-choice-return-recovery).
Advance the bundled chapter release and independently pin its new hash and IDs
in the implementation slice. Historical frozen fixtures remain unchanged.
