# Review: potions and song buff, toolbox rows 18 and 42 (loka-kgd.36)

- Branch `toolbox/m5-buffs`, head `2a363cad128cc20b23e0149e1eaa6a27e53ebc30`, diff `b8c45a8d...2a363cad` (35 files); no PR yet (batch M5). Protocol and kernel contract change (`status.apply` step `npc`, `kernel_api` 1.46), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox rows 18 and 42](../MECHANICS-TOOLBOX.md#ranked-toolbox), [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1), [row G3](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3), [row 2c](../system/mechanics.md#status-modifiers-toolbox-row-2c), brief and rulings in Beads `loka-kgd.36`, `loka-kgd.50`.
- Hosted CI on the head: ci 38061326811 success, book-e2e 38061326814 success.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Drinking a potion raises str by 3 for 3600 s of game time; at expiry str returns to its base.
2. Stacking: a second dose while active refreshes `ends_at` and never sums (row 1, row 2c).
3. A song needs the instrument; on completion it buffs the performer and only listeners present; an absent or dead listener takes nothing.
4. The new step field resolves to one deterministic authored instance (replay safe), joins that holder's G3 writer group, and is refused identically by the TS loader and Elixir compiler (unknown NPC, spawn template, with `item`, below 1.46).
5. Chapter 1 bytes unchanged; no `size: allow` raised; capability code names no content.

## Proof

- Baseline green: `buffs`, `status`, `npc_status` (TS); `content_buffs_test.exs`.
- Killed: M1 `reaction.ts:188` ignores `npc` (listener 10); M2 `cartridge_status.ts:70` drops `|| s.item` (loads); M3 content: `song_traveller` without `when` (traveller 12); M4 `reactions.ex:137` drops `|| s["item"]`; M5 `status.ex:41` gate without `npc`. No survivor.
- 1-4 hold: `buffs.test.ts` asserts 13/13/13 at +1800 re-dose, +3601, +5399 and 10 at +5400; holder is `world.entityIds[ref]` (authored id, fixed across replay); `applyStatus` refuses dead, immune and non-holder kinds; `holders` keys by entity id, so the NPC step shares G3's per-holder group exactly as a subject NPC does.
- Claims rerun: "Eat emits no reaction event" holds (`mechanics/food/` emits no event type); "red controls in both kernels" holds (M1, M2, M4, M5).
- Probes (throwaway edits to `buffs.test.ts`, reverted): a re-play after the listener's `inspired` expired reads `[12, 12, 10]` (next generation on the NPC holder); a re-play at +1799 then one more second still reads 12 (refresh). Drink, elapsed 1000, drink, then one elapsed of 4600 faults `precondition_failed` on the player's `might` row; same at base `b8c45a8d` with `per_tick: 1` and no `modifies` (finding 2).
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` byte-identical at base and head (sha1 `ee93f779`); no fixture besides `invalid.json` touched; `check_size.exs`, `check_ts_size.mjs` exit 0; no `size: allow` line in the diff.

## Rulings asked

- One rule per listener: acceptable. The row's proof needs present listeners buffed and absent ones not; an "everyone present" form is new engine scope. The template refusal (spawned NPCs never take a song) is documented as a known limit (`mechanics.md` rows 18/42).
- item/npc exclusivity as a kernel check: acceptable. The validator subset has `exactlyOneRequired` (wrong here: neither field is legal) and `oneOf`, which would mean splitting the step shape three ways; a two-line kernel check in each kernel is smaller.
- G3 writer groups on NPC holders: hold. `statusStep` keys `holders` by entity id, so a named NPC joins the same group as a subject NPC; a same-advance reaction plus job on the NPC is not reachable from a player command, so this is code reading plus the re-play probe.
- Pre-existing gap (`status.apply item` naming a template item loads, applies nothing; developer's report, not rerun): file-worthy at low priority, PM to file; the `lone` check (`cartridge_status.ts:69`, `reactions.ex:134`) extends to `items` in one line per kernel.

## Findings

1. **should-fix (batch merge)** Trial merge with `origin/toolbox/m5-drains` (19ea3345) conflicts in `kernel/ts/src/content/cartridge_status.ts:26,84` (drains renames `rowG3` to `api146` and returns `drinks`; keep both `lone` and `drinks`), `lib/loka/content/status.ex:27` (`row_g3` to `api_146`; comment names both), `docs/MECHANICS-TOOLBOX.md` (adjacent rows) and the two `*.gen.json` (regenerate). Same 1.46 floor, no version clash. After resolving, rerun `buffs` and `needs` tests and both content tests.
2. **should-fix (engine, filed Beads `loka-6ztc`)** `kernel/ts/src/mechanics/status/job.ts:28-71` (runStatus; root cause not located): after a refresh in an earlier command, one elapsed that crosses the pending job's reschedule and the refreshed end faults `precondition_failed` (player body and NPC holders alike). Pre-existing (row 1, reproduces at base without `modifies`); the mobile host's elapsed boundary (`mobile/authority/local-story/elapsed.ts:61-69`) stops at each pending job, so play through that path does not reach it. `buffs.test.ts:81-95` splits its waits at each job in the same way, so it cannot see the fault; acceptable while the host stops at jobs. Row 18's proof stands on the host's path; the PM decides whether the fix gates the batch merge.
3. **nit** `cartridge_status.ts:69` vs `reactions.ex:134`: an unknown `npc` plus `item` gives TS UNRESOLVED_REFERENCE and SCHEMA_VIOLATION, Elixir only UNRESOLVED_REFERENCE. The loader's first diagnostic matches, so no user-visible difference; note only.
