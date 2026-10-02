# Owner leaning (not a decision): Realm separation — 2026-10-01

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the wording is
smoothed, not quoted. No checker can verify it against the chat.

**Status: LEANING.** This is not a decision. The online-first question stays open, and nothing
in the spec changes until [ADR-074](adr-074-ts-first-proposal.md)'s trigger, when the owner
chooses a route (ADR-074 §5).

Owner (paraphrased): a middle path on ADR-074 §5 route (a).

- Online and offline share the foundation: the cartridge format, the content compiler,
  canonical encoding, IDs and the delta algebra. They do not share the rules.
- The Realm copies offline concepts and drifts from them freely.
- A feature that behaves differently online gets a new key
  ([05 §6](../spec/05-cartridges-content-capabilities.md#6-capability-registry); for example
  `realm_quest@1`), because online play needs contention, shared state, real time and many
  players.
- Cost: a story cartridge does not run online as it is; co-op play would port its content.
