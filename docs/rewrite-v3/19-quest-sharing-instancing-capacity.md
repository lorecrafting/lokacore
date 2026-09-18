# 19 — Quest Sharing, Phasing, Instancing, and Scarce World Services

**Status:** normative v3 architecture.

This document defines how Story Mode and Realm Mode represent quest progress, personal/party world differences, private instances, phased quest actors, and genuinely shared bottlenecks.

The core rule is:

> Progress ownership, world consequence scope, visibility, spatial instancing, and resource capacity are separate decisions.

Do not reduce them to one "instanced quest" flag.

## 1. Five independent dimensions

Every multiplayer quest/deployment should be explainable across these dimensions.

| Dimension | Typical values | Question answered |
|---|---|---|
| Progress scope | player / party / instance / realm | Who owns objective and lifecycle progress? |
| Consequence scope | player / party / instance / realm | Who experiences the durable world change? |
| Presence audience | all / player / party / participants / condition | Who can see or interact with an entity/presentation? |
| Spatial placement | shared world / scoped overlay / private instance | Is this the same physical simulation or a separate copy? |
| Capacity scope | unlimited / player / party / facility / instance / realm | Who competes for this scarce service/resource? |

No dimension is inferred from another.

A player-scoped quest can use a shared NPC, a shared smithy, a personal ghost, and a private dungeon in the same storyline.

## 2. Story Mode tracking

Story Mode normally has one local player inside one local world instance.

Quest progress is usually player or campaign scoped.

The same scope machinery still applies because it provides:

- deterministic save structure;
- compatibility with later online hosting;
- campaign/sequel continuity;
- reusable quest definitions;
- consistent testing.

Story Mode does not need fake multiplayer.

A local smithy can still have believable capacity, scheduled work, NPC work orders, or overnight crafting, but all authority is local.

## 3. Realm Mode progress scopes

### Player progress

Default for ordinary MMORPG narrative quests.

Each character independently owns:

- quest lifecycle;
- objective state;
- branch/outcome;
- personal facts and memories;
- reward eligibility.

The surrounding town, NPCs, shops, and services can remain shared.

### Party progress

One quest instance belongs to a party identity.

The quest declares membership semantics.

Recommended policies:

- snapshot: freeze eligible members when activated;
- dynamic_present: current eligible members participate according to objective credit rules;
- leader_owned: leader owns progression while helpers can contribute.

Reward eligibility is separate from progress eligibility.

Joining or leaving never implicitly duplicates quest state.

Party dissolution must explicitly choose preserve, abandon, leadership transfer, or a supported personal continuation.

### Instance progress

Useful when everyone in a private adventure should share one scenario state:

- dungeon puzzle;
- escape room;
- escort;
- heist;
- private boss phase.

The quest belongs to the instance and archives with it according to deployment policy.

### Realm progress

Reserved for intentional public events:

- rebuild city wall;
- defend invasion;
- world boss phase;
- festival;
- regional political change.

Realm scope is always explicit and receives shared-area certification.

## 4. Objective credit is separate from quest ownership

A world event can match an objective without every nearby player receiving credit.

Objective credit policies include:

- actor;
- party;
- participants;
- witnesses;
- scoped eligible population.

Additional rules may require:

- same zone/instance;
- distance;
- contribution threshold;
- presence/alive state;
- activation before the event;
- participation duration.

This prevents a global death/event bus from accidentally progressing every player's quest.

World-caused events must also be handled. If wolves kill the target NPC before the player arrives, the quest follows an authored failure or alternate-outcome rule rather than assuming the player caused the event.

## 5. Shared world is the default

Prefer shared-world execution whenever players can coexist without contradictory physical state.

Examples:

- shared ferryman with personal dialogue;
- shared merchant with player-specific reputation/prices;
- personal quest journal progress;
- shared city;
- shared respawning resources;
- shared smithy.

This keeps the MMORPG social and coherent.

Use more isolation only when the fiction or mechanics require it.

## 6. Scoped overlays and phasing

Use an overlay when the shared physical space is still valid but a player or party needs different presentation/entity presence.

Examples:

- only one player sees a ghost;
- a clue appears after learning a perception ability;
- a personal NPC appears during a quest;
- a party sees its own ritual circle;
- a player sees extra description text based on discovered facts.

