# Book design references

Two owner-approved HTML mocks. Open them in a browser; they load Google Fonts and html2canvas
from a CDN, their prose is placeholder and their rules are not the engine's.

- [chapter-one-playable.html](ui-exploration/chapter-one-playable.html): the base. The live Book's values are its `.ph` page with every effect off ([design foundation decision](../decisions/owner-decision-design-foundation-2026-10-07.md)); restored 2026-10-07 from its [published artifact](https://claude.ai/artifact/7jbp2SbLek8SNimVYzQcVk).
- [room-view.html](room-view/room-view.html): the style reference (the 2026-09-24 direction; same palette and type, it differs only in effects).

Effects and audio, planned 2026-10-31 and layered onto the base in batches:
[effects and sound plan](effects-and-sound-plan.md), its [playable samples](ui-exploration/effects-samples.html),
the [audio listening list](audio-listening-list.md) and [other placeholder candidates](placeholder-audio-candidates.md).

"Effects off": the mock's Effects panel and its "Archive, not in v1" group (paper grain and edges,
ink shadows, lamp glow, moon palette, drop capitals) are not adopted; the page curl and paper
sound are. Each effect waits for its own owner decision.

Round ink action buttons for the combat hotbar (loka-x6t.131): the [Inked icon style guide](icon-style-guide.md) (the owner's pick, 2026-11-05; grid, tokens, states, recipe for every future icon) from the [exploration](ink-buttons-exploration.md), drawn in Storybook `Docs/Ink buttons`.

The editor's chrome (dev only, never the Book): [editor chrome rulings](editor-chrome-rulings.md); its left-column map and Story list: [map and story rulings](editor-map-and-story-rulings.md).

Rules: [component catalogue](../BOOK-UI-COMPONENTS.md). Values: [tokens](../../mobile/app/book/tokens.ts).
Behaviour: [Book UI](../system/book-ui.md). Earlier explorations and the foundation audit: [archive](../archive/README.md).
