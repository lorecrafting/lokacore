# PM decision: D10 Finding the Way — 2026-10-06

**Selected planning draft; independent review and source remain pending.** The
planning base is main `a5678743`, Chapter v035/API1.30, with 57 actual room
definitions. D8 crows and D9 village reactions have planning drafts but no
published source. D10 source must re-pin their actual merged heads and any
changed map graph, Aldric location or door policy before implementation.

The [active mechanics](../system/mechanics.md#d10-discovered-places-observations-and-knock-selected-pending-implementation),
[Book](../system/book-ui.md#minimap-map-and-presentation-controls),
[cartridge](../system/cartridge.md#d10-map-positions-and-chapel-door-selected-pending-implementation),
[protocol](../system/protocol.md#d10-knowledge-and-knock-composition) and
[save](../system/save.md#d10-discovered-place-and-observation-recovery) sections
select the minimal Chapter 1 result. The [brief](../briefs/chapter-one/d10-map-where-knock-brief-2026-10-05.md)
owns the source assignment and proof. The archive's [chapter map](../archive/spec/00a-chapter-one-content.md#2-rooms)
and [R5 deferral](../archive/decisions/owner-decision-r5-deferred-mechanics-2026-09-28.md)
motivate this slice; current source and active system contracts govern exact behavior.

Visits are character-owned accepted entries. Static drawing coordinates have no
authority over exits. Where reports current presence or saved last observation,
and never a remote live NPC location. Accepted entry/Look owns visible NPC
observations; Map and Where only read them. One initially open physical Chapel
door makes Knock a real local action and preserves the public route. The
current chapter's Watch Cell is expressly open and has no physical exit
barrier, so the archived keyed-cell candidate is deferred rather than faked.
D9's planned Study ingress restriction is not a door and Knock cannot bypass it.

The original brief's suggestion that public fixed-service directions can mark
an unvisited destination known is deferred: no chapter consumer requires that
second knowledge type. Route hints, pathfinding, remote Scan and a generic
tracking subsystem are also deferred. Wren's exact boot remains real content;
the source adds ordinary leather boots in Chandler for the ambiguous word
`boot` through ordinary resolver behavior; no shop price is selected.

Source, successor API/release/hash/IDs, PR and verification are **null**.
Ponytail self-review: one saved visited relation and one observed-NPC relation
serve Map/Where; existing room graph and door admission serve layout and Knock.
Correctness self-review: no render-time knowledge writes, hidden-location leak,
door bypass, route lock or invented custody. This is design, not source proof.
