# Owner decision: mechanics toolbox before the owner's own world — 2026-10-08

(paraphrased) Chapter 1, "The Missing Child", was scaffolding. The owner will hand-craft their own
world later on a cheaper plan; while on the Max plan, the project front-loads a toolbox of all
common RPG mechanics so that world can be assembled from finished parts.

## Effect

- **Chapter 1 is frozen as a mechanics sample, not released.** No release-candidate certification
  and no E3 gate for it; the [polish-order record](owner-decision-chapter-one-polish-order-2026-10-07.md)
  steps 4 and 5 no longer apply to Chapter 1. Its source, saves and witnesses stay as regression
  coverage for the mechanics it exercises.
- **Toolbox front-loading.** Every common RPG mechanic ships as a generic engine capability plus a
  tiny sampler cartridge with neutral ids (precedent: `cartridges/ashmere_sampler`) that is its
  focused test and its catalogue page. The ranked list, sizes and dependencies live in
  [MECHANICS-TOOLBOX.md](../MECHANICS-TOOLBOX.md); the owner said most of the audited gaps are
  needed.
- **Foundation first.** Before any mechanic: the in-flight Book UI polish batch merged, an unpinned
  dev preview that shows a freshly compiled cartridge in seconds, and a dev-only clock advance.
  The dev clock is a development control outside the player's Book; the
  [fixed-time rule](owner-decision-fixed-time-2026-10-03.md) for players is unchanged.
- **Lighter process for toolbox slices**: own worktree, focused tests plus one red control, one
  fresh Opus reviewer, findings as PR comments, auto-merge on green. No review record files,
  second opinions, stage labels, ROADMAP status commits or brief-drafter agents
  ([what differs from the workflow](../MECHANICS-TOOLBOX.md#toolbox-slice-process)).
- **Elixir compiler parity stays mandatory** for every new cartridge field
  ([Candidate C](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)).
- **[LATER-MECHANICS.md](../archive/LATER-MECHANICS.md) is superseded** by the toolbox and
  archived; its story-bound rows (C*, CC-C, CC-P) are dropped, its generic rows are re-ranked in
  the toolbox.

## Answers to the open questions

(paraphrased, same day)

1. Levelling is class-free: experience grants attribute points, skills grow by use, classes may come later as starting packages.
2. Ranged combat starts with a same-room first strike; shooting into adjacent rooms later.
3. The dev clock and unpinned preview live in a dev panel shown only with `?dev=1`, never in release.
4. The Chapter 1 E1 recorder stays in CI as the engine regression net.
5. One spell engine with per-spell requirements declared in the cartridge: spoken words, optional must-be-learned gate, optional minimum level and attributes, optional consumed reagents, mana cost, optional secret words found in lore. Common spells open with reagents and mana; great spells are learned by quest with level and stat gates.
