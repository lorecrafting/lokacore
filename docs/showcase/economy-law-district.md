# Showcase plan 5: the economy and law district

District brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg.19`),
written by Fable for an Opus developer and an Opus reviewer. Base: `main` after
[plan 4](homestead-district.md) merges ([build order](homestead-district.md#build-order-for-plans-4-to-7)).
Only installed mechanics: rows G7 (locks), 24 (property and bank), W11 (stock prices), 20a and 20b
(escrow, claim and cancel), 19b (replenish), 33 (theft, fence, wanted), 16 (sneak), G11
(disposition) and the commerce already in the engine. Not built and not planned: trial and jail
(rows 35, 36 `todo`), so "wanted" ends by content: a fine paid at the counting house. Every shape
has a sampler precedent, cited per item; a step that needs engine code is a
[toolbox finding](#toolbox-findings).

Conventions as in [plan 1](hub-and-first-districts.md). No room here is `exposed` and nothing reads
the sky; the two timed things (the shelf's restock and the smith's order) run on hour marks.

## Link from the hub

`crossroads_inn` gains `down` to `undercroft`; the hub sign gains the sentence in
[plan 4's table](homestead-district.md#the-hub-has-two-faces-left) and, as this slice builds before
plan 6, the rewritten first sentence given there (it names plan 6's ladder too; it reads true once
both are built, and plan 6's slice checks it). The hub pin's exit count rises by one.

## Manifest changes

- Capabilities: add `service` (bank, strongroom, smith) if plan 4 has not; nothing else new.
- `world.theft {skill: stealth, attribute: alertness, stolen: stolen, noticed: theft_seen,
  narration: {seen, unseen}}` (`theft_sampler/cartridge.json`).
- Skill `stealth` (growth `[1]`, not hidden); NPC attribute `alertness` (`npc_attr_sampler`).
- Status `hidden`: `concealment: hidden`, `pierced_by {skill: stealth, attribute: alertness}`,
  duration 3600 (`theft_sampler/statuses/hidden.json`).
- Facts: `stolen` (instance bool, `per_subject`), `wanted` (player bool), `savings` (player int
  0..100), `owns_strongroom` (player bool), `ordered_knife` (player bool, the smith's entitlement)
  (`theft_sampler/facts.json`, `property_sampler`, `escrow_sampler`). `wanted` is player-scoped as
  [seam 6](../decisions/owner-decision-realm-seams-2026-10-13.md#the-seams) asks.
- Replenish `shelf {items: [candle_01..05], from: crate, to: chandler, cap: 3, count: 1, every:
  3600}` (`replenish_sampler`; the crate sits in the sealed `storeroom`).
- `world.levelling.kills`: none; nobody here can be killed (below).

## Rooms and map

Sealed: `storeroom` (the crate with `candle_04`, `candle_05`), `forge_back` (escrow custody, holding
`knife_01` until claimed).

| Room | Exits | Holds |
|---|---|---|
| `undercroft` (sign) | up `crossroads_inn`, north `market_row`, east `counting_house`, west `pawn_alley`, south `strongroom` through barrier `strongroom_door` (`initial: locked`, `key_item: strongroom_key`), down `vault_yard` | detail `sign_law` |
| `market_row` | south `undercroft`, north `forge_stall` | **the chandler** (shop; holds `candle_01..03`; `alertness` 2); **the merchant** (holds `purse`; `alertness` 0); **the guard** (`alertness` 1); **clerk B** (the second counter) |
| `forge_stall` | south `market_row` | **the smith**; `ore_01..04` on the floor |
| `counting_house` | west `undercroft` | **clerk A**; **the vault** (an NPC with `pennies` 20 and `locks.get` that always refuses, `theft_sampler/npcs/vault.json`); `strongroom_key` (`locks.get fact_compare owns_strongroom true`) |
| `pawn_alley` | east `undercroft` | **the fence** (`pennies` 6; `locks.get` always refuses); detail `barrels` (rating 0; recipe `hide`) |
| `strongroom` | north `undercroft` through `strongroom_door`; `locks.enter fact_compare owns_strongroom true` | `strongroom_chest` (container; `locks.get` and `locks.put` on `owns_strongroom`) |
| `vault_yard` (sandbox) | up `undercroft` | **the mark** (holds `yard_purse`, alertness 0); **the watchman** (alertness 1, hostile on `wanted`, chance 0); detail `yard_barrels` (hide); `hoard_chest` (get and put on `owns_strongroom`); `yard_crate` holding `yard_candle_01..02` with a shelf job to a **yard chandler** (cap 1) |

### Signpost (`sign_law`, readable in `undercroft`)

> The Undercroft. North, the market: the chandler's candles cost more as her shelf empties and
> she restocks on the hour; the merchant beside her carries a purse and does not watch it, but the
> guard watches him. Lift the purse in his sight and the guard will stop you at the door of this
> market until you pay the counting house its fine; hide behind the barrels in the alley first and
> nobody sees. The fence in the alley buys what was lifted and nothing honest, and keeps a hand on
> what he buys. The smith north of the market takes two ore and three pennies now and hands you the
> knife an hour later, or your ore back for a penny if you change your mind. The counting house
> east keeps savings you can draw at either counter for a penny each way, and sells the strongroom
> south of this sign: its key, its door and its chest open to the owner alone. The yard below has a
> purse, a watchman, barrels and a chest for trying it all again.

### NPCs, services, recipes, reactions

- **The chandler**: offer `{item: candle, buy: 5, sell: 1, stock {items: [candle_01..05], buy: [5,
  3, 2]}}` (`prices_sampler`: the price is the table entry for the units she holds, bounded by its
  last entry); no `buy_discount`; `resource_starts.pennies` 20; `attributes {alertness: 2}` (a
  candle lifted from her Held list is seen unless the thief's stealth beats 2).
- **The merchant**: no shop; holds `purse`; `alertness` 0.
- **The guard**: `attributes {alertness: 1}`; `disposition.hostile fact_compare wanted equals true`,
  `engage` line (he bars the market door; no judgment of the player, plan 3 finding 4); `attack
  {chance: 0, 1..1}`; `resistances {physical: 100}` (the Warden's shape: a sword hit is a hit for
  no loss, nobody here dies). `hp` 0..5.
- **The fence** (`theft_sampler/npcs/fence.json`): offers `{item: purse, buy: 6, sell: 3, stolen:
  true}`, `{item: candle, buy: 4, sell: 2, stolen: true}`, `{item: yard_purse, buy: 6, sell: 3,
  stolen: true}`; `pennies` 6; `locks.get` always refuses (no re-lifting what he bought: the loop
  below).
- **The smith** (`escrow_sampler`): service `commission` price 3 `{entitlement: ordered_knife,
  escrow {items: [ore_01..04], quantity: 2, custody: forge_back, ready_after: 3600, output:
  knife_01}}`; `claim` price 1; `cancel` price 1.
- **Clerk A** and **clerk B** (`property_sampler`): each `deposit` 5 fee 1 and `withdraw` 5 fee 1 on
  account `savings` into the vault; clerk A also `buy_strongroom` price 5 `{entitlement:
  owns_strongroom}` and the dialogue `clerk_fine` (policy `fact_compare wanted true`; one choice
  `pay` with `lesson_payment` 3 pennies, sequence `fact.assign wanted false`; the D1 fee shape).
- Theft: `reactions/theft_seen.json` `on {event: custom_event, custom: theft_seen}` `apply
  fact.assign wanted true` (`theft_sampler`). The Book's Take on a living NPC's Held list is the
  steal ([row 33](../system/mechanics.md#theft-fence-and-witnessed-offense-toolbox-rows-33-and-34)).
- Sneak: recipe `hide` at `barrels` (check `{kind: opposed, skill: stealth}` against rating 0,
  success `status.apply hidden`; `sneak_sampler`); `yard_hide` at `yard_barrels`.

## Guided loop and expected outcomes

Any day; fresh world at 07:00 day 1, pennies 10. T is the clock of the commission in step 4.

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | Down; read `sign_law`; south. | The text; south is `exit_locked` (the door) and Unlock is not offered (no key held); the Exits list six. | locks x barriers |
| 2 | East: `deposit` at clerk A; Take `strongroom_key`; `buy_strongroom`. | Pennies 4, `savings` 5, the vault 25, clerk A 1 (the property sampler's books). The key: `permission_denied`. The strongroom at 4 pennies: `insufficient_resource`. | bank x fees x locks |
| 3 | West, north: `withdraw` at clerk B; `withdraw` again; Buy a candle. | Pennies 8, `savings` 0, vault 20, clerk B 1; the second withdraw `service.no_funds`, nothing moves. The candle's price reads 2 with three on the shelf; bought: pennies 6, she holds two, the price reads 3; a stale buy at 2 is `invalid_state`. | stock prices x commerce; bank x two counters |
| 4 | North: take two ore; `commission`; `claim`; `commission` again. | Pennies 3, smith 3, `ordered_knife` true, both ore in `forge_back`, none held (the other two stay on the floor); `claim` at once: `service.not_ready`; a second commission: `invalid_state`. | escrow x custody |
| 5 | Wait to T + 3600 (past 08:00); `claim`. Back south. | At 08:00 the shelf job moved `candle_04` to the chandler: three held, price 2, the crate holds one. Claim: pennies 2, smith 4, `knife_01` held, `ordered_knife` false. Branch: `cancel` before T + 3600: pennies 2, both ore back in hand, the knife still in `forge_back`, `ordered_knife` false. | replenish x stock prices; timed claim x cancel |
| 6 | Alley: `hide`; then market: Take the purse from the merchant. | `check_passed`, `hidden` on the Conditions line, `stealth` uses 1. The Take: the purse held, `stolen` true on it, line `theft.unseen`, `wanted` false, kinds `item_acquired`, `fact_changed stolen`, `fact_changed uses_stealth` and nothing more; the guard stays as he was. | sneak x theft x witness |
| 7 | Alley: Sell the purse to the fence; Take it back; Sell the clean candle to the fence; Sell the candle to the chandler. | Pennies 5, the fence holds the purse (`stolen` stays true); the Take: `permission_denied`; the candle to the fence: `invalid_state` (clean); to the chandler: pennies 6, she holds four and the price reads 2 (the table is bounded by its last entry; the build pins W11's clamp). | fence x stolen provenance x get lock |
| 8 | Counting house: `buy_strongroom`; Take the key; south from the undercroft: Unlock, Open, south; Put the knife in the chest; Take it; Close and Lock from inside. | Pennies 1, `owns_strongroom` true, the key held; Unlock and Open accepted, the room entered; Put and Take accepted; the door locked again behind. A fresh world without the purchase: the key `permission_denied`, the door `exit_locked`, and a forged move south with the door open is `permission_denied` (the enter lock, checked after the barrier). | property x locks x key barrier |
| 9 | Branch from step 5 (pennies 2, not hidden): Take the purse beside the guard; leave south and come back north; Flee; alley: Sell the purse; counting house: `pay`; north again. | Line `theft.seen`, kinds end `custom_event theft_seen` (subject the thief), `fact_changed wanted`; `wanted` true. Re-entering the market: `engage` opens an encounter (G11); his blow is chance 0; Flee leaves by south or north (two candidates). The fence pays 3 (pennies 5). `clerk_fine` opens only while wanted; `pay`: pennies 2, `wanted` false; the market again: no engage, the guard's room line is the base. | theft x wanted x disposition x fine |
| 10 | Any state: Take a candle from the chandler's Held list, unhidden. | Seen (alertness 2 beats stealth 0 or 1): `wanted` true, the candle held with `stolen` true; the chandler's shelf shows two and the price 3; the fence buys it at 2. | theft x stock prices |

Sandbox `vault_yard`: a purse to lift in the watchman's sight or from behind the barrels, a fine to
pay for, a chest only a strongroom owner opens, and a one-candle shelf that refills from its crate
on the hour.

## Item loops

Pennies: sources are the withdraw (what was deposited, minus fees), the fence (6 pennies in his
purse, never refilled: two purses or three candles ever), and the chandler buying her candles
back at 1; sinks are buys, four service fees, the fine, the strongroom and the commission. Candles:
five authored, moved by the shelf job (cap 3 on her), never created. Purses: one each in the
market and the yard. Ore: four; two leave for the knife (one knife per world: a second commission
after the claim refuses `service.no_output`, [20b](../system/mechanics.md#timed-job-claim-and-cancel-toolbox-row-20b)).
The fence's `get` lock is the cap on the lift-sell loop; the build's red control removes it and
watches the purse sell twice.

## Realm checklist

Per-player: `wanted`, `savings`, `owns_strongroom`, `ordered_knife`, the skill, `hidden`.
Shared-world: `stolen` on an item (instance, per subject: a thing is stolen for everyone), the
chandler's shelf and prices (one shelf, one price), the ore and the knife (one per world), the
strongroom (an entitlement, so two Realm characters could both "own" it: seam 9's known gap,
stated). Theft never moves ownership (G7). Delays are logical units (3600 for the shelf and the
order); no device clock.

## Pins the build writes

- `kernel/ts/test/showcase_law.test.ts` law 1 to 10 as above: the books after each bank step
  (player, vault, clerk A, clerk B, `savings`), `service.no_funds`; the price table 2, 3 and the
  stale quote; the escrow custody, `service.not_ready`, the cancel; the shelf refill at 08:00;
  the unseen kinds list and the seen one; `permission_denied` on the fence's purse and on the
  key; `exit_locked` then the enter lock with the door forced open; the fine's `wanted` flip; the
  red control (fence lock removed, the purse sold twice).
- `protocol/fixtures/toolbox_showcase_hash.json`; `showcase_body.test.ts`'s hub exit count.
- Book e2e `mobile/app/tests/showcase_law.e2e.ts`, the happy path at phone width: Deposit and
  Withdraw offers (fee labels), Buy 2p, the Commission, Claim after the dev clock's hour, Hide
  (a place action card), Take from the merchant's Held list, Sell 3p to the fence, Buy the
  strongroom, Take the key, Unlock, Open, south, Put, Take. Lock and Unlock are Book cards on a
  barrier the key opens (plan 1's `tollhouse` loop has none: the build confirms the card exists
  and files a polish Bead if not; kernel pins stand either way).

## Blind AI playtest focus

Does the price change read as the shelf, not a bug? Does the player work out that the barrels
hide them before the lift, from the sign alone? Is "wanted" visible in the world (the guard at the
door) without a Journal line saying so? Does the fine read as a way out, not a punishment screen?
Is it clear why the fence will not buy the candle?

## Matrix cells this plan adds

Rows in [SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix), all `planned (plan 5)`: stock
prices x replenish x commerce; escrow x timed claim x cancel; bank x two counters x fees;
property x locks x key barrier; theft x sneak x witness x wanted x disposition; fence x stolen
provenance x get lock.

## Toolbox findings

1. **Wanted has no engine exit** (rows 35 and 36 `todo`): the fine is a dialogue payment that
   assigns the fact. When jail lands, the guard's engage should relocate the body instead; this
   plan's guard is the detour until then.
2. **A hostile NPC who must not die** needs `resistances {physical: 100}` plus chance 0, as the
   Warden; there is no "cannot be attacked" flag short of removing `attack`, which also removes
   engage. A `disposition` that engages without a fight (a stop, not a brawl) is the row to file
   if the owner wants the guard to arrest rather than square up.
3. **The Book's Lock and Unlock cards** are unconfirmed in the docs (`book-ui.md` names neither);
   the e2e settles it.
