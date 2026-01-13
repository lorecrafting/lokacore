# Community Relay Infrastructure

## Executive Summary

This proposal explores **community-operated relay nodes** for Loka's encrypted communication system, with incentives that avoid the pitfalls of speculative crypto tokens.

**Core principles:**
- Community members can run relay/TURN nodes to help with P2P message delivery
- Operators earn **non-transferable** in-game rewards (no real-world value)
- **Invite/approval system** - curated trusted operators, not open mining
- Service-first framing: "Help the community" not "earn money"

**This is NOT:**
- A cryptocurrency
- A token sale
- A speculative investment
- A pump-and-dump scheme

---

## Motivation

### Why Community Infrastructure?

1. **Cost Distribution**: TURN servers cost money; community nodes offset this
2. **Geographic Coverage**: Players worldwide can run nodes in their region
3. **Resilience**: Distributed infrastructure has no single point of failure
4. **Community Ownership**: Players invested in the game's success
5. **Privacy**: More relay options = harder to correlate traffic

### Why NOT Traditional Crypto?

| Crypto Problem | Our Avoidance Strategy |
|----------------|------------------------|
| Tradeable tokens → speculation | Non-transferable credits |
| External markets → pump & dump | No extraction mechanism |
| Open mining → industrialization | Curated operator approval |
| Financial motive → bad actors | In-game rewards only |
| Token launches → regulatory issues | No token, no ICO, no sale |

---

## Anti-Speculation Design Principles

### The Golden Rules

1. **Non-Transferable**: Credits/rewards cannot move between players
2. **No External Value**: Nothing can be sold for real money
3. **Closed Loop**: Value exists only inside the game
4. **Service-Based**: Rewards tied to actual work performed
5. **Curated Access**: Operators are vetted, not self-selected

### What This Looks Like

```
┌─────────────────────────────────────────────────────────────┐
│ TRADITIONAL CRYPTO                                         │
│                                                            │
│   Mine tokens → Trade on exchange → Cash out               │
│        ↓              ↓                ↓                   │
│   Speculation    Manipulation    Real money                │
│                                                            │
│   Result: Attracts profit-seekers, not community members   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LOKA COMMUNITY INFRASTRUCTURE                              │
│                                                            │
│   Run node → Earn credits → Spend on cosmetics/features    │
│       ↓           ↓                    ↓                   │
│   Service    Account-bound      In-game only               │
│                                                            │
│   Result: Attracts community helpers, not speculators      │
└─────────────────────────────────────────────────────────────┘
```

---

## Operator Models

### Model A: Trusted Operator Program (Recommended for Launch)

**Overview:**
- Hand-selected community members run relay nodes
- Vetted through application process
- Earn exclusive in-game rewards
- No financial incentive

**Application Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ OPERATOR APPLICATION                                       │
│                                                            │
│   1. Player submits application                            │
│   2. Admin reviews:                                        │
│      - Account age (6+ months recommended)                 │
│      - Standing (no bans, good reputation)                 │
│      - Community involvement (guild, helper, etc.)         │
│      - Technical capability (can maintain a VPS)           │
│   3. Interview/chat (optional for edge cases)              │
│   4. Approved → Receive operator token                     │
│   5. Set up node → Start serving community                 │
└─────────────────────────────────────────────────────────────┘
```

**Application Questions:**

```yaml
application_form:
  required:
    - question: "How long have you been playing Loka?"
      type: text
    - question: "What's your character name and guild (if any)?"
      type: text
    - question: "Why do you want to run a relay node?"
      type: textarea
    - question: "Describe your technical setup (VPS provider, region, specs)"
      type: textarea
    - question: "How have you contributed to the Loka community?"
      type: textarea
    - question: "What timezone are you in? How often are you online?"
      type: text

  red_flags:  # Auto-flag for careful review
    - Contains: "how much can I earn"
    - Contains: "profit"
    - Contains: "multiple nodes"
    - Contains: "transfer rewards"
    - Account age < 3 months
    - No guild membership
    - No game activity in past 30 days
