# Data model dashboard: design spec (loka-j50)

Designer: Fable, 2026-10-09. Read-only survey of the repo; no code changed.

## 0. Facts the design rests on

- `protocol/` holds **32** `*.schema.json` (the brief said 41; 39 files counting registries), **262** named contracts (`$defs`), about **1,400** `$ref` sites. `delta.schema.json` alone has 226 refs, `gameview.schema.json` 209. A single ER diagram of all of it is not legible; the design is *map + focus*, never *everything at once*.
- `bin/contracts.exs` already resolves every schema, flattens `$ref`s and emits `docs/contracts.gen.md`, `docs/residency.gen.json`, `kernel/ts/src/contracts.gen.ts`; `--check` runs in `.github/workflows/ci.yml:47` and `bin/check_all.sh:23`. The dashboard is one more output of that generator.
- Owners are machine-readable: `protocol/capability_registry.json` (45 capabilities; `commands`, `definitions`, `events`, `policies`), `protocol/residency.json` (foundation rows). All 45 are `portable / portable_capability` today, so a Story-vs-Realm residency filter is real but currently one-valued.
- Save tables are prose in `docs/system/save.md:110-120` (one markdown table, 7 rows; code truth `store.ts:50`).
- Runtime State *sections* (`state_row (section, key)`) are not in `protocol/`; they are runtime facts (`kernel/ts/src/runtime/fresh.ts:190`, `invariants_knowledge.ts:12`). The protocol-level view of state is the 38 `DeltaOp` kinds plus `MutationTarget`. See open question 1.
- Storybook 10.6 with `addon-docs`; `stories/Catalogue.mdx` already imports a repo file with `?raw` and renders it under a `Docs/` sidebar group. Manager theme uses `book/tokens.ts`. `react-dom` is a dependency; no diagram library is installed.

## 1. Information architecture (10-minute path)

