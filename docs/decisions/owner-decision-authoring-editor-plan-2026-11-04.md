# Owner decision: the authoring editor plan — 2026-11-04

Written 2026-11-04 in Claude Code (PM), from the authoring planning session (epic loka-wfrgk) and
a Fable audit of its plan. The owner's words are paraphrased. It replaces the record the
[GUI editor design](../rnd/gui-editor-design-2026-11-04.md) said would land with G1; that
design's rulings stand where this record does not change them (its section 8 marks each, and its
section 11 holds the audit's technical changes).

## World-class, as six promises

Owner, 2026-11-04 (paraphrased): yes to the six promises; the bar is the Unity, Godot or Unreal
editors with Figma's direct manipulation.

1. **The loop is instant.** An edit shows in the Book in about a second, where the writer was.
2. **Edit where it shows.** A mechanic is reached from where the player meets it; the picker is the fallback.
3. **No dead ends.** Every compiler refusal shows at its field, in plain words, with its fix one click away.
4. **Nothing is lost.** Whole-file `was` checks, an undo journal, one-file git diffs.
5. **Writing is first-class.** In-place prose and the jump to each `~` are the most polished parts.
6. **Agents are peers.** The editor writes ordinary source; agents edit the same files, and the
   owner watches the editor change as they do.

## Layout and interaction

Owner, 2026-11-04 (paraphrased): three columns, like Unity or Figma; the map always visible on the
left under the hierarchy, zoomable, not a centre tab; the Book a narrow phone or tablet strip in the
middle; built on the laptop screen alone; no modes; a reload badge for bursts; drag with a lock; a
web page for now; a Book click plays and selects. The PM recommendations below were accepted as given.

- **Left:** Hierarchy (area, room, the people and things in it, from the folders) and Project
  (world-wide kinds: statuses, skills, facts, world settings) as two tabs, over the map. The map
  can grow to fill the column for structure work.
- **Centre:** the Book at phone width (about 400 px); a tablet toggle checks the layout.
- **Right:** the inspector (the selected definition's card of mechanic blocks) over the console
  (refusals, Why, the change feed). Play, State, Find, Numbers and checkpoints move into these panels.
- **No modes.** A click in the Book plays as it does now and also selects what it touched; the
  hierarchy and the map select without playing; a double-click on Book text edits it; Alt-click
  opens the source. The hierarchy has a "needs words" filter. There is no edit-mode toggle.
- **Agents' edits, live.** The feed labels each change `you` (in the editor's journal) or
  `outside` (an agent or a text editor), with its file and field, and offers put-it-back on both:
  the watcher keeps the last bytes of every source file. A burst shows "N changes waiting,
  reload" instead of reloading the Book each time; **Hold** freezes the Book and queues every
  change behind the same badge. Both live in the watcher, which parks the artifact.
- **Commit points.** A field writes on Enter, on leaving the field, or on closing a picker; never per keystroke.
- **Direct manipulation:** drag rooms on the map, draw exits, drop an NPC or item into a room. Each
  thing and the whole map can be locked; locks live in the editor (browser storage), never in
  cartridge files. Dragging a template (an `abstract` parent) in to create a child waits for
  `bin/loka new --extends` (owner 2026-11-04).
- **Editing while playing:** the Book stays live (text edits overlay at once, structural edits
  reload and replay the path, as today).
- **Host:** a local web page beside the watcher.

## Book treatments

Owner, 2026-11-04 (paraphrased): named treatments; extract `spirit` and add `reverie` together
(`dream` is taken by the Rest dream mechanic).

- A cartridge selects one **named, designed whole** and sets its bounded parameters; it never
  combines parts or sets raw visuals. Each treatment is designed once (contrast, reduced motion,
  Flashes off, screen reader); the parts are the designer's internal kit.
- First slice: `spirit` becomes the first registered treatment (revival selects it implicitly;
  behaviour unchanged) and `reverie` is added for the prologue's opening dream (beat 2; later 11
  and 17).
- Hosts: a modal scene's optional `treatment` (source, artifact and the GameView's scene view) and
  revival now; rooms later; no step op (a step has no end). A presentation-only Rest dream does
  not host one yet. PM recommendation, not objected to.
- Editor: a "Book treatment" block on the host's card (the registered list, then only that
  treatment's parameters, bounded) and a Preview that plays it in the Book strip.
- It is a contract change, so it runs before the Pro plan with a reviewer. The reverie's feel is
  the owner's input to the designer's brief for that slice.

## Coverage gates

Owner, 2026-11-04 (paraphrased): a generic card first, made solid with reusable, well-maintained
components; a new mechanic ships its hand-built editor in its own PR; accept the gate's limits.

- **Toolbox half** (loka-vduxr.59), as ruled earlier: per installed capability a summary, its
  declarations or `engine-only: <reason>`, a compiling sampler, and a showcase location; gaps on
  main are fixed in that slice, not waived. Each treatment is a toolbox row too (summary, hosts,
  parameters, sampler, showcase) with a contrast check over every palette.
- **Editor half:** one registry maps each declaration path (every top-level field of each source
  definition and root file in `schemas/source/`, plus each treatment name) to its create, edit and
  delete surfaces. The paths come from the schema, so a new, renamed or retired field cannot
  slip past. The inspector's "add mechanic" and the hierarchy's "add here" menus are generated
  from the registry, so every registered mechanic is findable by construction.
- **Generic floor:** every existing mechanic gets a schema-generated card on react-jsonschema-form
  6 (chosen by the audit's probe of both libraries on our schemas), its defaults off so nothing is
  invented, with the shared blocks (Picker, Policy, Steps, Prose) as its fields on the panel's
  shadcn components.
- **Strict rule:** a new mechanic's PR ships its hand-built editor. The generic fallback list holds
  only the existing backlog and only shrinks. The rule starts when the gate exists (E4a).
- **Honesty:** the gate proves completeness, not correctness. Correctness rests on the write-path
  route tests with red controls, the compiler on every write, and **cards hold no logic**: each
  edit is a plain function (value and action to path changes) with `node:test` cases; React only
  draws. The owner walks each slice; a browser harness is revisited after the first three cards.

## Slice order

Owner, 2026-11-04 (paraphrased): all PM recommendations; prose in the Book first, since the owner
waits for it before writing the prologue.

Reviewer or contract work before the Pro plan (about 2026-11-10); panel-only work lean after.

| Window | Slices, in order |
|---|---|
| Before Pro | S2 area migration with S3's area lookups for `bin/loka new --from` (loka-vduxr.58.2); T1 treatments; E1 write path with loka-vduxr.51's text keys and loka-vduxr.53's route; the toolbox page and gate (loka-vduxr.59) if a slot is free. E1 and T1 are kept at any cost, then S2. |
| Pro, lean | E5 prose in the Book and the `~` jump; S3 (loka-vduxr.58.3); E2 shell; E3a map (loka-vduxr.52), E3b map edits; E4a edit model, registry and gate, E4b generic card; E6 hand-built inspectors, five slices: Room with add-here, NPC and Item, Rules (a reviewer), Story, World. S4 (loka-vduxr.58.4) at any time. |

- The prologue cartridge waits for S2 and S3 only. Until E5, agents may lay its structure with `~`;
  the owner writes the words once E5 lands.
- Small lean slices (loka-kgd.207, loka-vduxr.57) interleave between editor slices.
