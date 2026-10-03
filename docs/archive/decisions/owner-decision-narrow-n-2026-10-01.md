# Owner decision: narrow slice N (narration@1) — 2026-10-01

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

**Owner (paraphrased).** Slice N is narrowed to what the Lantern proof needs:

- `narration.emit` as a reaction consequence is out (the Lantern names no ReactionRule; 21 §11 is
  a candidate list).
- A committed narration line binds the entities it names, pinned at commit; recipe narration
  exercises it. The record is DecisionResult.narration in the receipt: no new state, table or
  effect. The 64-line cap and output bytes stay; no new fault code; audience is the command's
  actor only. No acknowledgement, no registry change. The demo extends `ashmere_ferry`'s
  `coil_rope`.

**PM rulings (not the owner's), after the developer found the first committed and authored
shapes outside the schema subset:**

- **Committed form.** The subset stays as it is (an `anyOf` object branch stays rejected, so
  GameView's TextValue does not widen on the wire). A committed Text line gains an optional
  `participants` map, binding name to EntityId (06 §43 "pinned text keys and bindings", "bound
  participant identities"; lantern-traces.json binds plain identities). `bindings` is unchanged.
  Rendering names from identities is presentation, out of N.
- **Authored form.** Recipe narration's optional `participants` map takes a NarrationParticipant,
  a `oneOf` on `role` modelled on ItemLocation: `npc` or `item` naming its DefinitionRef in the
  field of that name, or `actor`. The field decides the kind, so short references expand
  unambiguously (the [short-refs decision](owner-decision-short-refs-2026-09-25.md)).
- **Player name.** Dropped from N: no `player.short`, no 05 amendment. The actor participant is
  the actor's entity, its body.
- `narration` joins the kernel's ruleless capabilities; N adds no policy leaf.

Effect: [ROADMAP, Early R7/R8 slices](../../ROADMAP.md#early-r7r8-slices), row N.
