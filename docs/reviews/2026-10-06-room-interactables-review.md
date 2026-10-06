# Room interactibles — independent review

Reviewed local branch `docs/room-interactables`, exact source commit
`0cc7b7cd0c7e41060bf77be527a2f25d5933223f` against `3ff6cdd4`.

Requirements derived from the owner's [room decision](../decisions/owner-decision-room-interactables-2026-10-06.md), the existing [Book UI](../system/book-ui.md#world-and-status-entry), [GameView](../system/protocol.md#gameview), and [dark detail rule](../system/book-ui.md#b4-light-details) before assessing the diff: a room has title and prose; fixed fixture links stay inline and cannot be taken or removed; present actors and loose items occupy separate paragraphs and open details; concealed subjects stay concealed; every action uses an actual current offer and freshness context.

**CHANGES REQUIRED** — two should-fix findings.

- **RI-1, should-fix**, `docs/system/book-ui.md:32`: “current projection actually reveals it” has no defined fixture visibility or detail source. Current `GameView.place` provides only room id, title and description; its `entities` are NPCs/items, and the Book strips catalog links to plain text. For a dark room whose authored description links the masonry detail, rendering the link directly reveals a concealed detail, while stripping all links makes the required revealed fixture untappable. State which authoritative projection exposes a room fixture and its detail route, and mark this as a future contract/consumer until it exists. An offered action alone cannot represent a descriptive fixture with no action.
- **RI-2, should-fix**, `docs/system/book-ui.md:31`: “never offers Take or Drop merely because it is linked” permits an offered Take for the linked fixture for another reason. The owner decision says fixtures cannot be taken or removed. A developer could model a door or scenery as a room item with a Take offer and leave it inline as a fixture. Make the canonical custody rule unconditional and say that any movable object belongs in the loose-item group instead.

The actor and loose-item grouping, detail intent, empty-group omission and future player projection match the owner rule. No implementation or tests changed. Ponytail Review: no excess machinery introduced.
