# Owner decision: shipped content is human-made; AI writes code — 2026-10-31

Written 2026-10-31 in Claude Code, from the effects and sound planning session.

Owner, 2026-10-31 (paraphrased): the aim is the fastest development whose released game needs no store
declaration of AI content, with AI-generated code accepted. Asked whether this should be a firm rule, with only
the owner writing shipped story and lore, the owner said, verbatim: "yes. sounds good.  Also placeholder
music/sounds is a good idea until we replace them with real things, and we need a way to track them".

## Effect

1. **Human-made:** everything a player consumes in a release, or sees in its store page and marketing: story,
   lore, descriptions, dialogue, music, sounds, art and translations. AI-drafted content that a person edits does
   not count as human-made.
2. **AI allowed:** engine, UI, effects and tool code, tests, internal documents, QA and playtesting. It may flag
   content problems; a person writes the fix.
3. **Placeholders:** audio stays human-made even as a placeholder, so none can slip into a release. Each is
   tracked until replaced ([plan, section 14](../design/effects-and-sound-plan.md#14-music-battle-music-and-cutscenes-proposed-2026-10-31-details-open)).
   Agent-written story text, including existing worldbuilding and showcase text, is reference or placeholder only
   and never ships as written.
4. **Honesty:** if a store asks, answer truthfully. Recheck each store's rules before submission.

The [AI-assisted builder](owner-decision-authoring-builder-2026-10-23.md) stays, limited by this rule: it may
structure content, but shipped prose comes from a person.
