# Review: balance tool 5, content graph and reachability report (loka-kgd.107.5)

- Branch `toolbox/m9b-reach`, head `b430a7f41032a1cc497d8ac52a6abffe3d088a81`, diffed against `origin/toolbox/batch-m9b` (merge base). No PR (batch model).
- Governing: [Content reports](../system/cartridge.md#content-reports) (added here), [study](../rnd/balance-diagnostics-2026-10-11.md) §6 R1/R2, §1 I4, §8 N2; brief in Beads `loka-kgd.107.5` Notes. Known limits filed as `loka-kgd.107.18` (travel/ferry reach, engine reads without op).
- Hosted ci and book-e2e green on the head (`gh run list --commit`).
- Verdict: **APPROVE WITH NOTES** (no blocker; two should-fix).
- Written 2026-10-12 05:21 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Loader behaviour is unchanged: `lockout` gives the same BARRIER_UNREACHABLE_KEY set, `reserved` the same RESERVED_FACT set.
2. `reach(c, false)` keeps every locked barrier shut, exits and item containers alike; `behind_lock` is the difference.
3. Report lists follow the spec definitions; template items are not judged for reach.
4. Engine-owned facts never show as orphans; the limits section names what the report cannot see.
5. A tool only: no gate, no committed output, no kernel contract change.

## Proof

- Green at head: TS `content_graph`, `barriers`, `locks`, `position`, `patrol_content`, `skill_growth`, `quest_hints`, `cartridge_services`, `cartridge_dreams` (45 pass); `npm run typecheck` 0; prettier on the five changed files clean.
- Loader unchanged (read): `lockout` takes `{rooms, items: keys} = reach(c)`; `reach` with the default `keys = true` uses `held` as before; the stuck test uses `opens(c, s.barrier, keys)` with the same set. `reserved`'s `owned` is the same union as the old `refs + patrolRefs + serviceRefs`. Barrier and lock tests untouched and green.
- All 65 cartridges compiled with `mix loka.compile` into scratch and run through the tool: all load; showcase lists only `store_unbarred` read_only (rerun of the handoff claim); no edges from `lock`/`manifest`; NPC→room edges only at `.room`, `.daily_schedule.*`, `.schedule_cases.*[n].room`, as the spec says (start, schedule).
- Mutants (reverted) against `content_graph`, `barriers`, `locks`: topic read clause dropped red; container lock ignored in `reach` red (locks); `engineWrittenRefs` dropped from orphans red; NPC reach `some`→`every` red. Survivor: finding 2. Section test `every`→`some` survives but no real artifact mixes ref and plain keys (equivalent).
- Developer's survivor (op from any ancestor): applied it and diffed every fact edge's op over all 65 artifacts: zero differences, reports identical. Harmless on current content; accepted.
- Tests: hand-written literals, expected values literal; no fixture or mock beyond the fields read.

## Findings

1. **should-fix**, `kernel/ts/play/reach.ts:83` and the limits bullet at `docs/system/cartridge.md:387`: quests count reachable only through a dialogue edge, so a quest offered by a reached room, a recipe or a reaction lists as unreachable. Seen on 5 of 65 cartridges (`ashmere_errand` lantern, offered in `ferry_landing`; `quest_sampler` find_key; `levelling_sampler` cull; `spells_sampler` apprentice; `ashmere_journal` oar). The limits name neither case, nor does `loka-kgd.107.18`. Fix: also count quest edges from reached rooms, or add the clause to the limits and to `loka-kgd.107.18`.
2. **should-fix**, `kernel/ts/test/content_graph.test.ts:43`: mutant `held = location.in === 'npc'` (drops `npcs.has(...)` at `reach.ts:79`) stays green, so an item an unreachable NPC holds would vanish from `unreachable.items`. Fix: give the hermit a held item and expect it in `unreachable.items` in the first test.

## Fix re-check (b8be4b41)

- Written 2026-10-12 05:35 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Reviewed only `b8be4b41b00970193ef04e69ad7c0eb15ca1d29d` (`kernel/ts/play/reach.ts`, `kernel/ts/test/content_graph.test.ts`, `docs/system/cartridge.md`). Hosted ci and book-e2e green on it.
- Verdict: **APPROVE WITH NOTES** (finding 2 resolved; finding 1 partly resolved, one should-fix left).
- Green: `content_graph` 6/6, `barriers` + `locks` 17/17.
- Mutants (reverted), each red on `content_graph`: quests from dialogues only (old line); `held` without `npcs.has(...)`; rooms dropped from `reached`.
- Reran the 5 cartridges (compiled with `mix loka.compile` into scratch): `ashmere_errand` none; `quest_sampler` find_key, `levelling_sampler` cull, `spells_sampler` apprentice, `ashmere_journal` oar listed, as claimed.

### Dispositions

1. **Partly resolved.** Quests named by a reached room, item, NPC or dialogue now count (`reach.ts:83-84`; `ashmere_errand` lantern cleared). The four still listed are not orphans. Each has its own `offer` whose policy is `{"op":"all","items":[]}` (always true). A quest starts through its offer ([mechanics.md quest@1](../system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets)), so all four can be accepted on turn one. oar is played that way in `kernel/ts/test/journal.test.ts:69` (`invoke(world(), 'oar')`). The recipes and reactions that name find_key, cull and apprentice come later. The new limits clause (`cartridge.md:388`, "a quest only a recipe, reaction or action names shows unreachable") gives the wrong cause, and it does not say that a quest with its own offer shows unreachable. No content issue is needed for oar.
   - **should-fix**, `kernel/ts/play/reach.ts:84`: a quest that declares `offer` lists as unreachable. Scenario: an author adds an always-offered quest and is told nobody can reach it (4 of 5 checked cartridges). Fix: count a quest with an `offer` as reachable (the policy is not evaluated, just as dialogue edges are counted), or name the offer in the limits bullet.
2. **Resolved.** The hermit holds the pearl, which is expected in `unreachable.items` (`content_graph.test.ts:38,76`). Dropping `&& npcs.has(...)` at `reach.ts:79` now fails.

## Fix re-check 2 (02a4d7f6)

- Written 2026-10-12 05:47 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Reviewed only `02a4d7f6d91e0f1b940f14169cc5a23c21d40d2a` (`kernel/ts/play/reach.ts`, `kernel/ts/test/content_graph.test.ts`, `docs/system/cartridge.md`). Hosted ci and book-e2e green on it.
- Verdict: **APPROVE** (the remaining should-fix is resolved; no new findings).
- Green: `content_graph` all pass.
- Mutants (reverted), each red on `content_graph`: offer clause dropped from `quests` (`reach.ts:87`) fails 'a quest with its own offer and no dialogue is reachable'; `unheld = placed` fails the first report test.
- `unheld` refactor (`reach.ts:80`): the same expression moved out of the return, after `npcs` and `held` are defined; behaviour unchanged.
- Reran the 4 cartridges (compiled with `mix loka.compile` into scratch): `quest_sampler`, `levelling_sampler`, `spells_sampler`, `ashmere_journal` list no unreachable quest; with the offer clause dropped all four list one again, so real content exercises the fix.

### Disposition

1. **Resolved.** A quest that declares `offer` counts as reachable without evaluating its policy (`reach.ts:85-87`), matching [mechanics.md quest@1](../system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets) (a quest starts through its offer). The unreachable bullet (`cartridge.md:374`) and the limits (`cartridge.md:389-391`) now say so and give the correct cause for quests without an offer.
