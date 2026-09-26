# Contract lessons

Hard-won lessons for `protocol/` schemas, fixtures and canonical encoding (R3). What each
file covers: [the protocol map](../../protocol/README.md).

- Every `required` entry and every bound (`minItems`, `maximum`, `pattern`, `const`, ...)
  needs a fixture that fails when it is removed. A scripted sweep that drops one entry or
  bound at a time and reruns the fixtures found survivors in three R3 PRs (6a, 3, 4b); run
  it on every new or changed schema before handoff. Expected errors come from the schema
  text or a separate oracle, never from the validator.
- Elixir maps with 32 keys or fewer iterate in sorted key order, so a key-order test with
  fewer keys passes even when the encoder never sorts. Use more than 32 keys.
- Elixir's type checker rejects a wrong id tag only where inference reaches a literal tag
  pattern; an `@spec` alone, `Enum`/`Map` pipelines, decoded JSON and runtime-chosen unions
  are unchecked (`test/loka/core/nominal_ids_test.exs` records which shapes warn). Build
  ids with the `Loka.Core.Contracts` constructors at the boundary and match the tag
  explicitly (`{:character_id, id}`) in every domain function head.
- Rules take the actor from the command (`payload.actor_id`), never from `world.character`;
  only the admission boundary and hosts name the player. The actor's body is `world.body`
  today (one body, no actor-to-body lookup yet). Before admission accepts a second actor,
  these sites must take the body and actor from the command: `event()` in
  `kernel/ts/src/decision.ts`, `rules/movement.ts`, `rules/description_variant.ts` and
  `target.ts`. A rule that assumes "the actor is the player" blocks puppeting and
  NPC-issued commands
  ([owner decision](../decisions/owner-decision-puppeting-2026-09-25.md)).
- Cartridge source accepts a short reference (a Key) at every DefinitionRef, but only the
  fields `Loka.Content.Checks.expand/2` lists get expanded. A new source reference field
  needs an entry there and a short-ref test; otherwise the compiler emits an artifact the
  loader rejects
  ([owner decision](../decisions/owner-decision-short-refs-2026-09-25.md)).
