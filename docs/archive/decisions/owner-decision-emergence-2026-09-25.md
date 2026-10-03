# Owner decision: composability and emergence principles — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

## Owner's direction

> I want this to capture the immersiveness of LegendMUD, Ultima Online, people can build
> houses, create guilds, craft things, trade, social, roleplay etc, LegendMUD had game
> mechanis that composed and combinations that are still to be found. Part of the whole
> emergent property thing. How can we achieve that for the online portion?

What the PM proposed (summary): write these principles down and add a composes-with check
to every mechanic slice's brief and review, starting with R5 S3; no online features are
built now.

Owner's words:

> yes please that makes sense, composability and emergence principles will be important
> for the online portion

## Principles

Emergence comes from systems that share the world's nouns, not from authored combinations.
They extend spec 21 §1 (closed semantics, open composition), §3.4 (ReactionRule) and the
shared consequence vocabulary (21 §11).

1. **Mechanics meet through shared vocabulary, never by name.** A capability reads facts,
   properties, relations, containment, perception and domain events that any other
   capability can use, and changes them only through the registered consequence vocabulary
   (21 §11; there is no generic set-field operation). Capability code never special-cases
   another mechanic or a single piece of content ("if fire and this door"). Example: fire's
   consequence acts on anything `burnable`; a wooden locked door is burnable; so fire opens
   it, though nobody wrote a rule about fire and doors.
2. **Player verbs act on general properties.** An action targets whatever satisfies its
   policy (material, container, lit, hidden, ...), not a listed set of entities, so players
   can find uses nobody enumerated.
3. **Reactions chain, within bounds.** Events trigger ReactionRules that emit further registered
   typed consequences (fire spreads, noise wakes a guard), bounded by the budgets and ordering
   rules so a chain is deterministic and terminates.
4. **The world remembers players.** Houses, signs, books, guild halls, stock, reputation
   and trails are persistent state under ownership and access policies (21 §27), in the
   Realm's authority.
5. **Consequences are real.** Scarcity, decay, sinks, theft and loss exist where a cartridge
   or Realm enables them; the online economy never imports offline value (07 §21).
6. **Social play is first-class.** Speech range, emotes, introductions and displayed
   identity (21 §6 Recognition), player-written text, and group channels (21 §16).
7. **Emergent must not mean exploitable.** Conservation and containment invariants, the
   seeded simulation over sequences that mix several capabilities, and multiplayer/economy
   certification (07 §3) keep undiscovered combinations from becoming duplication bugs.

## The composes-with check

Every slice that adds or changes a mechanic states, in its brief and PR: which shared
vocabulary it reads and writes; which existing mechanics it now affects without extra
code; and any place its capability code names another mechanic or a specific piece of content
(each such place is a finding unless the spec requires it). Cartridge content, such as a
ReactionRule on one bell, names content by design and is not covered. Reviewers check the
statement.