```

**Operator Rewards:**

| Reward | Description | Transferable? |
|--------|-------------|---------------|
| Title: "Keeper of the Signal" | Displayed in-game | No |
| Exclusive robe cosmetic | Unique operator-only appearance | No |
| Aura effect | Subtle glow indicating operator status | No |
| Priority support channel | Direct line to admins | N/A |
| Monthly credit stipend | 1000 credits/month if uptime >95% | No |
| Voice in decisions | Invited to infrastructure discussions | N/A |

---

### Model B: Guild Infrastructure

**Overview:**
- Guilds (not individuals) can operate relay nodes
- Benefits go to the guild collectively
- No individual profit motive

**How It Works:**

```
┌─────────────────────────────────────────────────────────────┐
│ GUILD NODE SYSTEM                                          │
│                                                            │
│   Guild applies → Admin approves → Guild runs node         │
│                                                            │
│   Benefits to guild:                                       │
│   ├── Faster P2P for guild members (priority routing)      │
│   ├── Extended message history retention                   │
│   ├── Guild-exclusive encrypted channels                   │
│   ├── Guild hall upgrades (cosmetic)                       │
│   └── "Infrastructure Guild" badge                         │
│                                                            │
│   Implementation:                                          │
│   ├── Guild leader or officer runs node                    │
│   ├── Node serves guild members first                      │
│   ├── Excess capacity serves general population            │
│   └── Benefits tied to guild, not individual               │
└─────────────────────────────────────────────────────────────┘
```

**Why This Works:**
- Motivation = guild success, not personal profit
- Natural accountability (guild reputation at stake)
- Distributed responsibility (guild can rotate who maintains)

---

### Model C: Service Credit Economy

**Overview:**
- Operators earn "Relay Credits" for service
- Credits buy cosmetics and convenience features
- Credits are **strictly non-transferable**

**Earning Credits:**

```
┌─────────────────────────────────────────────────────────────┐
│ CREDIT EARNING                                             │
│                                                            │
│   Base rate:                                               │
│   └── 100 credits/day while node is online                 │
│                                                            │
│   Bonuses:                                                 │
│   ├── Uptime 95-99%: +25% bonus                           │
│   ├── Uptime 99%+: +50% bonus                             │
│   ├── Messages relayed: +1 credit per 1000 messages       │
│   └── Geographic bonus: +25% for underserved regions      │
│                                                            │
│   Caps (anti-gaming):                                      │
│   ├── Max 500 credits/day per operator                    │
│   ├── One node per operator                               │
│   └── Self-messages don't count                           │
└─────────────────────────────────────────────────────────────┘
```

**Spending Credits:**

| Item | Cost | Description |
|------|------|-------------|
| Operator Robe (basic) | 500 | Simple cosmetic robe |
| Operator Robe (rare) | 2000 | Glowing variant |
| Signal Keeper Aura | 5000 | Subtle particle effect |
| Extended Offline Queue | 1000/mo | Messages held 7 days vs 1 day |
| Guild Donation | Any | Convert personal credits to guild benefits |
| Node Stats Dashboard | 500 | Personal analytics page |

**Critical Restrictions:**

```elixir
defmodule Loka.Infrastructure.OperatorCredits do
  # Credits are bound to account
  schema "operator_credits" do
    belongs_to :player, Player
    field :balance, :integer, default: 0
    field :lifetime_earned, :integer, default: 0
    field :lifetime_spent, :integer, default: 0

    # NOTE: No transfer_to field exists
    # NOTE: No withdrawal mechanism exists
    # This is intentional and permanent

    timestamps()
  end

  # The ONLY ways credits leave an account:
  # 1. Purchase cosmetics (credits destroyed)
  # 2. Purchase features (credits destroyed)
  # 3. Donate to guild (credits destroyed, guild gets benefit)

  # There is NO:
  # - Transfer to another player
  # - Cash out mechanism
  # - API to extract value
  # - Trade or marketplace
end
```

---

## Technical Implementation

### Node Types

| Node Type | What It Does | Complexity | Resource Needs |
|-----------|--------------|------------|----------------|
| **TURN Relay** | Helps players behind strict NATs | Medium | VPS, static IP, bandwidth |
| **Message Relay** | Forwards encrypted blobs | Low | VPS, bandwidth |
| **Signaling Helper** | Assists WebRTC connection setup | Low | VPS, minimal bandwidth |

### Operator Node Setup

**Simple Docker deployment:**

```yaml
# docker-compose.yml for community operator
version: '3.8'

