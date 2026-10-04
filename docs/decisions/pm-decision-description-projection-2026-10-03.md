# PM adoption: explicit entity descriptions in GameView — 2026-10-03

Owner direction, verbatim excerpt from the next C1 playtest polish instruction:

> Also when we go into Brams detail page, he should also have a description.  All items npcs and players should have a description.

## Inspected gap and bounded adoption

ItemDefinition and NpcDefinition already require an explicit description TextKey;
content validation resolves it. The approved sampler has all seven NPC/item description
bindings and catalog values. The existing view omits that field. There is no prose gap.

PM adopts optional `description: TextKey` on EntityView and ContentView, populated
exactly from `e.description` for current NPC/item room, held, worn and reachable-content
projections. Optionality preserves `loka-gameview-v1` and accepts older snapshots; it is
not a fallback or permission for the current projection to omit authored descriptions.
Do not infer a suffix from the short name, substitute room-line variants or add a loader,
capability, state change, narration or persistence field. Adjacent sight is unchanged.

The UI consumes the projected key. An old snapshot without it gets no invented body.
Future actual player projections must supply real descriptions; this slice implements
no player presence or placeholder biography. The UI slice owns rendering and book UI
semantics; this slice owns the [canonical projection contract](../system/protocol.md#gameview),
shared schema/generated outputs, one existing TypeScript projection site and checks.
There is no Elixir GameView runtime consumer to add under ADR-074.

The semantic edit stacks on mechanical kernel reorganization `630a08e`, at
`kernel/ts/src/view/view.ts`. All cartridge/entity source schemas, story/catalog values,
cartridge artifacts (including the sampler hash), nineteen older fixture sets, state/save
formats, simulation pool/generator/seeds and mechanics remain unchanged. Protocol view
examples, malformed provided-field cases and generated shared contracts are the bounded
contract corpus amendment. Existing valid examples without the field remain valid.

Independent source review and combined native proof are still required; this record is
PM adoption, not a review verdict or device evidence.

[Headless evidence](../evidence/c1-description-projection/README.md) distinguishes actual focused controls from pending source/native review.
