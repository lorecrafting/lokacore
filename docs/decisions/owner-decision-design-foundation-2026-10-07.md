# Owner decision: Book design foundation — 2026-10-07

(paraphrased) The owner reviewed the foundation specimen (PR #304) and approved it as the base to build and refactor on; the design system can be tweaked later.

- **Base look:** the Chapter 1 mock playable (`docs/design/ui-exploration/chapter-one-playable.html`) with every effect off, except the page curl and the paper page-turn sound, which are part of the base. Other effects are layered on slowly later.
- **Page curl:** one Skia shader (SkSL) shared by the web view (CanvasKit) and the phone (react-native-skia). Skia and any library it needs (for example Reanimated) are approved; every library must stay compatible with the mobile build, not only the web.
- **Day and night follow in-game time**, not the phone's system setting. The dawn and dusk hours are world values owned by the cartridge ([world parameters](owner-decision-world-parameters-2026-10-02.md)). No Settings override for now (owner, 2026-10-07). A Sound on/off control in Settings (PM addition for accessibility; spec only until the polish phase).
- **Accepted PM recommendations:** dark `warning` separated from dark `action` (a rust hue, at least 4.5:1); the running head shows the current quest objective (no new copy); IM Fell English SC bundled for small caps; action cards replace accent text links; minimap 56 px; page curl about 500 ms, tuned on a device; a short recorded CC0 page-turn sample replaces the synthesised sound when found.