services:
  loka-relay:
    image: ghcr.io/loka-game/relay-node:latest
    restart: unless-stopped
    environment:
      # Issued by Loka admins after approval
      - OPERATOR_TOKEN=${OPERATOR_TOKEN}

      # Self-reported, verified by geolocation
      - REGION=us-west

      # Optional: limit bandwidth if needed
      - MAX_BANDWIDTH_MBPS=100

    ports:
      - "3478:3478/udp"   # TURN/STUN
      - "3478:3478/tcp"   # TURN/STUN TCP fallback
      - "8443:8443"       # Relay API (TLS)

    volumes:
      # Persistent data (connection stats, etc.)
      - ./data:/app/data

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Minimum Requirements:**

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Bandwidth | 100 Mbps | 1 Gbps |
| Storage | 1 GB | 5 GB |
| Cost | ~$5/mo | ~$10-20/mo |

### Server-Side Node Registry

```elixir
# lib/loka/infrastructure/community_node.ex
defmodule Loka.Infrastructure.CommunityNode do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "community_nodes" do
    belongs_to :operator, Loka.Accounts.Player, type: :binary_id
    belongs_to :guild, Loka.Framework.Guild, type: :binary_id  # Optional

    # Connection info
    field :endpoint, :string           # "turn:node1.relay.loka.game:3478"
    field :region, :string             # "us-west", "eu-central", "asia-east"
    field :node_type, :string          # "turn", "relay", "signaling"

    # Status tracking
    field :status, :string, default: "offline"  # "online", "offline", "degraded"
    field :last_heartbeat, :utc_datetime
    field :consecutive_failures, :integer, default: 0

    # Performance metrics
    field :uptime_percent_30d, :float, default: 0.0
    field :messages_relayed_total, :integer, default: 0
    field :messages_relayed_today, :integer, default: 0
    field :active_connections, :integer, default: 0
    field :avg_latency_ms, :float

    # Admin
    field :approved_at, :utc_datetime
    field :approved_by, :binary_id
    field :suspended_at, :utc_datetime
    field :suspension_reason, :string

    timestamps()
  end

  def changeset(node, attrs) do
    node
    |> cast(attrs, [:endpoint, :region, :node_type, :status])
    |> validate_required([:endpoint, :region, :node_type])
    |> validate_inclusion(:region, ~w(us-west us-east eu-west eu-central asia-east asia-south oceania))
    |> validate_inclusion(:node_type, ~w(turn relay signaling))
    |> unique_constraint(:endpoint)
  end
end
```

```elixir
# lib/loka/infrastructure/nodes.ex
defmodule Loka.Infrastructure.Nodes do
  import Ecto.Query
  alias Loka.Repo
  alias Loka.Infrastructure.CommunityNode

  @doc """
  Get healthy relay nodes for a region.
  Returns nodes sorted by uptime, with fallback to nearby regions.
  """
  def get_relay_nodes(region, opts \\ []) do
    limit = Keyword.get(opts, :limit, 5)
    include_nearby = Keyword.get(opts, :include_nearby, true)

    regions = if include_nearby do
      [region | nearby_regions(region)]
    else
      [region]
    end

    from(n in CommunityNode,
      where: n.status == "online",
      where: n.region in ^regions,
      where: n.uptime_percent_30d >= 90.0,
      order_by: [desc: n.uptime_percent_30d, asc: n.avg_latency_ms],
      limit: ^limit
    )
    |> Repo.all()
  end

  @doc """
  Record a heartbeat from a node.
  Updates status and resets failure counter.
  """
  def record_heartbeat(node_id, metrics) do
    now = DateTime.utc_now()

    from(n in CommunityNode, where: n.id == ^node_id)
    |> Repo.update_all(set: [
      status: "online",
      last_heartbeat: now,
      consecutive_failures: 0,
      active_connections: metrics.active_connections,
      avg_latency_ms: metrics.avg_latency_ms
    ])
  end

  @doc """
  Check for stale nodes and mark them degraded/offline.
  Run via periodic job.
  """
  def check_node_health do
    now = DateTime.utc_now()
    stale_threshold = DateTime.add(now, -60, :second)  # 1 minute
    offline_threshold = DateTime.add(now, -300, :second)  # 5 minutes

    # Mark stale nodes as degraded
    from(n in CommunityNode,
      where: n.status == "online",
      where: n.last_heartbeat < ^stale_threshold
    )
    |> Repo.update_all(set: [status: "degraded"])

    # Mark very stale nodes as offline
    from(n in CommunityNode,
      where: n.status in ["online", "degraded"],
      where: n.last_heartbeat < ^offline_threshold
    )
    |> Repo.update_all(set: [status: "offline"])
  end

  defp nearby_regions("us-west"), do: ["us-east"]
  defp nearby_regions("us-east"), do: ["us-west", "eu-west"]
  defp nearby_regions("eu-west"), do: ["eu-central", "us-east"]
  defp nearby_regions("eu-central"), do: ["eu-west"]
  defp nearby_regions("asia-east"), do: ["asia-south", "oceania"]
  defp nearby_regions("asia-south"), do: ["asia-east", "eu-central"]
  defp nearby_regions("oceania"), do: ["asia-east"]
  defp nearby_regions(_), do: []
end
```