An overlay is not another authority.

The owning WorldInstance or ZoneShard remains authoritative.

An AudiencePolicy controls who sees and may interact with overlay content.

Representative audiences:

- all;
- one player;
- one party;
- event participants;
- a typed policy condition.

### Personal quest NPC

A personal quest actor should normally be:

- hosted by the shared ZoneShard;
- player-scoped for presence/state;
- lazily materialized when the eligible player is nearby;
- absent from other players' GameViews, target search, and action resolution;
- isolated from unrelated shared collision/combat/economy by default.

Drops and consequences from a personal actor inherit safe player scope unless an explicit consequence operator escalates scope.

### Shared NPC with personal dialogue

Do not phase an NPC just because dialogue is personal.

A single shared blacksmith or ferryman may expose:

- player-specific dialogue choices;
- player-specific quest actions;
- player-specific trust/reputation;
- player-specific memories.

That is cheaper and feels more like a shared world.

## 7. GameView layering

A Realm player's semantic GameView may be composed from:

    shared realm state
      -> zone/instance state
      -> party overlay
      -> player overlay
      -> access/presentation policy
      -> GameView

Composition order is deterministic.

Developer/Lab traces must explain provenance so a builder can answer:

- why does this player see this NPC?
- why is this exit available?
- why is this dialogue choice hidden?
- which scoped fact supplied this room description?

## 8. When to create a private instance

Use a private or party instance when players need incompatible physical simulations.

Good reasons:

- puzzle resets;
- destructive environment;
- exclusive boss;
- branching geography;
- infiltration sequence;
- many private quest actors;
- tightly paced escort;
- other players would invalidate the scene.

Do not instance merely because one clue, dialogue, or NPC is personal.

Preferred escalation order:

1. shared world plus personal progress;
2. shared world plus scoped overlay;
3. private/party instance;
4. realm-shared mutation when the fiction intentionally affects everyone.

## 9. Scarce facilities are world systems, not quest state

A quest may depend on a genuinely scarce service.

Examples:

- smithy;
- healer;
- ferry;
- ritual altar;
- crafting bench;
- trainer;
- inn rooms;
- auction counter;
- rare resource node.

Scarcity belongs to a reusable Facility/Service capability.

A facility declares:

- capacity model;
- capacity scope;
- service duration;
- queue/reservation policy;
- admission requirements;
- cancellation policy;
- input/output ownership.

Capacity models may include:

- concurrent slots;
- tokens per period;
- finite stock;
- reservation windows.

Capacity scope may be:

- player;
- party;
- facility;
- instance;
- realm.

A single physical Realm smithy normally uses facility scope.

## 10. Durable WorkOrders

Long-running services create durable WorkOrders.

A WorkOrder records:

- work order ID;
- facility ID;
- requester;
- beneficiary;
- recipe/service;
- input escrow;
- submission time;
- scheduled start;
- scheduled finish;
- status;
- queue position/slot;
- scope;
- idempotency key;
- output claim/delivery policy.

Status examples:

    queued
    in_progress
    completed
    cancelled
    failed

The facility owns the queue/timer.

The quest only observes facility DomainEvents.

## 11. The one-sword-per-day smithy

Requirement:

> There is one smithy. It can forge only one sword per day. My personal quest requires a sword forged overnight.

Correct model:

- quest progress: player scoped;
- smith NPC: shared;
- smithy facility: shared;
- capacity: facility scoped;
- work order beneficiary: player;
- world space: shared;
- crafting completion: durable scheduler/domain event.

Flow:

    player invokes forge
      -> facility validates materials and admission
      -> inputs move into escrow
      -> facility atomically reserves the next legal slot
      -> WorkOrder is committed
      -> work_order_submitted event

At completion:

    scheduler
      -> facility completes WorkOrder
      -> output created/claimable
      -> work_order_completed event
      -> player's quest objective observes eligible event

The quest does not own the queue or overnight timer.

### "One per day" must be precise

Possible meanings are different:

- one sword may start per world day;
- one concurrent slot, with each sword taking one day;
- one masterwork may complete per day;
- one reservation may be accepted per day.