Sidebar group **System/** (new, top level, above `Docs/`). Pages in reading order:

| Page | Purpose (what a newcomer learns) | Contents | Layout | Legend |
|---|---|---|---|---|
| **System/Overview** | The six layers and how data flows through them in one screen | Layer map: Content (cartridge) → Capabilities (rules) → Change (command/decision/delta/event/receipt) → State → Save → View (GameView) → Book. Each layer box lists its schema files and counts, generated. One click on a box opens Data model filtered to that layer. | Horizontal layered map, left to right, fixed order; Book is a box without schemas (links `book-ui.md`). | Layer colours (see §2); counts are live from the graph. |
| **System/Data model** | Every contract, its fields and relations, by layer and owning capability | The explorer (§2): grid of 262 nodes, search, filters, detail panel, neighbourhood highlight. | Columns = layer (6), rows = capability or file; nodes are compact chips; edges drawn only for the selected node's neighbourhood. | Layer colour, edge kinds (`$ref` solid, *identifies* dashed, *owned by* dotted), node shape by kind (object / enum / id / union). |
| **System/Command lifecycle** | What happens to one Command, end to end | Swimlane: Command → admission → DecisionResult → StateDelta ops → DomainEvent → receipt → state_row/save → GameView. Each lane node is a real contract node (click opens it in Data model). | Vertical swimlane, lanes = Host, Kernel, Save, View. | Lane colour = layer; failure branches (GameError) in the error colour. |
| **System/Capabilities** | Who owns what | 45 rows: capability@N, portability, residency, commands, definitions, events, policies, delta ops, save/state sections (when known), spec link (`mechanics.md#<cap>`), source dir (`kernel/ts/src/mechanics/<cap>/`). | Sortable table with filters; a row expands to the capability's sub-graph. | Residency badge; `*` on hand-kept columns. |
| **System/Save** | What a save file holds | The 7 STRICT tables with rows and the contracts their JSON carries (`state_row` value → State sections; `receipt` → receipt contracts; `pin` → CapabilityLock, manifest ids). | Table-per-card, edges to Data model nodes. | Same as Data model. |

Deferred pages (same group, later phases): **System/Checks**, **System/Beads**, **System/Toolbox**.

## 2. Visual language

- **Diagram types.** Overview: layered map. Data model: grid + focus neighbourhood (not force-directed). Lifecycle: swimlane. Capabilities, Save: tables with expandable sub-graphs. No general-purpose graph layout: the data has a natural grid (layer × capability), so cells are placed deterministically and edges are SVG paths between known cell centres. This is the trade-off against Mermaid/dagre: those cost a 2–3 MB dependency, theme plumbing and still produce hairballs at this size; the grid costs about 150 lines of React and is legible by construction.
- **Grouping.** Row of a node = the capability whose `definitions`/`commands`/`events`/`policies` name it (via `capability_registry.json`), else its file. Unowned foundation nodes (identity, scope, text) sit in a "foundation" row.
- **Colour = layer, never alone.** Layer is also carried by column position and a text label. Six hues, one pair each (light surface / dark surface), chosen for 3:1 against `color.light.bg` and `color.dark.bg` from `book/tokens.ts`, text always `color.*.fg`: Content `#8a5a1e / #e0a35a`, Capabilities `#2e6b4f / #7fc9a4`, Change `#5a4b9c / #b3a4e6`, State `#1f6a8a / #7cc4e0`, Save `#7a2f4a / #e08cb0`, View `#6b6b1f / #d4d47a`. These live in the dashboard component, not `tokens.ts` (they are dev-chrome, not Book UI). Owner may re-pick; the rule that holds is one hue per layer, both surfaces, contrast checked.
- **Relations derived from schemas.** (a) `$ref` → *references* edge (file#def resolved, same as the generator's flattening). (b) a property whose `$ref` is an identity type `XxxId` → *identifies* edge to the definition kind `xxx` in the registry (RoomId → RoomDefinition); unmatched ids stay plain refs. (c) registry `definitions`/`commands` (CommandPayload `type` consts)/`events` (EventPayload)/`policies` → *owned by* edges capability → node. (d) `DeltaOp.op` consts → *mutates* edges to the capability named in the op's description tag `(xxx@1)` when present, else unowned.
- **Legibility at 262 nodes.** Default view shows chips only, no edges. Selecting a node draws its 1-hop edges and dims everything else (focus+context). Detail panel (right, like the Polish panel) shows: title, description (markdown from the schema), fields table (name, type, required, enum values, nested ref links), owning capability, layer, spec section link (parsed from the description's `NN §M` citations → `docs/archive/spec/`), source file (`protocol/<file>#/$defs/<Name>`, line computed by the generator), "used by" list (reverse refs), examples from the schema `examples`.
- **Accessibility.** Follows the existing palette toolbar global (light/dark) like stories. Node chips are real `<button>`s in a list (keyboard reachable, `aria-pressed`), SVG edges are decorative (`aria-hidden`) with the same information in the panel's "references / used by" lists. Focus ring uses `color.*.action`. Axe at error level passes under `storybook:smoke`.

## 3. Use cases and interactions

Phase: **P1** first PR, **P2** second, **P3** later.

| Task | Interaction that serves it | Phase |
|---|---|---|
| What owns `hp`? / who owns X | Search matches field names, enum values, ids, descriptions; result row shows owner badge; Capabilities page row | P1 |
| What can change a character's attributes? | Select AttributeView or `attributes` fact → *used by* + *mutates* edges to DeltaOps and commands | P1 (1-hop), P2 (n-hop) |
| Where is a status saved? | Save page: StatusRow → `state_row` section; Data model node → "Saved in" line | P1 (table), P2 (section names, open question 1) |
| Which commands touch containment? | Capabilities row filter `containment@1`; Lifecycle page lane filter | P1 |
| What does a cartridge author fill in for an NPC? | Filter layer=Content, open NpcDefinition: required fields first, defaults, examples; link to `cartridge.md` | P1 |
| What breaks if I change this schema? | Impact view: transitive reverse closure, grouped by layer, plus fixtures that reference the file (from `protocol/README.md` table) | P2 |
| Trace a command end to end | Lifecycle page with a command picked from CommandPayload; each stage node clickable | P2 |
| Compare Story vs Realm residency | Filter portability / residency on Data model and Capabilities (one value today; the filter exists so it reads honestly) | P1 |
| New-contributor onboarding | Overview → click a layer → Data model prefiltered; breadcrumbs "Overview › Content › RoomDefinition" | P1 |
| Reviewer checking a PR's contract change | CI comment listing added/removed/changed nodes and edges between `main` and head graph JSON | P2 (CI job; not in-browser) |
| Path between two types | "Path from … to …" shortest path over refs, drawn as a chain | P2 |
| Shareable link | Storybook global `node` (`&globals=node:delta.StateDelta`); "Copy link" button | P1 |
| Keyboard navigation | `/` focus search, arrows move between results, Enter opens, Esc clears focus | P1 |
| Breadcrumbs / history | Browser history per selection (pushState on `node` global); breadcrumb from layer › owner › node | P1 breadcrumb, P2 history |
| Example values from real cartridges | Schema `examples` (P1); values from `cartridges/ashmere_*` and `protocol/fixtures` indexed by definition kind (P2) | P1 / P2 |
| Links to spec section and source file:line | Generator emits both per node | P1 |
| Diff vs main inside the page | Cut: needs git in the browser; the CI comment covers it | — |

## 4. Storybook placement

**Recommendation: MDX pages under a top-level `System/` sidebar group. Not a manager addon tab.**

- A docs page is URL-addressable (`?path=/docs/system-data-model--docs`), works in the static build that `storybook:smoke` and CI run, needs no manager↔preview channel, and renders with the preview's palette global. A `types.TAB` addon only shows beside a story, needs the plumbing `.storybook/picker/` shows (events, state, manager bundle) and is invisible in Docs mode.
- "Storybook is the development dashboard" is then a sidebar group that grows one page per concern: `System/Checks`, `System/Beads`, `System/Toolbox` later, each an MDX page over a generated JSON. Rename nothing; `Docs/Catalogue` stays.

## 5. Generation

- **Single source** `protocol/` plus two hand-kept inputs already in one place each: the save-table markdown table in `save.md` (the generator parses the `| Table | Rows |` block; it fails loudly when the heading is missing) and a 32-row file→layer map inside `bin/contracts.exs`.
- **Artefact** `docs/system-graph.gen.json`: `{ layers, capabilities, files, nodes[{id, file, name, layer, kind, owner, description, fields[], enum, examples, spec[], line}], edges[{from, to, kind, field}], deltaOps[], saveTables[] }`. Canonical encoding, so `--check` byte-compares it like the other outputs. No Mermaid text: the JSON is the contract; React draws it.
- **Renderer**: `mobile/app/stories/system/*.tsx` plain React DOM + inline SVG (react-dom already present), imported by `stories/System*.mdx` via `import graph from '../../../docs/system-graph.gen.json'`. Zero new dependencies.
- **Check**: `elixir bin/contracts.exs --check` already fails on a stale committed file; adding the new output to its file list is the whole CI change. `storybook:smoke` covers rendering.

## 6. Phased plan (each one PR, one Opus developer)

**PR1 — Foundation.** Generator output + check; `System/Overview`, `System/Data model` (grid, search, layer/capability/kind/residency filters, detail panel, 1-hop focus, deep link global, copy link, breadcrumb, keyboard), `System/Save`, `System/Capabilities` (table only). Cut from PR1: n-hop, path finding, impact view, lifecycle swimlane, cartridge examples, history. Reason: PR1 must land the generator contract and the explorer; every later feature is a pure consumer of the same JSON.

**PR2 — Flows and impact.** `System/Command lifecycle` swimlane; n-hop focus; path finding; impact view; cartridge/fixture example index; `ci.yml` job that diffs `system-graph.gen.json` against `main` and posts a PR comment; browser history.

**PR3 — Dashboard pages.** `System/Checks` (static JSON generated from `docs/CHECKS.md` + last `bin/check_all.sh` result), `System/Beads` (`br export` JSON at build time), `System/Toolbox` (mechanics toolbox rows from `mechanics.md`). Cut: live CI status fetched in the browser (static build, no network, secrets).

**Cut for good:** Mermaid (unreadable at this size, heavy, theme plumbing); a manager addon tab (invisible in Docs mode, more code); full all-edges ER diagram (hairball; Overview + focus replace it); in-browser diff vs main.

## 7. Acceptance checks (PR1)

1. `elixir bin/contracts.exs --check` passes on a clean tree; edit any `protocol/*.schema.json` description and it exits 1 naming `docs/system-graph.gen.json` (red control).
2. `nodes.length` equals the sum of `$defs` across the 32 files (262 today); a test asserts every file in `protocol/*.schema.json` appears in `files`.
3. Every `$ref` site resolves to an edge; the generator fails on an unresolvable ref; `edges` count ≥ distinct ref targets.
4. Every registry capability has a row; every `commands`/`definitions`/`events`/`policies` entry resolves to a node or the generator fails.
5. In Storybook: selecting `delta.StateDelta` draws its edges and the panel lists its fields with required marks, the `op` enum values, owner, spec link and `protocol/delta.schema.json:<line>`.
6. `?path=/docs/system-data-model--docs&globals=node:delta.StateDelta` opens with that node selected.
7. Search `hp` returns ResourceSpec and the resource@1 row; filter layer=Save shows 7 tables.
8. `storybook:smoke` builds and axe passes in light and dark on all four System pages; every chip is keyboard reachable.
9. No raw hex outside the dashboard's single palette constant (proposed check: grep `#[0-9a-f]{6}` under `stories/system/`).

## 8. Open questions

1. State section names live only in runtime TS. Options: (a) PR2 adds a kernel test that writes `docs/state-sections.gen.json` from `fresh.ts` written sections and the generator joins it; (b) accept DeltaOp-level state in PR1. Recommend (b) then (a).
2. Spec links: descriptions cite `NN §M`; the generator maps `NN` → `docs/archive/spec/NN-*.md`. Confirm that convention holds for every file.
3. Layer hues above are placeholders for the owner's taste; the contrast rule is the fixed part.
