# Core Systems: Economy & Trading — Proposal

> **Status**: Proposal (not yet implemented)
> **Priority**: Core System (Tier 2 — after Player Housing)
> **Last Updated**: 2026-02-10
> **Depends On**: Entity Ownership (Tier 1), Cooldowns (Tier 0)

## Problem Statement

Loka's economy is NPC-only. Players can buy/sell from shops but cannot:
- Trade with each other
- Craft unique items (all iron swords are identical)
- Run player shops
- Participate in a dynamic marketplace

For player towns and a living world, the economy must be player-driven. Items need identity (who made it, how good is it). Supply and demand should matter. Players need reasons to interact economically.

## Proposed Solution

Four subsystems:

```
Item Quality & Modifiers (differentiation)
  ↓
Player-to-Player Trading (exchange)
  ↓
Marketplace / Auction (asynchronous exchange)
  ↓
Economy Feedback Loops (dynamic pricing)
```

---

## Design Details

### 1. Item Quality & Modifiers

Make each crafted item unique through quality tiers and random modifiers.

**Quality tiers**:

| Tier | Probability (base) | Stat Multiplier | Display |
|------|-------------------|-----------------|---------|
| Poor | 15% | 0.8x | (Poor) |
| Common | 50% | 1.0x | (no prefix) |
| Fine | 25% | 1.15x | (Fine) |
| Masterwork | 8% | 1.3x | (Masterwork) |
| Legendary | 2% | 1.5x | (Legendary) |

Quality roll formula: `base_chance + (player_skill * 0.5) + (station_bonus * 0.2) + (material_quality * 0.3)`

Higher skill shifts the distribution upward. A master smith (skill 100) rarely makes Poor items.

**Modifier system**:

Each recipe defines a `modifier_pool` — possible random bonuses:
```yaml
key: recipe_iron_sword
# ... existing fields ...
modifier_pool:
  - stat: damage
    op: add
    range: [1, 5]
    weight: 40
  - stat: speed
    op: add
    range: [-1, 2]
    weight: 30
  - stat: durability
    op: multiply
    range: [0.9, 1.3]
    weight: 20
  - stat: crit_chance
    op: add
    range: [1, 3]
    weight: 10
max_modifiers:
  poor: 0
  common: 1
  fine: 2
  masterwork: 3
  legendary: 4
```

**Item metadata** (stored in entity):
```elixir
metadata: %{
  "quality" => "fine",
  "modifiers" => [
    %{"stat" => "damage", "op" => "add", "value" => 3},
    %{"stat" => "speed", "op" => "add", "value" => 1}
  ],
  "crafter_id" => "player_abc123",
  "crafter_name" => "Bob the Smith",
  "crafted_at" => "2026-02-10T15:30:00Z",
  "craft_count" => 47  # Bob's 47th iron sword
}
```

**Display**: Items show quality and modifiers:
```
(Fine) Iron Sword [+3 damage, +1 speed]
Crafted by Bob the Smith (#47)
```

**Module**: `Loka.Framework.Crafting.Quality`
```elixir
def roll_quality(recipe, player_skill, station_bonus, material_quality) -> quality_tier
def roll_modifiers(recipe, quality_tier) -> [modifier]
def apply_modifiers(entity, modifiers) -> entity
def format_item_name(entity) -> String.t()  # "(Fine) Iron Sword [+3 damage]"
def compare_items(item_a, item_b) -> :better | :worse | :equal
```

### 2. Player-to-Player Trading

Synchronous trade between two players in the same room.

**New module**: `Loka.Framework.Economy.Trading`

**Trade state** (ETS-backed, ephemeral):
```elixir
%Trade{
  id: binary_id,
  player_a: %{id: id, items: [item_id], currency: %{"gold" => 100}},
  player_b: %{id: id, items: [item_id], currency: %{"gold" => 0}},
  confirmed_a: false,
  confirmed_b: false,
  state: :negotiating,  # :negotiating | :confirmed | :executed | :cancelled
  created_at: DateTime.t(),
  expires_at: DateTime.t()  # auto-cancel after 5 minutes
}
```