### Credit Calculation

```elixir
# lib/loka/infrastructure/credit_calculator.ex
defmodule Loka.Infrastructure.CreditCalculator do
  alias Loka.Infrastructure.{Nodes, OperatorCredits}

  @base_daily_credits 100
  @max_daily_credits 500
  @uptime_bonus_95 0.25
  @uptime_bonus_99 0.50
  @underserved_region_bonus 0.25
  @credits_per_1000_messages 1

  @underserved_regions ~w(asia-south oceania)

  @doc """
  Calculate and award daily credits for an operator.
  Called by daily scheduled job.
  """
  def award_daily_credits(operator_id) do
    node = Nodes.get_node_for_operator(operator_id)

    if node && node.status != "offline" do
      credits = calculate_credits(node)
      OperatorCredits.add_credits(operator_id, credits, "daily_award")
      {:ok, credits}
    else
      {:ok, 0}
    end
  end

  defp calculate_credits(node) do
    base = @base_daily_credits

    # Uptime bonus
    uptime_multiplier = cond do
      node.uptime_percent_30d >= 99.0 -> 1 + @uptime_bonus_99
      node.uptime_percent_30d >= 95.0 -> 1 + @uptime_bonus_95
      true -> 1.0
    end

    # Underserved region bonus
    region_multiplier = if node.region in @underserved_regions do
      1 + @underserved_region_bonus
    else
      1.0
    end

    # Message relay bonus
    message_bonus = div(node.messages_relayed_today, 1000) * @credits_per_1000_messages

    # Calculate total with cap
    total = trunc(base * uptime_multiplier * region_multiplier) + message_bonus
    min(total, @max_daily_credits)
  end
end
```

### Anti-Gaming Measures

```elixir
# lib/loka/infrastructure/anti_abuse.ex
defmodule Loka.Infrastructure.AntiAbuse do
  alias Loka.Infrastructure.CommunityNode
  alias Loka.Repo
  import Ecto.Query

  @doc """
  Validate new node registration.
  Enforces one node per operator.
  """
  def validate_new_node(operator_id) do
    existing = Repo.one(
      from n in CommunityNode,
      where: n.operator_id == ^operator_id,
      where: is_nil(n.suspended_at)
    )

    case existing do
      nil -> :ok
      _ -> {:error, :one_node_per_operator}
    end
  end

  @doc """
  Validate relayed message for credit.
  Prevents self-messaging and other gaming.
  """
  def validate_relay_credit(message) do
    cond do
      # Self-messaging
      message.sender_id == message.recipient_id ->
        {:error, :self_message}

      # Suspiciously small payload (likely dummy)
      byte_size(message.payload) < 10 ->
        {:error, :payload_too_small}

      # Rate limiting per sender-recipient pair
      recent_count = count_recent_messages(message.sender_id, message.recipient_id)
      recent_count > 100 ->  # More than 100/minute between same pair
        {:error, :rate_limited}

      true ->
        :ok
    end
  end

  @doc """
  Detect suspicious patterns.
  Returns list of anomalies for admin review.
  """
  def detect_anomalies(node_id) do
    node = Repo.get(CommunityNode, node_id)
    anomalies = []

    # Sudden traffic spike (10x normal)
    if node.messages_relayed_today > node.avg_daily_messages * 10 do
      anomalies = [{:traffic_spike, node.messages_relayed_today} | anomalies]
    end

    # Mostly self-referential traffic
    self_traffic_percent = calculate_self_traffic_percent(node_id)
    if self_traffic_percent > 50 do
      anomalies = [{:high_self_traffic, self_traffic_percent} | anomalies]
    end

    # Single sender/recipient dominance
    if single_pair_dominates?(node_id) do
      anomalies = [{:single_pair_dominance, true} | anomalies]
    end

    anomalies
  end
end
```

