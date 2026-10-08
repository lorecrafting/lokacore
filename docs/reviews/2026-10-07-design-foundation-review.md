# Review: Book design foundation (PR #304)

- PR #304, branch `design/book-foundation`, head `9ed5fe0b`, base main `294062aa`.
- Stance: quick correctness pass for Book UI spec and token text ([routing](../WORKFLOW.md), "Review stance"); no app code, no mutation testing.
- Verdict: **CHANGES REQUIRED** (two should-fix items touch interaction rules E2 is proving).

## Must be true (written before the diff)

1. No change to what a tap does, navigation, returns, action admission or accessible roles ([book-ui](../system/book-ui.md)).
2. Token values identical in `tokens.ts`, specimen and catalogue; each text role >= 4.5:1 on `bg` and `card`, both themes.
3. Day/night follows in-game time, no override, no engine/presenter dawn or dusk literal ([owner decision](../decisions/owner-decision-design-foundation-2026-10-07.md); AGENTS.md mechanics-vs-numbers).
4. `page-curl.sksl` compiles in CanvasKit with only Skia SkSL features; reduced motion has no curl.
5. Owner-rules line, decisions index and record agree.

## Proof

- Contrast recomputed (WCAG relative luminance): all ten pairs per theme match the README table; minimum light `warning` on `card` 4.75, light `dim` on `card` 4.91.
- `PALETTES` and CSS vars in `specimen.html` equal `tokens.ts`; specimen `SKSL` equals `page-curl.sksl` byte for byte.
- `canvaskit-wasm@0.42.0` `RuntimeEffect.Make` compiles the file: uniforms `size, progress, direction, paper` (7 floats), two shader children; rendered with `makeShaderWithChildren`: progress 0 shows `leaving`, 1 shows `arriving`, direction -1 mirrors. Only `uniform shader`, `.eval`, `half3`, globals `const` used; nothing web-only, so react-native-skia `Skia.RuntimeEffect.Make` should accept it.
- No hour literal in spec text; specimen `DAWN=5, DUSK=18` labelled samples. No override text left in record, index or owner-rules.

## Findings

1. **should-fix** `docs/BOOK-UI-COMPONENTS.md:107`: unavailable action card is "not pressable, `disabled` to assistive tech", and "Polish: unavailable choices are plain notes" asks to change them. [book-ui.md:270](../system/book-ui.md) says an unavailable item action "appears as a non-action note"; :205-206 "unavailable notes". A polish implementer following the catalogue turns a text note into a disabled button, which screen readers announce as a control; E2 role assertions on that note would break. Fix: unavailable row keeps the note semantics (style only), or amend book-ui with owner/E2 sign-off.
2. **should-fix** `docs/system/book-ui.md:73-74`, `docs/BOOK-UI-COMPONENTS.md:136`, `docs/design/foundation/README.md:128`: adds a Settings Sound on/off control, a new Settings interaction, and the README calls it "owner-required", but the owner record does not mention it. Fix: record the owner's ruling in the decision, or drop the control from the spec until decided.
3. **nit** `docs/system/book-ui.md:161`: "44px touch target in both axes" tightens a rule live riddle tiles fail (disclosed at README:127); fine if the PM accepts a known red against the spec until polish.
4. **nit** `docs/design/foundation/specimen.html:342`: sound plays before the reduced-motion branch, while the catalogue (:135) ties it to "each curl"; state whether the fade plays the sound.
5. **nit** `mobile/app/book/page-curl.sksl:49,58`: at progress 0 the flat leaf is shaded up to 22% near the fold, and at progress 1 the arriving page still carries the roll shadow near the edge, so the first and last frames pop against the plain page. Tune on device.

Over-engineering: none; `tokens.ts` unused by design (ponytail note present).

CI at review: `changes`, `lint` pass; `browser`, `elixir`, `sim`, `typescript` pending.
