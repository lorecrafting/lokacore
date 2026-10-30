# Realm live operations: shipping content and mechanics without a restart (proposal), 2026-10-29

A PM design sketch, not a decision. Nothing here is built or authorized; it records a direction to weigh
when Realm work starts. Beads: loka-cw9y.

## The question

Owner (paraphrased): in the persistent online Realm, how could LLM agents develop on the live world and
ship changes live without restarting the server; what would players see; how fast would changes deploy;
how would live testing and rollback work?

## Three layers, three ways to ship

| Layer | Example | Ships by |
|---|---|---|
| Content (cartridge JSON) | a quest, a shop rebalance, a room | artifact swap between two commands, per zone or shard |
| World state (who holds what, facts, positions) | inventory, a door's state | commands only, or an authored migration; never edited in place |
| Mechanics (engine rules) | a new step op or policy leaf | a new `key@version` beside the old one; content opts in |

Why this fits Loka: a decision is atomic (rules propose, nothing commits until adopt; [protocol](../system/protocol.md)),
so the gap between two commands is a clean swap point; content is compiled data with no code of its own
([artifact and loader](../system/cartridge.md#artifact-and-loader); a bad reference there is a runtime fault, not a crash); decisions are deterministic, so recorded traffic can be replayed against a change.
A released `key@version` is immutable in meaning ([ADR-074](../archive/decisions/adr-074-ts-first-proposal.md)).

## Content: live artifact swap

A zone or shard process holds a reference to its current artifact; after a command commits it adopts the new
one and the next command runs on it. Connections stay up (Phoenix holds them, as Evennia's Portal does during a reload).

Needed:

1. **Content diff and migration contract.** The compiler compares the old and new artifact against live state.
   Additive changes (new rooms, text, reactions) ship automatically. Destructive ones (deleting an item
   definition with live instances, changing a fact's type) are refused unless the release carries an
   authored migration, written as data in the step vocabulary. This would replace the Story rule "a save is pinned
   to its release; [Start over](../system/save.md#opening-a-story)" with a Realm release lineage; Realm hosting
   policy is open today ([owner rules](../system/owner-rules.md)).
2. **Shadow replay.** Re-run the last hours of live commands, from receipts, against a copy of the world on
   the new artifact and diff the outcomes before any player sees them. Requires every receipt to record the
   artifact hash it was decided under (not true today: a Story save pins one hash for all its receipts).
3. **Canary, then promote.** One zone or shard first; compare error, budget-fault and refusal rates with the
   baseline; then widen. Content opt-in per zone is the feature flag.

## Mechanics: versions, not hot patches

Two steps, kept apart:

1. **Ship the engine build** carrying both `foo@1` (unchanged) and `foo@2`. Nothing uses `@2`, so no player
   sees a change. Adding code without changing a released meaning is the one case where BEAM hot code
   loading is safe; a real replacement uses a shard handoff (queue commands, finish the one in flight, hand
   over state, resume; an estimated pause of about a second, not measured).
2. **Turn it on with content**: a release for one zone declares `foo@2`. That is the content path above.

## What players see

- A player mid-session: one command commits on the old content, the next runs on the new; no disconnect.
- Mid-dialogue, fight or scene: state persists between commands, so it continues.
- Players outside the switched zone see nothing.

## Speed (estimates)

| Change | Rough time | Dominated by |
|---|---|---|
| Content only | 15-45 min to full rollout | shadow replay minutes, canary 10-30 min, swap seconds |
| New mechanic | 1-4 h to the build, then the content path | brief, implementation, review, CI (today's slice cadence) |
| Emergency content fix | minutes | roll back or forward-fix, compile, swap |

## Live testing, cheapest first

1. Transcripts and the seeded simulator in CI (exists).
2. Shadow replay of live traffic.
3. A builder instance: an instanced copy of the live zone with real state and no real players.
4. Canary zone or shard.

## Rollback

- **Content:** point the zone back at the previous artifact (immutable, retained). Seconds (estimate).
- **Engine:** usually nothing to undo; `@1` was never removed, so rolling content back stops `@2` use.
  Retire a version only when no content uses it.
- **State written under the new version** (items, fact values made during the canary) is the hard part.
  Forward-fix by default; make "`@2` state is ignorable by `@1`" a compiler-checked rule of the content diff;
  restore a release snapshot only as a last resort, since it loses player progress.

## LLM agents

Agents iterate live on content only, as builders scoped to zones (toolbox row R1, deferred to the Realm in
[MECHANICS-TOOLBOX](../MECHANICS-TOOLBOX.md)). The gates are mechanical: compiler refusals, transcript replay,
shadow replay, canary metrics, rollback. Engine changes keep the brief, review and CI path.

## Open before any of this

- The ADR-074 route: port the TypeScript rules to Elixir (held to the fixtures and the differential) or not;
  the owner wanted no Node process beside the server.
- The Realm save and migration policy (the owner rule against silently migrating a save needs a Realm form).
- The first Realm activity and the instancing model ([future](../system/future.md#online)).

## Keep true now (cheap)

Content stays data-only; decisions stay deterministic; every receipt stays traceable to the artifact hash it was
decided under (today through the save's pin).