### Client Integration

```javascript
// assets/js/relay_selector.js
class RelaySelector {
  constructor(cryptoChannel) {
    this.channel = cryptoChannel;
    this.nodes = [];
    this.currentNode = null;
  }

  async initialize() {
    // Fetch available nodes for our region
    const region = await this.detectRegion();
    this.nodes = await this.fetchNodes(region);

    // Select best node
    this.currentNode = await this.selectBestNode();
  }

  async fetchNodes(region) {
    return new Promise((resolve) => {
      this.channel.push("get_relay_nodes", { region })
        .receive("ok", ({ nodes }) => resolve(nodes))
        .receive("error", () => resolve([]));
    });
  }

  async selectBestNode() {
    // Test latency to each node
    const results = await Promise.all(
      this.nodes.map(async (node) => ({
        node,
        latency: await this.measureLatency(node.endpoint)
      }))
    );

    // Sort by latency, pick fastest
    results.sort((a, b) => a.latency - b.latency);
    return results[0]?.node || null;
  }

  async measureLatency(endpoint) {
    const start = performance.now();
    try {
      await fetch(`https://${endpoint}/ping`, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return performance.now() - start;
    } catch {
      return Infinity;
    }
  }

  getIceServers() {
    const servers = [
      // Always include public STUN
      { urls: 'stun:stun.l.google.com:19302' }
    ];

    // Add community TURN if available
    if (this.currentNode) {
      servers.push({
        urls: this.currentNode.endpoint,
        username: this.currentNode.turn_username,
        credential: this.currentNode.turn_credential
      });
    }

    // Fallback to official TURN
    servers.push({
      urls: 'turn:turn.loka.game:3478',
      username: this.officialTurnUsername,
      credential: this.officialTurnCredential
    });

    return servers;
  }
}
```

---

## Rollout Plan

### Phase 1: Trusted Inner Circle (Month 1)

**Goal:** Prove the concept with hand-picked operators

| Task | Details |
|------|---------|
| Identify candidates | 5-10 trusted community members |
| Personal outreach | Direct message, explain concept |
| Manual onboarding | Help them set up nodes |
| Monitor closely | Daily check-ins, fix issues |
| No formal rewards | Just recognition and thanks |

**Success criteria:**
- 5+ nodes running stably
- Geographic diversity (at least 3 regions)
- No major issues for 2 weeks

### Phase 2: Application System (Month 2-3)

**Goal:** Open to more operators with formal process

| Task | Details |
|------|---------|
| Build application form | In-game or web form |
| Create review process | Admin dashboard for applications |
| Document requirements | Public guide for applicants |
| Introduce cosmetic rewards | Title, basic robe |
| Scale to 20-30 operators | Gradual growth |

**Success criteria:**
- Application flow working smoothly
- 80% of applicants are genuine (not profit-seekers)
- Network serving 50%+ of relay traffic

### Phase 3: Credit Economy (Month 4-6)

**Goal:** Sustainable incentive structure

| Task | Details |
|------|---------|
| Implement credit system | Earning, spending, tracking |
| Build cosmetic shop | Operator-exclusive items |
| Add guild infrastructure | Guilds can run nodes |
| Create operator dashboard | Stats, earnings, status |
| Scale to 50+ operators | Coverage for all regions |

**Success criteria:**
- Credits functioning without exploits
- No secondary market emerging
- Operators satisfied with rewards

### Phase 4: Maturity (Month 6+)

**Goal:** Self-sustaining community infrastructure

| Task | Details |
|------|---------|
| Reduce admin overhead | Automated monitoring/alerts |
| Operator self-service | Status page, config tools |
| Community governance | Operators vote on policies |
| Documentation | Full operator guide |

---

## Governance

### Operator Council (Future)

Once the program matures, operators could have a voice:

```
┌─────────────────────────────────────────────────────────────┐
│ OPERATOR COUNCIL                                           │
│                                                            │
│   Composition:                                             │
│   - 5 elected operators (6-month terms)                    │
│   - 2 admin representatives                                │
│                                                            │
│   Responsibilities:                                        │
│   - Review new operator applications                       │
│   - Propose credit economy changes                         │
│   - Advise on infrastructure decisions                     │
│   - Handle operator disputes                               │
│                                                            │
│   NOT responsible for:                                     │
│   - Game design decisions                                  │
│   - Non-infrastructure matters                             │
│   - Real-money anything                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Risk Mitigation

