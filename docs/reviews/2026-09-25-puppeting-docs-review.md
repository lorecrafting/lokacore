# Review: puppeting owner decision, contract lesson, roadmap entry, #35 ledger — 2026-09-25

- PR: #36 (`pm-puppeting-35`), commit reviewed `8eb47f7`.
- Reviewer: a fresh Claude Code agent (Opus) that authored none of the work. Docs-only
  slice: no mutation testing.
- Verdict: **APPROVE WITH NOTES**.

## What must be true

1. The decision record's summary of the PM's proposal matches the code it describes.
2. The lesson states a rule the current rule modules could follow, and says where they do
   not.
3. Links resolve; the ledger lines are canonical, unique `agent.work` records in the
   existing shape.

## Checks run

- `elixir bin/check_docs.exs`: 111 docs, 0 broken links, 0 unreachable.
- `mix test test/loka/core/registries_test.exs` (the dev-evidence check): 16 passed. The
  four #35 lines match the existing shape (PM `opus`/`unknown` as in earlier PRs; reviewer
  `fable` matches the S2 review record).
- Prettier clean on the three touched Markdown files. `21 §10` intent arbitration exists
  (`docs/spec/21-composable-world-primitives.md:638`, `:669`).
- Code claims: commands carry `actor_id` (`contracts.gen.ts`); `World` keeps `character`
  and `body` apart (`world.ts:65-78`); admission compares `payload.actor_id` with
  `world.character` (`world.ts:112`); the `loka play` host fills it (`play/main.ts:108`).
  No module under `kernel/ts/src/rules/` names `world.character`.

## Findings

1. **should-fix** (follow-up, not blocking this PR) — the "only single-controller
   assumption is at the admission boundary and the `loka play` host" claim
   (`docs/decisions/owner-decision-puppeting-2026-09-25.md:10-11`) is too narrow, and the
   lesson (`docs/lessons/contracts.md:18-21`) misses the same spots:
   - `decision.ts:105-106`: the shared `event()` helper, called by rules
     (`rules/movement.ts:33`), stamps every event's `actor_id` and `scope` from
     `world.character`. That is neither the admission boundary nor a host, so the lesson's
     "only the admission boundary and hosts may name the player" already fails here.
   - `rules/movement.ts:21,28,32,38`, `rules/description_variant.ts:11`, `target.ts:28`:
     rules act on `world.body`, the one player body, not the body of `payload.actor_id`.
     This is the same "actor is the player" assumption through a different field; the
     lesson's `world.character` wording lets it pass.
   - `world.ts:168`: `gameView` is the player's view (the roadmap entry already lists a
     GameView from the body's perception).

   Scenario: a later NPC-issued `move` with an NPC's `actor_id` passes a widened
   admission check, then moves the player's body and records the player as actor. Fix:
   PM corrects the summary sentence and widens the lesson to "the actor and its body come
   from the command, never from `world.character` or `world.body`", and files the three
   code sites as a follow-up (derive body from `actor_id`; pass the actor to `event()`).
   Changing today's code is not needed: only one controller exists and admission rejects
   any other actor.

## Not checked

- The owner quote "yes please": relayed, not verifiable.