**API**:
```elixir
defmodule Loka.Framework.Economy.Trading do
  def initiate(player_a_id, player_b_id) ->
    {:ok, trade_id} | {:error, :not_in_same_room | :already_trading | :self_trade}

  def offer_item(trade_id, player_id, item_id) ->
    {:ok, trade} | {:error, :not_participant | :item_not_owned}

  def remove_item(trade_id, player_id, item_id) ->
    {:ok, trade} | {:error, reason}

  def offer_currency(trade_id, player_id, currency, amount) ->
    {:ok, trade} | {:error, :insufficient_funds}

  def confirm(trade_id, player_id) ->
    {:ok, trade} | {:error, reason}
    # If both confirmed → auto-execute

  def cancel(trade_id, player_id) ->
    {:ok, :cancelled}

  # Internal — atomic swap
  defp execute(trade) ->
    # 1. Verify all items still exist and are owned by offerers
    # 2. Verify currency balances
    # 3. Transfer items (update owner_id)
    # 4. Transfer currency
    # 5. Log to audit trail
    # All in a DB transaction
end
```

**Commands**:
```
trade <player>              → Initiate trade
offer <item>                → Add item to trade
offer <amount> gold         → Add currency
remove <item>               → Remove item from trade
confirm                     → Confirm your side
cancel                      → Cancel trade
```

