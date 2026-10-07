# Owner direction: shared Story and Realm mechanics with replaceable stories — 2026-10-04

## Owner direction

Owner instructions **(paraphrased)**, relayed from the current planning conversation;
these are not verbatim quotations:

- Offline Story is a training path to online Realm. Mechanics and UI/interaction should
  remain as close as possible so that what players learn offline transfers online.
- A distinct multiplayer Realm is still desired. Differences should follow explicit
  multiplayer requirements, rather than a default of separate mechanical vocabulary or UI.
- The story, authored events, quests and world content may be rewritten later over the
  stable core and mechanics. Missing Child is a consumer of that engine, not its permanent
  shape.

This supersedes the broad separate-rules direction in the earlier
[Realm separation leaning](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/decisions/owner-leaning-realm-separation-2026-10-01.md),
which was not a decision. That historical record remains unchanged.

## Application within existing architecture

The following applies the direction to existing contracts; it is not additional owner wording.

The [composition boundary](../system/architecture.md#building-mechanics-by-composition)
keeps story-specific IDs and branches out of foundation and reusable engine mechanics.
Cartridges supply concrete actors, places, quests, prose and world settings through typed
content. A plot event is authored content; a typed DomainEvent and quest lifecycle are
mechanical contracts. Rewriting one does not silently redefine the other. New behavior uses
the smallest missing primitive at a real consumer, under the
[existing clarification](owner-decision-consumer-primitives-2026-10-04.md), not a speculative
scripting framework.

Shared actions retain shared semantics and familiar presentation through the existing
[GameSession and presenter boundary](owner-decision-presenter-split-2026-10-02.md).
Multiplayer additions such as contested ownership, party credit or group choices need an
explicit semantic contract. Use existing scope/audience behavior where it suffices; genuinely
different behavior needs a distinct capability key/version, never a silent host-dependent
meaning under the same portable key/version.

[ADR-074](../archive/decisions/adr-074-ts-first-proposal.md) remains TypeScript-first until
server consumption. Its foundation obligations and first-consumer trigger remain in force:
identify the portable capabilities the server actually needs, settle the route before enabling
them, and require the retained fixtures and Elixir/TypeScript differential for an Elixir port.
This direction does not require porting every Story mechanic in advance.

Content replacement follows [cartridge identity](../system/cartridge.md#artifact-and-loader)
and [save pins](../system/save.md#opening-a-story). A changed release does not retarget an
existing save; migration, retained releases or explicit Start over follow their applicable
policy. The [unreleased sampler exception](owner-decision-sampler-development-look-2026-10-03.md)
is not a general migration or deletion permission. Stable mechanics means defined,
versioned semantics, not a prohibition on reviewed mechanic changes.

## Scope and remaining decisions

- The first Realm activity is undecided. A bounded two-player cooperative adventure is a
  PM recommendation only, not an owner selection or implementation authorization.
- Whether unchanged Story cartridges will also run online remains undecided. Shared
  mechanics do not require identical stories. Before implementation, reconcile the selected
  scope and ADR-074 route with the existing
  [R14/R15 same-cartridge promises](../archive/spec/14-implementation-plan.md#r14--beam-online-authority--realm-mode-skeleton).
- [Offline evidence policy](../archive/spec/23-accounts-progress-admission.md#6-evidence-policy-onboarding-not-competitive-rewards)
  remains in force: approved Story reports may satisfy onboarding; offline saves, inventory,
  currency, XP and other Realm value are not imported as online authority.
- This records planning direction. It authorizes no Realm implementation, no current story
  rewrite and no replacement of the approved Missing Child work.
