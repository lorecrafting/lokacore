# D10 Finding the Way planning review — 2026-10-06

Reviewed planning head `aa1f29af5dde5b480d9a51e0499677f1fa6c49f9` as a fresh reviewer; no source was authored or changed. Governing clauses: [D10 mechanics](../system/mechanics.md#d10-discovered-places-observations-and-knock-selected-pending-implementation), [Book Map](../system/book-ui.md#minimap-map-and-presentation-controls), [protocol](../system/protocol.md#d10-knowledge-and-knock-composition), [save](../system/save.md#d10-discovered-place-and-observation-recovery), and [brief](../briefs/chapter-one/d10-map-where-knock-brief-2026-10-05.md).

## Independent requirements before diff

- A visit belongs to the actor, is written only with accepted body entry, and survives receipt-bound recovery; Map cannot reveal unvisited rooms.
- Where reports visible present NPCs or actor-owned last observation, never a guessed hidden or remote live location.
- Knock acts only on an actual local door and cannot change barrier state or bypass D9's Study ingress.
- The open Chapel route, 57-room graph, Wren boot and separate ordinary boot remain usable without invented story gates.

## Verdict: CHANGES REQUIRED

1. **D10-P1, should-fix — `docs/system/mechanics.md:1504` and `docs/system/protocol.md:1154`.** `where` reports an exact "currently present" NPC as `here` before requiring that NPC to be currently visible. In a dark room, a remembered or guessed exact ID can expose a co-located NPC that B4 hides from Look, GameView and direct targeting; a player could also learn that a previously observed NPC has returned without seeing them. Require the same current visibility gate for `here`; otherwise use the actor's saved last observation or `unknown`. Apply it to raw ID and alias resolution and touch.
2. **D10-P2, should-fix — `docs/system/mechanics.md:1501` and `docs/system/book-ui.md:133`.** The plan says a *visited* connection's displayed current availability comes from ordinary Move admission. Move admission is scoped to the actor's current room/body and may depend on position, resources, encounter and D9's Study edge predicate. When the actor is at Landing, evaluating a visited Study or Chapel link as though the actor were there can promise a route that would refuse on arrival, or requires a second remote admission model. Limit live availability to the actor's current-room exits; other visited links can be shown as known connections without a traversal promise. Keep the real current-room door controls and D9 refusal.

The other selected boundaries are coherent at this head: static coordinates do not grant exits, the Chapel door starts open and shares reciprocal faces, Knock is a receipt-bound local response, and the Watch Cell remains public. D8/D9 source and D10 implementation are still pending. This docs-only review ran no implementation tests or browser check.
