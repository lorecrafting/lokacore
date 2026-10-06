# Owner decision: three kinds of room interactibles — 2026-10-06

The owner selected a room page with a title and description, plus three kinds of
interactible subjects:

- Room fixtures, including scenery and room-bound exit/trigger subjects, link
  from within the description. A link may be in the middle of prose or appended
  to its end without an extra paragraph. It is underlined and opens a detail.
  The fixture stays in the room and cannot be taken or removed. A removable
  subject belongs to the loose-item group.
- Present players and NPCs appear in their own paragraph/list and open their
  own details.
- Loose items appear in their own paragraph/list and open item details; Take
  may be offered when legal.

The [Book UI specification](../system/book-ui.md#world-and-status-entry) owns
the presentation rule. A current-room projected identity/detail route and
action admission determine a fixture link; authored markup alone never does.
Room-description variants omit unrevealed subjects. The current GameView does
not project general scenery detail routes, so those links wait for a real
consumer and a matching projection/admission amendment.
The current Book has no player-presence projection, so that group remains
future-facing until a real multiplayer consumer provides it.