**Safety**:
- Both players must confirm AFTER all items are shown
- If either player modifies the offer after confirmation, both confirmations reset
- Trade window expires after 5 minutes
- Items are "locked" during trade (can't drop/use/trade elsewhere)
- Atomic execution — if any step fails, entire trade rolls back

### 3. Marketplace / Auction

Asynchronous trading — list items for sale, others browse and buy.

**Schema**: `market_listings` table
```elixir
schema "market_listings" do
  field :seller_id, :binary_id
  field :item_id, :binary_id       # the actual entity
  field :item_snapshot, Loka.Ecto.Json  # cached name, quality, modifiers for search
  field :price, :integer
  field :currency, :string, default: "gold"
  field :category, :string          # weapon, armor, material, furniture, etc.
  field :status, :string, default: "active"  # active, sold, expired, cancelled
  field :buyer_id, :binary_id       # set on purchase
  field :listed_at, :utc_datetime
  field :expires_at, :utc_datetime
  field :sold_at, :utc_datetime
  timestamps()
end
```

**API**: `Loka.Framework.Economy.Marketplace`
```elixir
def list_item(seller_id, item_id, price: price, currency: currency, duration: seconds) ->
  {:ok, listing} | {:error, :not_owned | :already_listed | :max_listings}

def search(filters) -> [listing]
  # filters: %{category: "weapon", quality: "fine", max_price: 1000, sort: :price_asc}

def buy(buyer_id, listing_id) ->
  {:ok, item_id} | {:error, :insufficient_funds | :already_sold | :expired}

def cancel(seller_id, listing_id) ->
  {:ok, :cancelled}

def get_my_listings(player_id) -> [listing]
def get_my_purchases(player_id) -> [listing]

# Expired listing cleanup (scheduled task)
def sweep_expired() -> {expired_count, returned_items}
```

**Rules**:
- Max 10 active listings per player (upgradeable with skill/reputation)
- Listing fee: 5% of asking price (gold sink)
- Items are removed from inventory while listed (escrow)
- If listing expires, item returns to seller's inventory
- Buyer pays full price, seller receives price minus listing fee
- Item snapshot cached at listing time for search performance

**Marketplace NPC or board**:
```yaml
# An NPC or room item that provides marketplace access
key: market_board
name: "Market Board"
description: "A large wooden board covered in trade listings."
scripts:
  on_use: marketplace_browse  # opens marketplace UI
tags: [marketplace, interactive]
```

**Commands**:
```
market list <item> <price>   → List item for sale
market search <query>        → Search listings
market buy <listing_id>      → Purchase item
market cancel <listing_id>   → Cancel your listing
market status                → Your active listings
```

### 4. Economy Feedback Loops

Dynamic pricing based on supply and demand.

**New module**: `Loka.Framework.Economy.MarketDynamics`

**Supply/demand tracking** (ETS + periodic DB snapshots):
```elixir
# Track events
def record_event(item_key, event_type, quantity)
  # event_type: :gathered, :crafted, :consumed, :sold, :purchased, :destroyed

# Calculate dynamic price
def market_price(item_key) ->
  base_price = TypedObject.get(item_key).data["base_price"]
  supply_factor = calculate_supply_factor(item_key)  # 0.5 to 2.0
  demand_factor = calculate_demand_factor(item_key)  # 0.5 to 2.0
  round(base_price * supply_factor * demand_factor)
```

**Supply factor**: Based on how much of an item enters the economy vs historical average.
- Lots gathered/crafted → supply up → price down
- Rare drops → supply low → price up

**Demand factor**: Based on how much is consumed/purchased.
- Healing potions during a raid event → demand up → price up
- Nobody buying iron swords → demand low → price down

**NPC shop integration**:
```elixir
# NPC shops use dynamic pricing
def npc_buy_price(item_key, shop) do
  base = market_price(item_key)
  round(base * shop.buy_multiplier)  # shops buy below market
end

def npc_sell_price(item_key, shop) do
  base = market_price(item_key)
  round(base * shop.sell_multiplier)  # shops sell above market
end
```

**Price history** (for player information):
```elixir
def price_history(item_key, days: 7) -> [%{date: date, avg_price: integer}]
```

**Regional pricing**: Different zones can have different supply/demand. Iron is cheap near mines, expensive in remote areas.

---

## Integration Points

| System | Integration |
|--------|------------|
| **Crafting** | Quality rolls on successful craft, modifier application |
| **Inventory** | Item locking during trades, escrow for marketplace |
| **Entity Ownership** | Transfer on trade/purchase, crafter_id on craft |
| **Locks** | Market board access, shop permissions |
| **Skills** | Crafting skill affects quality distribution |
| **PubSub** | `trade:{id}` for real-time trade updates, `market:sold` for notifications |
| **Timers** | Marketplace listing expiry |
| **Audit Trail** | All trades and marketplace transactions logged |

## Data Flow

```
Crafting                    Trading                 Marketplace
   │                          │                        │
   ├─ Quality.roll()          ├─ initiate()           ├─ list_item()
   ├─ Modifiers.roll()        ├─ offer_item()         ├─ search()
   ├─ set_owner(crafter)      ├─ confirm()            ├─ buy()
   │                          ├─ execute()             │
   │                          │   ├─ transfer items    │   ├─ transfer item
   │                          │   ├─ transfer currency │   ├─ transfer currency
   │                          │   └─ audit log         │   └─ audit log
   │                          │                        │
   └──────────────────────────┴────────────────────────┘
                              │
                     MarketDynamics
                     ├─ record_event()
                     ├─ supply_factor()
                     ├─ demand_factor()
                     └─ market_price()
```

## Implementation Phases

### Phase 1: Item Quality (2-3 days)
- [ ] Quality module (roll, apply, format)
- [ ] Modifier system (pools, rolling, application)
- [ ] Extend crafting to use quality/modifiers
- [ ] Item display shows quality and modifiers
- [ ] Crafter attribution in metadata
- [ ] Tests

### Phase 2: Player Trading (3-4 days)
- [ ] Trade module (ETS state machine)
- [ ] Trade commands in CommandParser
- [ ] Trade UI in game_channel (show offers, confirmations)
- [ ] Atomic execution with rollback
- [ ] Item locking during trade
- [ ] Audit logging
- [ ] Tests

### Phase 3: Marketplace (4-5 days)
- [ ] Market listings schema + migration
- [ ] Marketplace module (list, search, buy, cancel)
- [ ] Listing fee + escrow
- [ ] Expiry sweep (scheduled task)
- [ ] Market commands in CommandParser
- [ ] Marketplace NPC/board interaction
- [ ] Tests

### Phase 4: Dynamic Pricing (2-3 days)
- [ ] MarketDynamics module (supply/demand tracking)
- [ ] NPC shop price integration
- [ ] Price history tracking
- [ ] Regional price variation (per-zone)
- [ ] Tests

## Open Questions

1. **Listing fees**: Flat fee or percentage? Should fees go to a "treasury" (gold sink) or to the housing district?
2. **Trade scam prevention**: Should there be a "review period" after both confirm before execution?
3. **Cross-region trading**: Can players in different zones trade? Or only same room?
4. **Player shops**: Should players be able to set up shop NPCs in their houses? (Huge feature, maybe Phase 5)
5. **Currency types**: Just gold? Or multiple currencies (gold, tokens, faction currency)?
6. **Tax on marketplace sales**: A percentage that goes to the town treasury? Enables player governance.
7. **Price manipulation**: How to prevent cornering the market? Max listing quantity?
8. **Soulbound items**: Should some quest/achievement items be non-tradeable?

## Alternatives Considered

1. **Barter-only (no currency)**: More realistic but terrible UX. Players need a common medium of exchange.
2. **Fixed prices everywhere**: Simpler but kills the economy. No reason to craft if everything costs the same at every NPC.
3. **Full auction system**: eBay-style bidding. Too complex for a MUD. Buy-it-now is sufficient.
4. **No item quality**: All items identical. Kills crafting incentive. Rejected.
