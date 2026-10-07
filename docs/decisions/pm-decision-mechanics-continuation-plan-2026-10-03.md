# PM adoption: M mechanics continuation — 2026-10-03

## Authority and provenance

The owner’s [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md) authorizes the PM to decide policies, add mechanics, use advisers and continue reviewed delivery. The owner additionally requested:

> ok yes please make more mechanic slices beyond M1-M.. so we have more in the queue, and continue with the queue. I will be away from keyboard now

The root PM adopts the [M1–M23 queue](../NEXT-MECHANICS.md), informed by actual `gpt-6-astra` core and expanded chapter-mechanics planning advice. Advice examined composed source `0e49963f893192d193fac65851aa882be0f597b8`, active feature/applicability maps and linked archived chapter plans. It is advice, not independent code approval. These are PM choices under delegation, not invented exact owner preferences. Individual implementations amend active specs first, undergo independent review and required checks, and merge with records. No runtime or installed contract changes in this planning decision.

## Clock and interaction policy

- New elapsed cartridges declare a rate; the initial sampler adopts **50 logical seconds per real second**, starts at **18:00**, and schedules Bram at the landing by day and the Drowned Lantern from **19:00 to 06:00**. Both rooms exist. This simplified sampler omits the later boathouse block and preserves the frozen stationary Lantern proof. The first move occurs after 72 real seconds.
- Active execution uses monotonic integer milliseconds; resume after suspension/termination trusts local OS wall milliseconds offline. Forward gaps count; negative gaps credit zero **and rebase** the anchor, without logical rewind. Preserve fractional remainder; never silently cap or discard absence. No background-execution or network-time service.
- Pure rules receive authority elapsed evidence through a distinct trusted entry, never read clocks. Player invocation, ActionSet, aliases and cartridge actions cannot construct elapsed commands. Menus, dialogue and modal scenes continue world time; modal player admission remains Continue-only.
- Persist anchor, remainder and outstanding fixed horizon/debt atomically with changed rows and receipts. Replay precedes sampling; rollback preserves durable evidence; uncertain COMMIT fences elapsed and input. A replacement save run invalidates old callbacks: the narrow authority entry requires captured `expected_run_id`, matches the current durable run before receipt lookup, and preserves receipt-before-freshness within that matched run. Stale old-run delivery refuses without a receipt or state change. Proposed elapsed command identity includes `run_id` alongside world context and logical interval; its final tuple, refusal kind and known-answer vectors freeze in M1-A. This is durable save identity, not authority placement/session; add no `World.run_id` field or portable whole-state hash change. Upgrade initializes an anchor without fabricated earlier credit.
- Settle each fixed horizon at earliest due boundaries in existing `(due_time, job_id)` order. Yield after **16 commits** as an engine safety budget, retaining debt; do not continuously resample, skip recurrence, grow one transaction or copy the whole world. Existing proposal budgets remain.
- Check input freshness at enqueue after receipt lookup, settle one fixed prerequisite horizon, then revalidate the same action/targets. Its own prerequisite commits cannot manufacture stale_view; previously stale input still refuses. Departed NPC choices refuse honestly and remain closable.
- New elapsed profiles reject nonzero-duration recipes and all player Wait routes/aliases. Frozen legacy play-time fixtures retain existing duration semantics. A real timed occupation needs its own consumer and reviewed contract. M1-C explicitly owns W5/W6/W8/W19/W20 follow-on; W3/W4/W16 require explicit elapsed/no-skip dispositions, and M2 owns position recovery. No premature DONE claim.

## First encounter and safety policy

M4 selects the minimum real Maud-cellar rat contract, conditional RNG and equal-time damage/death ordering; no unadopted LegendMUD equation. M5 must provide a real persistent owned corpse and reachable shrine before M6 live lethality, including recoverable background death. Preserve story progress and recoverable possessions; no ghost walk or permanent-loss punishment. Content declares restoration amounts and combat numbers.

Mandatory noninterruptible reading is authored in safe contexts before engagement. After engagement ordinary menus grant no immunity and must leave usable response/escape controls. Unsafe scenes require an explicit interruption/resumption contract before their content. First M1 schedule introduces no harm or deadline. Functional touch interaction belongs to its mechanic; [cosmetic blur/phone proof carries](owner-decision-c1-gate-ui-deferral-2026-10-03.md) remain deferred.

## Expanded chapter policies

- Deliver real story segments: village/useful actions → search/return → living village/night → bell/three endings. Prioritize Q1 sequence, Q2 all/any/branch/event credit and Wren escort. M22-A adds only concrete consequence routing before M20-A; basic quests precede their scene consumers, avoiding a quest/scene cycle.
- Q2 lost is terminal: ringing before accepted reach-Wren resolves lost; dawn checks terminal Q2 plus completed Q3. Equal-time reach/ring follows explicit command/event order. Rescued/stays/lost each gets distinct reactions; bell allegiance varies within an ending.
- S2 advertises on-time delivery through **day 2, 18:00**, late through **day 3, 18:00**, then expires to never; offers after expiry are unavailable. This late window is a new PM content amendment to implement, not a claim about existing prose. Required restricted reading cannot trap the player through expiry. S27 voluntarily opts into fen overnight; leaving fails the attempt and death resets it without erasing other quests.
- Wren follows successful legal movement without teleporting through barriers; separation stays recoverable through offered rejoin. Escort completes with Wren at Elspeth’s cottage. Tobin’s four patrol legs each require player co-location; replay cannot duplicate credit. His death selects an authored failure/alternate Bram resolution.
- Tracks, hidden connections and dark-hollow alternatives require authoritative perception/admission shared with projection. M9/M20 add the minimal discovery contract at actual consumers; current adjacent sight does not silently become long-range scan.
- Place the first artifact’s five finite nonrespawning S1 rats in lantern_cellar so its five local kills are achievable. Herb harvest nodes remain resource nodes, not animal population machinery. All fuel, tide, mass/capacity, population, trust, price, skill/status and deadline values belong to content.
- S4 grants ward knowledge and fen.wisp_answered, never a chapter-one light spell. Hunger/thirst reduce recovery and do not kill. Ash/Hale uses the accepted 19:00 cloister overlap. No XP/levels, magic, ghost companions, weather, housing, escrow or crafting prerequisite without an actual chapter consumer.

## Delivery boundaries

Groups are official **planned** work, not completed features or promised single PRs. PM selects a concrete letter brief and independent literal oracles before code. Shared protocol/registry/generated outputs, foundation twins, proposal/admission and GameView integration serialize; scratch planning and frozen-schema content may run in parallel. Existing [C1 carries](../ROADMAP.md#c1-carry-checkpoints) retain their own triggers.

The [M1-A brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/m1-a-clock.md) is the first concrete developer assignment once its merged baseline is pinned. Its final schemas/ID vectors belong in that implementation PR. Cosmetic polish, simulator automation and owner save resets are outside this adoption.
