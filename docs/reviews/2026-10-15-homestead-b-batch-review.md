# Review: Homestead batch B head (PR #402, loka-kgd.108)

- PR [#402](https://github.com/lorecrafting/lokacore/pull/402), branch `toolbox/batch-homestead-b`, exact head `df7972c16542461052f66429940afa6d4cb82942`, base `origin/main` (merge base 45cd3a7e). Batch-head review: cross-slice composition, save integrity, Realm seams, spec vs code drift, hidden faucets, floors. Per-slice records: [hs-6](2026-10-15-hs-6-review.md), [hs-7](2026-10-15-hs-7-review.md), [hs-7 second opinion](2026-10-15-hs-7-second-opinion.md), [hs-8](2026-10-15-hs-8-review.md), [hs-9](2026-10-15-hs-9-review.md), [hs-9 second opinion](2026-10-15-hs-9-second-opinion.md), [hs-12](2026-10-15-hs-12-review.md), [hs-14](2026-10-15-hs-14-review.md), [kgd-108-14](2026-10-15-kgd-108-14-review.md), [kgd-108-14 second opinion](2026-10-15-kgd-108-14-second-opinion.md), [x6t-64](2026-10-15-x6t-64-review.md); hs-13, x6t-55, x6t-65 and the 1.102 bump were PR-comment reviews.
- Governing: [mechanics.md Cooking](../system/mechanics.md#cooking-homestead-row-hs-5), [Furnishing](../system/mechanics.md#furnishing-homestead-hs-6), [Give pairs](../system/mechanics.md#give-pairs), [Barter](../system/mechanics.md#barter-toolbox-row-kgd70), [Craft](../system/mechanics.md#craft-homestead-hs-10), [Skill trees](../system/mechanics.md#skill-trees-homestead-hs-11), [Built rooms S5](../system/mechanics.md#built-rooms-s5-raze-and-tombstone), [S6 self-build](../system/mechanics.md#built-rooms-s6-self-build), [Self-cooking](../system/mechanics.md#self-cooking-homestead-hs-13), [Skill tree view](../system/mechanics.md#skill-tree-view-homestead-hs-14), [cartridge.md services](../system/cartridge.md), [save.md](../system/save.md), [hidden elites secret](../decisions/owner-decision-hidden-elites-secret-2026-10-15.md); [composition](../system/architecture.md#building-mechanics-by-composition); [WORKFLOW review stance](../WORKFLOW.md#review-stance), [Git hygiene](../WORKFLOW.md#git-hygiene); [AGENTS.md Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Verdict: **APPROVE WITH NOTES** at df7972c1. No blocker, no new should-fix; one nit plus the fix-round list already agreed per slice.
- Written 2026-10-15 by anthropic/claude-fable-5-1.

## Must be true (written before the diff)

1. `built.set` composers refuse a stale `expected` and a non-built entity in both kernels; load refuses a razed row that is not a BuiltRow, `razed_at > clock`, or still contains entities; hydrate gives a razed room no exits and deletes the site exit only while it leads to that room; raise after raze on the same site works.
2. A hidden skill is secret everywhere (view, lesson offers, dialogue openability, loader refusal of a qualification or policy reading it) in both kernels; `choice_ids` tolerance covers only hidden-plus-prerequisite.
3. Every 1.102 feature (build step, item_present, profession, price 0, output without ready_after, status kind, raze) has a loader_floors case pinning it alone in both kernels.
4. Cross-slice: a recipe-built hut razes; raze then re-raise same site and direction; raze moves furnished items to the site; item_present reads the site after a raze.
5. No mint: craft is custody-only; trust bounded; price 0 only for an escrowed entitlement; claim and cancel never free.
6. Kernel parity for price 0, output without ready_after, the build step, hidden checks and status kind.
7. `protocol/fixtures/invalid.json` and `service_contracts.json` change only where the spec changed.
8. Give listing equals rule admission (sight excepted, known); the status ring keeps no gameplay clock.

Holds: 1 to 8. Item 7 holds by spec change, not additively: one invalid.json case (escrow `output` without `ready_after`, `missing_property`) is removed because [cartridge.md:1378](../system/cartridge.md) and [mechanics.md:3596](../system/mechanics.md) now admit it at 1.102, and the seven `service_contracts.json` "price 0" refusals move to price -1.

## Checks run

- Focused suites on the head, all green: `kernel/ts` built, built_composition, craft, craft_raze, furnish, gift, kitchen, status, status_composition, loader_floors, dialogue_openable, construction, variants (91 pass); Elixir content_craft, content_gift, content_construction, content_variants, loader_floors, core/built (15 pass); mobile authority built, gift, hidden_skill (exit 0).
- Code read against the list: `kernel/ts/src/foundation/compose_built.ts` `setBuilt` (`same(row, expected)` and `origin.kind === 'built'`) twins `ComposeBuilt.set`; `kernel/ts/src/runtime/created.ts:203-210` `builtValid`; `raze()` deletes the site exit only when it leads to the razed key; room keys are `built_<uuid>`, so re-raise cannot collide. `craftRefused` runs `unbuildable` before `crafted`; `step()` build op calls `created(...)` for detail targets only. `unrazable`: nothing_to_raze, permission_denied, occupied. `razed()` clears statuses and transfers contents in sorted EntityId order. `concealed` (skills.ts), `offered`/`openable`/`spokenBy` (selection.ts), `skillView`/`freeLessons`, loader `secret()` and Elixir `dialogues/2`, `reads?`, `teaches?` in skills.ex agree; no cartridge authors a hidden skill (test fixtures only). `transition()` skips payment at `price === 0`; `escrowed()` hands `escrow.output` over at once without ready_after; TS `barters`/`order()` equal Elixir `barter?`/`free/1`. `recipient()` in `containment/shared.ts` is shared by the Give rule and `view/item_pairs.ts`. `StatusIcon.tsx` ring: fraction from view `ends_at`/`duration`/`time`, tween by `performance.now()` deltas; presentation only.
- Mutants (`bin/mutate.sh`, all red, tree restored): `compose_built.ts` `origin.kind !== 'built'` -> `false` (built_composition, built red); `created.ts:210` containers-in-razed check -> `true` (built red); `selection.ts` `ids.includes(id) ||` -> `true ||` (dialogue_openable red); `cartridge_services.ts` price-0 guard -> `false` (gift, construction, validate red); `lib/loka/content/services.ex` `free/1` -> `{true, ["price"]}` with `mix test --force` (content_gift, content_construction red).
- PR claims: the body lists slices and governing sections only, no "catches / only here / every" claims or `file:line` cites to rerun.
- loader_floors.json union: seven 1.102 cases, each with edits or a sampler carrying only that feature (craft_sampler strips three `profession`s; gift_sampler adds `ready_after` 3600 plus `schedule` for the price-0 case and price 1 for the output case; furnish, skills, variants, build samplers carry one feature each); the 1.101 cases from batch A are intact.
- Economy: craft_sampler logs woodpile -> chop yields 4 -> saw consumes 2, yields 2 timber -> raise consumes 2 timber to the yard and builds (finite store, custody only); kitchen fish 5 -> stew 3 or feast 1 (custody only); furnish temper is a resource sink (mv -5); gift trust is an int clamped -1..1 (`cartridges/gift_sampler/facts.json`) and each reaction is one-shot behind `gifted_apple`/`gifted_rat`; barter knife for pelts: no price, no mint, `service.no_output` when the knife is gone before the pelts move.

## Findings

1. **Nit.** PR body does not report the developer's `/code-review` result; add in the fix round.

Confirmed from the per-slice lists (not re-reported): hs-8 mechanics.md "Give pairs" sight wording; `docs/showcase/combat-district.md:51` 1.48; `kernel/ts/src/view/resources.ts:59` polarity twice; `kernel/ts/test/status.test.ts:149` duplicate row; `docs/system/cartridge.md:1773`; `book-ui.md:989`; `selection.ts:62` hidden-lesson check x3; mechanics.md:3389 corpse-blocks-raze limit; secrecy decision link to hs-14 Load check; S5 known limit shared-world encounter in a razed hut (`saved.ts:80`); skill `hidden` without a 1.102 gate (`cartridge_skills.ts:87`, `skills.ex`).

Noted, not a finding: `lib/loka/content/status.ex:106` reports the status-kind floor at `cartridge.requires.kernel_api` while the other six 1.102 cases report `...kernel_api.at_least`; pre-existing convention shared with `bleed.ex:40`, pinned as-is by `loader_floors.json`.

## Disposition

Open: nit 1 and the per-slice fix-round list above. Settled: save integrity of raze (composer, load, hydrate; mutants red in both layers), hidden-skill secrecy across view, dialogue and both loaders (mutant red), floor union with each 1.102 feature pinned alone, barter parity (mutants red in both kernels), invalid.json and service_contracts.json changes traced to the spec, economy loops bounded.

## Fix re-check — `d1e1b2f2c6fb34dc811cf067501e050cee812afc`

**Verdict: APPROVE.** Fix branch `toolbox/batch-b-fix` over `df7972c1` (this record cherry-picked as `465522cb`). The developer's `/code-review` ran on another checkout, so the whole code diff `df7972c1..d1e1b2f2` (13 files, +57/-42, docs/reviews excluded) was read here.

- **1 fixed.** `kernel/ts/src/content/cartridge_skills.ts:86-88` floors a skill with `profession` or `hidden` at 1.102 and `lib/loka/content/skills.ex:178` is its twin; `protocol/cartridge.schema.json` and `contracts.gen.ts` say so on `SkillDefinition.hidden`; `cartridge.md:1966` and `mechanics.md:3479` name 1.102. New `loader_floors.json` case edits `cartridges/skills_sampler` (at_least 1.44, one skill with no profession, hidden or prerequisite) to add `hidden` plus an empty-`all` `prerequisite`, so it pins `hidden` alone (prerequisite stays 1.101).
- **2 fixed.** `mechanics.md:3629` names `hiddenTarget` and `not_present`; `kernel/ts/src/commands/actions.ts:241` returns `not_present` when `hiddenTarget` (`:296`, `recipient_id` not among `visible`) before the rule.
- **3 fixed.** `docs/showcase/combat-district.md:51` reads 1.102.
- **4 fixed.** `kernel/ts/src/view/resources.ts:54` computes `kind` once; `...(kind && { kind })` keeps the undefined case.
- **5 fixed.** `kernel/ts/test/status.test.ts` drops the `[none, undefined]` row. It was not a byte duplicate, but `[{ ...none, modifies: [by(0)] }, undefined]` and `[{ per_tick: 0 }, undefined]` still pin the no-kind result; no coverage lost.
- **6 fixed.** `cartridge.md:1773` lists `gored` (toolbox_showcase) and `scar` (scars_sampler).
- **7 fixed vs code.** `book-ui.md:989`: ring from view `ends_at`/`duration`/`time`, no gameplay clock; locked shows a line track and dim arc and keeps draining (`mobile/app/book/StatusIcon.tsx:85,123-127`). Designer approval of the wording is pending separately.
- **8 fixed.** `kernel/ts/src/mechanics/dialogue/selection.ts:44` `teaches(d, id, p)` serves `offered` (concealed) and `openable` (hidden with prerequisite); semantics unchanged, dialogue_openable green. `view/skills.ts:86` left as is: it collects skill ids, not a predicate.
- **9, 11 fixed.** `mechanics.md:3389` Known limits: corpse blocks raze (loka-kgd.122); shared-world open encounter in a razed room (`combat/saved.ts:80` `openValid`, `local-story/store.ts:146`), out of scope until a Realm hosts built rooms.
- **10 fixed.** `docs/decisions/owner-decision-hidden-elites-secret-2026-10-15.md` links the hs-14 Load check.
- **12** not re-probed; developer reports both kernels refuse a built room as escrow custody (`UNRESOLVED_REFERENCE`), no change.
- Nit (PR body `/code-review` result): the developer's run was on the wrong checkout; this re-check stands in for it.

Checks: `kernel/ts` loader_floors, dialogue_openable, status, craft, gift, validate (52 pass); Elixir loader_floors, content_craft (6 pass). Mutants (`bin/mutate.sh`, both red-narrow, tree restored): `cartridge_skills.ts` `s.profession || s.hidden` -> `s.profession` (loader_floors.test.ts red); `skills.ex` `has.("profession") or has.("hidden")` -> `has.("profession")` (`mix test --force test/loka/loader_floors_test.exs` red).

Open: none.
