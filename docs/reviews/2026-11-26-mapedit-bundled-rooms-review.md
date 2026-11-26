# Review: Map edits on area-bundle rooms (PR #807, loka-hcnlh.77)

- PR #807, branch `fix/mapedit-bundled-rooms`. Reviewed at `5ce35119b1c7194bd824c05f0740d84ec17eb3cf`.
- Governing: [cartridge.md, Area bundles](../system/cartridge.md) (a bundled definition is exactly its `<dir>/<key>.json`); book-ui.md Room sheet edits; [architecture.md, building mechanics by composition](../system/architecture.md#building-mechanics-by-composition) (editor write side only, no mechanic).
- Why a record: shared kernel/ts/play code (PM brief).
- CI at the head (`gh run list --commit 5ce35119b…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Every exit read and write in `mapedit.ts` resolves a bundled room to `rooms.<key>.exits` of `areas/<a>.json`, and a root or area-folder room to the file's `exits`.
2. "Bundled" matches the compiler: `Source` kind `{["areas", _], ".json"}` (`lib/loka/content/source.ex:244`) and `Areas.area_of` `["areas", file]` (`areas.ex:59`).
3. A barrier's file placement passes `AreaRules` for both faces and `mix loka.new` accepts it; the compiled exits name the barrier on both faces.
4. Mixed root/bundled pairs write each face in its own file and shape.
5. Undo leaves every file, the bundle included, byte-identical.
6. Each new branch is held by a test that fails when it breaks.

## Checks run (detached worktree at the head)

- `grep exits mapedit.ts`: every read/write goes through `exitsOf`/`exitsAt` (`:58,:85,:96,:100-101,:112,:116,:132,:142-143,:149`). Regex `:49` equals `source.ex:244`.
- `npm run test:files -- test/author_mapedit.test.ts`: 25 pass. Cites `:561`, `:568` land as stated.
- `bin/mutate_diff.sh origin/main`: red-narrow 6/6 (`:100,:113,:114,:116,:135`×2). The handback's 4/4 was at an earlier commit.
- Claims rerun: origin/main `mapedit.ts` → `Error: f has no exit east` (backed). `:55` → `['exits', dir]` → `a path through a non-object` (backed).
- Hand mutants: `:49` → `/^areas\//` red; `:135` drop `&& !bundled(a)` red (mix "no rooms in areas/pen yet"); `:113` `const to = a.key` red; `:56` `exitsAt(r)` → `['exits']` **green** (Finding 1).
- Compile probe (copy of speech_sampler plus a root room `r` and `barrier@1`, real `serve` and mix; not committed): link r↔mill, One-way r north twice, unlink/relink square↔watchhouse (watchhouse left with `exits: {}`, so `:55`, not `:56`), Barrier square east (`gate`), Barrier mill south (`hatch`, mixed), One-way lane east twice. `mix loka.compile --allow-placeholders` exit 0; artifact: square.east and watchhouse.west carry `barrier/gate`, mill.south and r.north `barrier/hatch`; both at root `barriers/`. Undo all: byte-identical.

## Findings

1. **Nit** (test gap), `kernel/ts/play/mapedit.ts:56`: the bundled no-`exits`-key branch is untested; mutant `path: ['exits']` passes all 25 tests. It would write a top-level `exits` into `areas/<a>.json` (UNKNOWN_FIELD). Not a blocker: `exits` is required by `source.RoomDefinition` (`schemas/source/defs.schema.json`), the starter writes `exits: {}`, and no cartridge room omits it; seeding a bundled room without `exits` fails the scaffold's compile (5 tests red). Only an `extends` child that omits `exits` reaches it.
2. **Nit**, `mapedit.ts:135`: placement depends on gesture direction. A folder room in `areas/pen/rooms/` plus a bundled `pen` room puts the barrier in `areas/pen/barriers/`; drawn from the bundled side it lands at root. Both pass `AreaRules` (`areas.ex:72`, a root target never crosses).
3. **Nit**, `mapedit.ts:134` comment "a bundle's rooms are root's": true of `mix loka.new` (`Area.pick`), not the compiler (`Areas.area_of` gives the bundle's name).

Out of scope: New room / New person in bundled rooms (loka-hcnlh.78).