### Risk: Secondary Market Emerges

**Scenario:** Players find ways to sell credits/accounts

**Mitigations:**
- Credits have no transfer function (technically impossible)
- Account selling violates ToS (already prohibited)
- Rewards are cosmetic only (low real-world value)
- Monitor for account sharing patterns

### Risk: Operators Collude to Game System

**Scenario:** Operators send fake traffic to each other

**Mitigations:**
- Anti-abuse detection (traffic patterns)
- Daily credit cap per operator
- Manual review of anomalies
- Ban hammer for bad actors

### Risk: Node Quality Degrades

**Scenario:** Operators run poorly maintained nodes

**Mitigations:**
- Uptime-based rewards (incentivize quality)
- Automatic health checks
- Remove underperforming nodes from rotation
- Suspend operators with consistent issues

### Risk: Not Enough Operators

**Scenario:** Too few people want to run nodes

**Mitigations:**
- Start small (5-10 is enough initially)
- Fall back to official infrastructure
- Increase rewards if needed
- Guild model as alternative motivation

### Risk: Regulatory Concerns

**Scenario:** Someone claims this is a security/crypto offering

**Mitigations:**
- No token, no sale, no investment
- Credits have no monetary value
- Cannot be traded or cashed out
- Clear documentation of non-financial nature
- Legal review before launch

---

## FAQ

**Q: Isn't this just crypto with extra steps?**

A: No. The defining features of crypto (tradeable tokens, external markets, speculation) are specifically excluded. This is closer to a loyalty program than a cryptocurrency.

**Q: Why would anyone run a node without financial reward?**

A: Same reasons people moderate Discord servers, run game wikis, or help in community forums: status, recognition, community contribution, exclusive perks. Many games have successful volunteer programs.

**Q: What if someone tries to sell their account?**

A: Account selling is already against ToS. The credits are account-bound with no transfer mechanism, so there's limited value anyway. We monitor for suspicious account activity.

**Q: Can I run multiple nodes?**

A: No, one node per operator. This prevents industrialization and keeps it community-focused.

**Q: What happens if I stop running my node?**

A: Your operator status becomes inactive. You keep earned credits but stop earning new ones. No penalty, you can restart later.

**Q: Can guilds and individuals both run nodes?**

A: Yes, they serve different purposes. Individual operators earn personal rewards; guild nodes provide collective benefits.

---

## Summary

**What we're building:**
- Community-operated relay infrastructure
- Non-financial incentive system
- Curated, trusted operator network

**What we're NOT building:**
- Cryptocurrency or token
- Speculative investment
- Open mining operation
- Path to real-world profit

**Key safeguards:**
- Non-transferable credits
- Approval-based access
- In-game rewards only
- Anti-gaming measures
- Admin oversight

**Thematic fit:**
"Keepers of the Signal" - trusted community members who maintain the monastery's communication channels. Service to the community, not profit extraction.

---

## References

- [Parent Proposal: Encrypted P2P Communication](./encrypted-p2p-communication.md)
- [TURN Server (coturn)](https://github.com/coturn/coturn)
- [WebRTC Infrastructure](https://webrtc.org/)
- [Community Moderation Best Practices](https://discord.com/safety/360044103771-setting-up-permissions-faq)