Content must choose one.

## 12. Shared bottleneck fairness

Realm facilities may define:

- FIFO queue;
- visible estimated start/completion;
- priority classes;
- max outstanding jobs per character/account;
- deposit or fee;
- cancellation/refund policy;
- expiration;
- material escrow;
- output claim timeout;
- offline completion notifications;
- abuse/alt policy where appropriate.

All allocation is server-authoritative and transactional.

Two players racing for the last slot cannot both receive it.

## 13. Story Mode facility behavior

The same facility capability runs locally.

A Story cartridge may model:

- overnight work;
- NPC jobs already occupying a slot;
- deterministic local queue;
- scheduled closure;
- special festival/season availability.

There is no need to fabricate real players.

If the Story time policy is real-elapsed, a work order may finish while the app is closed and reconcile on resume.

If it is play-time, it finishes only after enough logical game time advances.

## 14. Phased quest drops and actors

A personal phased NPC should not drop a realm-shared sword onto the ground by accident.

Default inheritance rules should be safe:

- player overlay actor -> player-scoped drops/consequences;
- party overlay actor -> party-scoped drops/consequences;
- instance actor -> instance-scoped drops/consequences.

Scope escalation requires an explicit registered operator and certification.

## 15. Personal access versus shared geometry

If only the player should enter a place but the map geometry is otherwise identical, prefer a shared connection with a player-scoped access policy.

Example:

    gate exists for everyone
    player A has temple.invited = true
    player A sees "Enter Inner Court"
    player B does not

If the destination itself contains contradictory/destroyed/private world state, use a private instance instead.

Map discovery is separate again: a player may not see a known location on the map even if it physically exists.

## 16. Party resources and rewards

Progress, contribution, reward, and ownership are distinct policies.

Example party objective:

    progress_credit: present_party_members
    reward_credit: members_present_at_completion
    unique_drop_owner: roll

Example party facility job:

    requester: party
    beneficiary: designated_member
    materials: party escrow
    output_owner: designated_member

A late joiner does not automatically inherit full contribution/reward unless the quest says so.

## 17. Builder guidance

Builder target story, realm, or promote should ask enough questions to infer the least-isolated correct model.

For a new quest it should be able to ask/derive:

- Who owns progress?
- Who should observe the consequence?
- Does everyone see the NPC?
- Can two players hold contradictory physical state in the same room?
- Is this a personal presentation difference or a true separate simulation?
- Is the resource intentionally scarce?
- Who competes for it?
- How are party membership/rewards handled?
- Is a Realm-wide change actually intended?

The Builder should prefer shared state plus scoped progress/overlays before proposing an instance.

## 18. Certification requirements

Certification must include scenarios relevant to the chosen sharing model.

For overlays/phasing:

- hidden entity never appears to ineligible players;
- target search cannot reach it;
- drops/effects do not leak scope;
- lazy materialization/cleanup preserves durable state.

For party quests:

- join/leave/dissolution semantics;
- duplicate rewards;
- contribution policy;
- party split/reconnect.

For facilities:

- simultaneous submissions;
- slot exhaustion;
- queue ordering;
- cancellation;
- crash/restart;
- scheduler retry;
- escrow integrity;
- duplicate completion;
- offline resume where portable.

For instances:

- creation/admission;
- reconnect;
- party membership;
- teardown;
- persistent rewards/state handoff.

For realm events:

- explicit broad scope;
- concurrency/load;
- late join;
- rollback/recovery.

## 19. Selection table

| Situation | Preferred model |
|---|---|
| Same NPC, personal dialogue/progress | shared NPC + player quest/relationship |
| Quest-only apparition | player overlay |
| Party-only escort actor | party overlay |
| Personal door permission | shared connection + player policy |
| Contradictory/destroyed geometry | private/party instance |
| Exclusive boss or reset puzzle | private/party instance |
| Public world boss | realm-shared state |
| One physical smithy with queue | shared facility |
| Story smithy overnight crafting | local facility |
| Personal phased-NPC loot | player-scoped drop |
| Shared scarce resource | shared facility/entity with atomic contention |

This flexibility is intentional. A living MUD needs both private narrative and genuinely shared scarcity.
