# Book design references

Two owner-approved HTML mocks. Open them in a browser; they load Google Fonts and html2canvas
from a CDN, their prose is placeholder and their rules are not the engine's.

- [chapter-one-playable.html](ui-exploration/chapter-one-playable.html): the base. The live Book's values are its `.ph` page with every effect off ([design foundation decision](../decisions/owner-decision-design-foundation-2026-10-07.md)); restored 2026-10-07 from its [published artifact](https://claude.ai/artifact/7jbp2SbLek8SNimVYzQcVk).
- [room-view.html](room-view/room-view.html): the style reference (the 2026-09-24 direction; same palette and type, it differs only in effects).

"Effects off": the mock's Effects panel and its "Archive, not in v1" group (paper grain and edges,
ink shadows, lamp glow, moon palette, drop capitals) are not adopted; the page curl and paper
sound are. Each effect waits for its own owner decision.

Rules: [component catalogue](../BOOK-UI-COMPONENTS.md). Values: [tokens](../../mobile/app/book/tokens.ts).
Behaviour: [Book UI](../system/book-ui.md). Earlier explorations and the foundation audit: [archive](../archive/README.md).
