# Owner decision: Realm seams, no new single-player assumptions — 2026-10-13

Written 2026-10-13 in Claude Code by anthropic/claude-opus-5-5 (PM).

Fable's [R&D audit of 2026-10-13](../rnd/depth-and-ux-2026-10-13.md) (depth, immersion and touch UX) found the kernel single-character by
type, the clock device-fed, speech word-only and nothing instanced, and asked (section 5, item 10)
for one record of the multiplayer seams so the M12 to M15 rows stop adding single-player
assumptions. Owner's words, 2026-10-13:

> Okay i like everything in fables audit. especially the M12-m15 rows stop adding single-player assumptions because we area already there and if we dont need to do doubl ework we dont need to. PLease go with all of fables suggestions

## Effect

Every toolbox brief from M12 on pastes the [brief checklist](#brief-checklist) and answers each
line (met, or not applicable and why); the reviewer checks the answers. Each rule below is cheap,
works in the offline Story today and builds no Realm code. It does not reopen
[fixed time](owner-decision-fixed-time-2026-10-03.md),
[background time](owner-decision-background-time-2026-10-03.md),
[pre-production](owner-decision-forward-development-2026-10-05.md) (no adapters or migrations when a
seam is later cut), [offline-first](../../AGENTS.md) or
[mechanics vs numbers](owner-decision-world-parameters-2026-10-02.md) (a choice a cartridge makes
is a declared field, never an engine branch on "the player"). It applies the
[shared Story and Realm mechanics](owner-decision-story-realm-shared-mechanics-2026-10-04.md)
direction and the [puppeting rule](../archive/decisions/owner-decision-puppeting-2026-09-25.md)
("rules read the actor from the command, never the player"). Citations are at batch M11's head `6bba12d`.

## The seams

**1. Actor attribution.**
- Now: `World.character` is one `CharacterId` (`kernel/ts/src/runtime/decision.ts:126`) and `bodyOf` returns a body only for it (`:184`); 28 reads of `world.character` sit in 14 rule files (for example `mechanics/commerce/shared.ts:95`, `mechanics/movement/rule.ts:48-58`, `mechanics/bleed/job.ts:29`, `mechanics/escort/job.ts:26`, `commands/actions.ts:98-105`); `GameView.actor_id` is one actor (`kernel/ts/src/contracts.gen.ts:128`).
- Rule: a new rule reads its actor from the command's `actor_id` and its body by `bodyOf(world, actor)`; a new job stores its owning character when scheduled and never reads `world.character` when it runs; a new view field takes the actor and invents no other player's rows. New `world.character` reads are allowed only in `runtime/`, `view/` and the local authority. A row that edits a function holding an old read passes the actor through when it is in scope; no row rewrites untouched sites. The Realm seams batch (Beads loka-kgd.150, slices RS-1..RS-8, audit [realm-seams-audit-2026-10-13.md](../rnd/realm-seams-audit-2026-10-13.md)) is the named exception that retrofits those sites.
- Realm: admitting a second actor replaces the single field with the admitted set and `bodyOf` becomes a lookup ([future: Online](../system/future.md#online), R14).

**2. Reaction attribution.**
- Now: `resolvedActor` gives only `quest_resolved` its evidenced owner; every other trigger keeps the root actor, the listener (`kernel/ts/src/mechanics/reaction.ts:282`); the subject table covers ten events (`:180-191`) and a status step falls back to the actor's body (`:119`).
- Rule: a new trigger or apply step (37a `population.spawn`, 38, 39, 33's witness) names its actor from the event's declared subject (a `SUBJECT` entry plus its row in the [reaction@1 table](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts)) or the event's `actor_id`, never the listener default or `world.character`; with no subject it writes nothing, as the fact step does (`:227-230`).
- Before batch M13 (row 33), because the 37a population.spawn step takes no actor (37a review, 2026-10-13), row W1's declared-subject rule is made total: every registered trigger has a subject or a documented "the doer is the actor".
- Realm: delivery per character (player B's event reaches B's reactions), R14.

**3. Party and kill credit.**
- Now: credit goes to the encounter's character when its body, a listed ally or a G8 member made the kill (`kernel/ts/src/mechanics/combat/credit.ts:122-123`); a group is an (NPC, character) `member` pair fact with the character as leader; NPC-led groups and parties wait for the Realm ([G8](../system/mechanics.md#group-primitive-toolbox-row-g8)).
- Rule: a row that pays out for a shared act (kill, loot, XP, quest progress, wage, pet growth) names the credited character through the encounter's `credited_character_id` and G8's `member`, and its mechanics section states the credit rule in one line. A cartridge choice is a `world.group` field.
- Before row 45 (M14) and S4, the G8 section gains a "Credit contract" paragraph: the Story default (the encounter's character) and the Realm kinds named but not built (`party`: every member character; contested: first damage or last hit).
- Realm: player parties (`StateScope` `party`, `contracts.gen.ts:240`) and contested kills ([spec 19](../archive/spec/19-quest-sharing-instancing-capacity.md)).

**4. Realm-owned elapsed time.**
- Now: the kernel reads no clock (`lint/rules/ts-kernel-pure.yml`); time enters only through `stepElapsed`, which only an authority may deliver (`kernel/ts/src/runtime/world.ts:168`); the local authority computes `from`/`until` from device wall and monotonic clocks (`mobile/authority/local-story/elapsed.ts:100-127`) driven by the App's pulses (`mobile/app/App.tsx:128-148`, `:170-177`); a pause still credits the wall gap on resume (`elapsed.ts:116`).
- Rule: a new engine job or rule records no device clock and takes delays in logical clock units from the cartridge; a new host feature computes no `from`/`until` outside the authority's elapsed path and never stops world time; no row adds a skip or a time-advancing verb; a timer the player sees reads the GameView clock.
- Realm: the Realm authority issues `elapsed`; the client clock becomes display only (`mobile/authority/remote-realm/`, R14).

**5. Speech as a distinct Realm capability.**
- Now: `speech@1` takes one word of 1 to 32 ASCII letters that never reaches narration ([social verbs](../system/mechanics.md#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half)); trap 9.
- Rule: no row widens `speech@1`; a row wanting sentences, emotes or typed text shown to anyone but its writer names `speech@2` as a Realm capability and stops there. Player-typed text stays player-scoped and visible only to its writer (G10, W16).
- Realm: `speech@2`, a distinct key with a moderation seam, never a host-dependent meaning of `speech@1`.

**6. Scope and audience (GameView filtering).**
- Now: `AudiencePolicy` has `public`, `player`, `party`, `instance` and `audience_set` (`contracts.gen.ts:21`) on `EntityIdentity.audience`, but creation refuses any audience (`kernel/ts/src/foundation/creation.ts:24`); facts are player or instance (`mechanics/fact.ts:24`); quests are player-scoped (`mechanics/quest/lifecycle.ts:38`).
- Rule: a new per-player fact (knowledge, standing, wanted, recognition, entitlement, notes, pins) uses player scope, never instance, unless the row is world state (a door, a raid, a population). A once-per-world spawn or event (37a, 37b, 39, S4) states its Realm audience (`public`, `instance` or `party`) in one line of its mechanics section; the field is not written.
- Realm: the GameView filtered by `AudiencePolicy`, a view change (R14).

**7. Instancing (decision first).**
- Now: one world context per save; populations and world events are per world (37a: one bundle per cycle).
- Rule: no row builds instancing or relies on its absence; a unique thing (boss, raid, owned hut) states whether it is shared-world or per-instance in the Realm.
- Realm: an instancing decision record comes first, then the build ([spec 19](../archive/spec/19-quest-sharing-instancing-capacity.md), R14 to R22).

**8. `result_digest` in receipts.**
- Now: the receipt has no `origin_authority_id`, `semantic_command_digest`, `result_digest` or `created_at` ([DIFFERENCES row 1](../system/DIFFERENCES.md)); scheduled for [R12](../system/future.md#production-story-app).
- Rule: a row trusts no receipt or import it did not compute; carry-over (48a to 48c, M15) is Story evidence, never online authority ([offline evidence policy](../archive/spec/23-accounts-progress-admission.md#6-evidence-policy-onboarding-not-competitive-rewards)).
- Pulled forward: `result_digest` lands before the first row that trusts input from outside its authority (48b import, AI input, the Realm), in that row or a slice ahead of it; the receipt shape changes forward with no migration.
- Realm: `origin_authority_id` and `created_at` stamped by the server, never a device.

**9. Ownership transfer (G7, row 24).**
- Now: owning is a service entitlement, a Boolean player fact (`owns_hut`) that [G7](../system/mechanics.md#access-locks-toolbox-row-g7) locks read; grants are player-scoped pair facts; no transfer and no `stolen` provenance ([property](../system/mechanics.md#property-and-bank-toolbox-rows-24-and-25)). Two Realm characters could each buy the same hut.
- Rule: a new ownership row (33 theft, S1 homes, 36 jail) states whether the thing is exclusive and how ownership moves (sale, gift, theft, death, none); theft never transfers ownership (G7: a wanted player's property stays theirs); locks read the actor.
- Realm: exclusive ownership as world state on the thing, transfer, inheritance on account loss and griefing rules, recorded in the G7 section when the first Realm activity is chosen.

## Brief checklist

Paste into each brief; answer each line "met: how" or "n/a: why".

```
Realm seams (docs/decisions/owner-decision-realm-seams-2026-10-13.md): this row adds no new single-player assumption.
1. Actor: rules read the command's actor (bodyOf(world, actor)); jobs store their character; no new world.character outside runtime/, view/, local authority.
2. Reactions: each new trigger or step names its actor from the event's declared subject, never the listener default.
3. Credit: a shared payout names its credited character (encounter, G8 member) and states its credit rule in one line.
4. Time: no device clock; delays in logical units; no skip; no from/until outside the elapsed path.
5. Scope: per-player facts are player scope (instance only for world state); a once-per-world spawn or event states its Realm audience.
6. Text: speech@1 unchanged; typed text visible only to its writer; anything shared names speech@2 (Realm).
7. Ownership: exclusive or not, and how it moves; theft never transfers ownership.
8. Trust: no receipt or import trusted that this authority did not compute; a row that needs it lands result_digest first.
9. Instancing: none built, none assumed; a unique thing states shared-world or per-instance.
```

## Follow-ups (Beads, PM)

- An ast-grep rule in `lint/rules/` that freezes the current `world.character` reads in `kernel/ts/src/mechanics/` and `commands/`.
- Before batch M13 (row 33): W1's subject rule made total (37a population.spawn takes no actor, per the 37a review of 2026-10-13). Row 33's brief requires a G7 get lock on the bank vault NPC (theft would drain every account); RS-8 decides NPC schedule `when` evaluation before row 33. Before 45: the G8 credit-contract paragraph. Before 48b: `result_digest`.
- One line in [owner-rules.md](../system/owner-rules.md) under Architecture pointing here.
