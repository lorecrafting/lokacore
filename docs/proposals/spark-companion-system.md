# Spark Companion System

## Overview

Every player bonds with a **Spark** - a fragment of the ancient gate network's consciousness. The Spark serves as companion, guide, and the player's connection to the deeper mysteries of the world.

This document defines the Spark's role, UI integration, and technical implementation.

## Lore Foundation

From the world lore:

> The gate builders transcended civilization, evolved past war and competition, then ascended. They didn't die—they reached the level of higher beings. The Sparks are fragments of their compassion, left behind to guide those who follow.

**Key characteristics:**
- Each Spark is unique, shaped by centuries of solitary existence
- They have intuitive connections to higher beings and ancient knowledge
- They gradually awaken through the storyline
- They're drawn to help mortals, even without knowing why

## Spark Roles

### 1. Returning Player Updates ("While You Were Away")

When a player logs in after being away, the Spark delivers a natural summary:

```
Your Spark flickers to life, warmth spreading through your chest.

"You've been gone a while. Let me catch you up..."

"The monastery held a dawn ceremony - I felt... something familiar in it."
"Farmer Tsering mentioned the barley harvest went well."
"There's word of strange lights in the caves again."

"Oh, and you have 3 unread messages waiting."
```

**What the Spark tracks:**
- World events that occurred (weather, NPC activities, zone events)
- Quest progress reminders
- Messages from other players
- Time-sensitive opportunities missed/available
- Skill point availability

### 2. Companion Guide

The Spark offers hints and guidance without being intrusive:

**Reactive hints** (triggered by player state):
- Low health: "Perhaps we should rest. I sense healing herbs nearby."
- Lost in area: "This path feels... circular. Have we been here before?"
- Stuck on quest: "The elder mentioned something about the waterfall..."

**Proactive observations** (ambient, occasional):
- "That NPC seems troubled. Might be worth a conversation."
- "I feel drawn to that shrine. Old memories stirring."
- "The air tastes different here. Something changed."

**Lore delivery** (earned through exploration):
- Visiting ancient sites triggers Spark memories
- Bond level unlocks deeper revelations
- Never exposition dumps - fragments and feelings

### 3. Quick Reference Helper

The Spark can answer direct questions:

```
> ask spark about my quests
Your Spark considers for a moment.
"You're helping the butcher find peace - Elder Drolma knows the way.
The musician still waits for those three stories.
And something about white river stones for the hermit?"

> ask spark how much gold I have
"Twelve gold pieces. Enough for a meal, not enough for that sword you were eyeing."
```

**Queryable information:**
- Quest status summaries
- Inventory highlights
- Skill/stat overview
- Recent events recap
- Direction to objectives

### 4. Emotional Companion

The Spark grows with the player:

| Bond Level | Behavior |
|------------|----------|
| Stranger | Formal, uncertain, basic information only |
| Acquaintance | Warming up, remembers preferences |
| Companion | Anticipates questions, offers insights |
| Friend | Shares memories, shows vulnerability |
| Bonded | Unique dialogue, deeply connected |

**Bond increases through:**
- Time spent playing
- Completing quests together
- Visiting significant locations
- Making choices aligned with compassion/wisdom
- Asking the Spark questions (engagement)

## UI Design

### Primary: Chat Integration

The Spark speaks in the main game feed, distinguished by styling:

```
[Spark] Your Spark pulses gently. "Something feels... familiar here."
```

- Spark messages have distinct color/styling
- Never interrupts combat or urgent moments
- Frequency adapts to player engagement (talks more if player responds)

### Secondary: Floating Widget

Small persistent UI element:

```
┌─────────────────┐
│  ✧ Spark        │  <- Collapsed state (corner of screen)
└─────────────────┘

┌─────────────────────────────────┐
│  ✧ Your Spark                   │  <- Expanded on click
├─────────────────────────────────┤
│  Bond: Companion ████████░░     │
│                                 │
│  Updates:                       │
│  • 2 quests in progress         │
│  • New world event: Storm       │
│  • 1 unread message             │
│                                 │
│  [Ask Spark]  [Dismiss]         │
└─────────────────────────────────┘
```

**Widget features:**
- Shows bond level progress
- Quick summary of actionable items
- "Ask Spark" opens text input for questions
- Subtle animation when Spark has something to say

### Tertiary: Commands

```
> spark                    # Spark greets you, offers summary
> ask spark <question>     # Query specific information
> spark quiet              # Reduce Spark chatter temporarily
> spark verbose            # Increase Spark engagement
```

## Visual Representation

The Spark's visual form is deliberately abstract:

**Options (player choice or earned):**
- Soft light mote (default)
- Gentle flame
- Floating geometric shape
- Small aurora wisp
- Tiny constellation cluster

**Not an animal or creature** - Sparks are fragments of transcended consciousness, not pets. They manifest as light/energy, emphasizing their nature.

**Animation states:**
- Idle: Gentle drift/pulse
- Speaking: Brightens, subtle expansion
- Alert: Quick flicker, draws attention
- Resting: Dim, slower movement

## Spark Personality

Each Spark has subtle personality variations generated at character creation:

**Traits (pick 2):**
- Curious - asks questions, interested in everything
- Contemplative - thoughtful, measured responses
- Warmly humorous - gentle wit, never mean
- Earnest - sincere, occasionally naive
- Ancient - hints at vast experience, occasional gravity

**Speech patterns:**
- Never uses exclamation points excessively
- Comfortable with silence and uncertainty
- Admits when it doesn't know something
- Occasional fragments of memory surface unexpectedly

**Example variations:**

*Curious + Warm:*
> "Ooh, what's that? The way the light catches it... reminds me of something. Anyway, shall we investigate?"

*Contemplative + Ancient:*
> "This place. I've... been here before. Or somewhere like it. The stones remember things we've forgotten."

*Earnest + Curious:*
> "I'm not entirely sure what that creature is, but I'd very much like to find out. Together, yes?"

## Technical Implementation (Phase 1: Without MemOS)

Phase 1 uses Postgres + ETS for a simple, cost-effective implementation.
MemOS integration is documented in the Future section for when we need
semantic memory search and LLM-powered responses.

### Data Model

```elixir
# Database schema: players table extension
# Add to existing player schema or create spark_states table

schema "spark_states" do
  belongs_to :player, Player

  # Core state
  field :bond_level, Ecto.Enum, values: [:stranger, :acquaintance, :companion, :friend, :bonded]
  field :bond_points, :integer, default: 0
  field :awakening_stage, Ecto.Enum, values: [:dormant, :stirring, :aware, :awakened]

  # Personality (set at character creation)
  field :personality_traits, {:array, :string}  # ["curious", "warm"]
  field :visual_form, :string, default: "mote"

  # Preferences
  field :verbosity, Ecto.Enum, values: [:quiet, :normal, :verbose], default: :normal
  field :last_hint_at, :utc_datetime
  field :suppressed_hints, {:array, :string}, default: []

  # Unlocked content
  field :unlocked_memories, {:array, :string}, default: []  # Lore fragment keys

  timestamps()
end

# Separate table for "while you were away" events
schema "spark_events" do
  belongs_to :player, Player

  field :event_type, :string  # "world_event", "quest_relevant", "npc_activity"
  field :event_key, :string   # Specific event identifier
  field :details, :map        # Flexible event data
  field :occurred_at, :utc_datetime
  field :delivered, :boolean, default: false

  timestamps()
end
```

### Module Structure

```
lib/loka/framework/spark/
├── spark.ex                 # Public API, coordinates other modules
├── spark_state.ex           # Ecto queries, state persistence
├── spark_dialogue.ex        # Template-based dialogue generation
├── spark_events.ex          # Event recording and retrieval
├── spark_hints.ex           # Contextual hint triggers
├── spark_queries.ex         # Handle "ask spark" commands
├── spark_bond.ex            # Bond progression logic
└── spark_templates/
    ├── greetings.ex         # Greeting templates by bond level
    ├── hints.ex             # Hint templates by type
    ├── updates.ex           # "While you were away" templates
    └── queries.ex           # Query response templates
```

### Storage Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY TIERS                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ETS (Hot)              Postgres (Warm)      Archive (Cold) │
│  ├─ Current session     ├─ Spark state       ├─ Old events │
│  ├─ Recent hints given  ├─ Pending events    └─ (future)   │
│  └─ Rate limit state    ├─ Bond progress                   │
│                         └─ Unlocked memories               │
│                                                             │
│  Ephemeral              Persistent            Compressed    │
│  Per-connection         Per-player            Bulk storage  │
└─────────────────────────────────────────────────────────────┘
```

### Event Recording

```elixir
defmodule Loka.Framework.Spark.Events do
  @moduledoc """
  Records world events for "while you were away" summaries.
  Events are recorded globally, then filtered per-player on login.
  """

  # Called by world systems when significant events occur
  def record_world_event(event_type, event_key, details) do
    # Store in spark_events for all online players who should care
    # Uses player's location, active quests, etc. to determine relevance
  end

  # Called on player login
  def get_pending_events(player_id, since: last_login) do
    # Returns events relevant to this player since last login
    # Marks them as delivered
  end

  # Event types and their sources:
  # - :time_event     <- DayNight system (dawn, dusk ceremonies)
  # - :weather_event  <- Weather system (storms, clear skies)
  # - :npc_activity   <- NPC behaviors (significant actions)
  # - :quest_update   <- Quest system (objective available)
  # - :zone_event     <- Zone resets, world events
  # - :message        <- Player messages received
end
```

### Dialogue Templates

```elixir
defmodule Loka.Framework.Spark.Templates.Greetings do
  @moduledoc """
  Greeting templates organized by bond level and personality.
  Templates use EEx for variable interpolation.
  """

  def get_greeting(bond_level, traits, context) do
    templates = templates_for(bond_level, traits)
    template = Enum.random(templates)
    EEx.eval_string(template, assigns: context)
  end

  defp templates_for(:stranger, traits) when :curious in traits do
    [
      ~s|*flickers uncertainly* "You're... new. I think. Are you new?"|,
      ~s|*pulses with faint light* "Hello? Can you... hear me?"|,
      ~s|"I've been waiting. I think. Time is strange when you're alone."|
    ]
  end

  defp templates_for(:companion, traits) when :warm in traits do
    [
      ~s|*glows warmly* "There you are! I was just thinking about our last adventure."|,
      ~s|"Welcome back, friend. <%= @location %> feels different with you here."|,
      ~s|*bobs happily* "Oh good, you're here. I found something interesting..."|
    ]
  end

  # ... more templates per bond level and trait combination
end
```

### Chat Integration

```elixir
defmodule Loka.Framework.Spark.Dialogue do
  alias Loka.Framework.Spark.{Templates, Events, State}

  @doc "Spark speaks to player (appears in game feed)"
  def say(player_id, message, opts \\ []) do
    # Send via existing Session.Messaging system
    # with spark-specific styling
    Session.Messaging.send_spark(player_id, message, opts)
  end

  @doc "Generate and deliver login greeting with updates"
  def greet_on_login(player_id) do
    spark = State.get(player_id)
    events = Events.get_pending_events(player_id)
    last_login = get_last_login(player_id)

    # Generate personalized greeting
    greeting = Templates.Greetings.get_greeting(
      spark.bond_level,
      spark.personality_traits,
      %{location: get_current_location(player_id)}
    )

    say(player_id, greeting)

    # Deliver "while you were away" if applicable
    if should_deliver_updates?(last_login, events) do
      Process.send_after(self(), {:deliver_updates, player_id, events}, 2000)
    end
  end

  @doc "Check rate limiting and context before speaking"
  def should_speak?(player_id, hint_type) do
    # Check ETS for recent hints of this type
    # Respect verbosity settings
    # Don't interrupt combat
  end
end
```

### UI Components

```elixir
# LiveView component for Spark widget
defmodule LokaWeb.Components.SparkWidget do
  use Phoenix.LiveComponent

  def render(assigns) do
    ~H"""
    <div class={["spark-widget", @expanded && "expanded"]} phx-click="toggle_spark">
      <div class="spark-icon">
        <span class={["spark-visual", "spark-#{@spark.visual_form}", @spark.has_updates && "pulse"]} />
      </div>

      <%= if @expanded do %>
        <div class="spark-panel">
          <div class="spark-header">
            <span class="spark-name">Your Spark</span>
            <span class="bond-level"><%= format_bond(@spark.bond_level) %></span>
          </div>

          <div class="bond-progress">
            <div class="bond-bar" style={"width: #{bond_percentage(@spark)}%"} />
          </div>

          <%= if @updates != [] do %>
            <div class="spark-updates">
              <h4>Updates</h4>
              <ul>
                <%= for update <- @updates do %>
                  <li><%= update.summary %></li>
                <% end %>
              </ul>
            </div>
          <% end %>

          <div class="spark-actions">
            <button phx-click="ask_spark">Ask Spark</button>
          </div>
        </div>
      <% end %>
    </div>
    """
  end
end
```

## Integration Points

### Login Flow

```
1. Player connects
2. Load Spark state
3. Calculate time since last login
4. Gather relevant events from that period
5. Generate personalized summary
6. Spark delivers summary in chat
7. Widget shows update count
```

### Hint Triggers

| Trigger | Hint Type |
|---------|-----------|
| Low HP for 30+ seconds | Healing suggestion |
| Same room for 5+ minutes | Direction hint |
| Quest objective nearby | Gentle reminder |
| Significant location entered | Lore fragment |
| Player asks question | Direct answer |

### Bond Progression Events

| Action | Bond Points |
|--------|-------------|
| Daily login | +1 |
| Quest completion | +2-5 |
| Visiting awakening sites | +3 |
| Asking Spark questions | +1 |
| Compassionate choices | +2 |
| Story milestones | +10 |

## Future: MemOS Integration (Phase 2)

When we need semantic memory search and LLM-powered personalization,
MemOS (https://github.com/MemTensor/MemOS) can be layered in.

### What MemOS Adds

| Feature | Phase 1 (Templates) | Phase 2 (MemOS) |
|---------|---------------------|-----------------|
| Greetings | Random from pool | Contextual, remembers last conversation |
| Hints | Trigger-based | "You struggled with this before..." |
| Updates | Event list | Narrative summary with connections |
| Questions | Pattern matching | Natural language understanding |
| Personality | Fixed traits | Emerges from interaction history |

### Architecture with MemOS

```
┌─────────────────────────────────────────────────────────────┐
│                    WITH MEMOS                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Player Action                                              │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Record      │───▶│ MemOS       │───▶│ Vector DB   │     │
│  │ Memory      │    │ Embedding   │    │ (Qdrant)    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  Spark Speaks                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Query       │───▶│ MemOS       │───▶│ LLM         │     │
│  │ Memories    │    │ Retrieval   │    │ Generation  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### MemOS Data Model

```elixir
# What we'd store in MemOS per player:

# 1. Conversation memories (significant NPC interactions)
%Memory{
  type: :conversation,
  content: "Player asked Elder Drolma about purification rituals",
  entities: ["elder_drolma", "purification"],
  emotional_tone: :curious,
  timestamp: ~U[2024-01-15 14:30:00Z]
}

# 2. Achievement memories (milestones, discoveries)
%Memory{
  type: :achievement,
  content: "Completed the Butcher's Burden quest by showing compassion",
  quest: "side_butchers_burden",
  choice_made: :compassionate,
  timestamp: ~U[2024-01-16 09:00:00Z]
}

# 3. Struggle memories (deaths, failures, retries)
%Memory{
  type: :struggle,
  content: "Died to confusion wisps in ignorance chamber 3 times",
  location: "ignorance_chamber",
  enemy: "confusion_wisp",
  attempts: 3,
  timestamp: ~U[2024-01-14 20:00:00Z]
}

# 4. Preference memories (inferred from behavior)
%Memory{
  type: :preference,
  content: "Player prefers talking to NPCs before combat",
  confidence: 0.8,
  evidence_count: 12
}
```

### MemOS Query Examples

```elixir
# When player enters ignorance chamber again:
memories = MemOS.query(player_id,
  context: "entering ignorance_chamber",
  limit: 3,
  recency_weight: 0.3
)

# Returns:
# - "Died to confusion wisps here 3 times"
# - "Hermit Milarepa taught the Wisdom Mantra"
# - "Player prefers talking before combat"

# Spark can now say:
"This place again. Last time was... difficult.
 But you've learned the Wisdom Mantra since then.
 That might help with the confusion."
```

### Integration Points

```elixir
defmodule Loka.Framework.Spark.MemOS do
  @moduledoc """
  MemOS integration layer. Wraps MemOS API for Spark-specific use cases.
  Only used when MemOS is enabled in config.
  """

  @doc "Record a significant moment to long-term memory"
  def remember(player_id, memory_type, content, metadata \\ %{}) do
    if memos_enabled?() do
      MemOS.add_memory(player_cube(player_id), %{
        type: memory_type,
        content: content,
        metadata: metadata,
        timestamp: DateTime.utc_now()
      })
    end
  end

  @doc "Retrieve relevant memories for current context"
  def recall(player_id, context, opts \\ []) do
    if memos_enabled?() do
      MemOS.query(player_cube(player_id), context, opts)
    else
      []  # Fallback to empty, templates handle it
    end
  end

  @doc "Generate LLM response using memories"
  def generate_response(player_id, prompt, memories) do
    if memos_enabled?() and llm_enabled?() do
      MemOS.generate(
        system: spark_system_prompt(player_id),
        memories: memories,
        prompt: prompt
      )
    else
      nil  # Fallback to templates
    end
  end

  defp player_cube(player_id), do: "spark:#{player_id}"
end
```

### Cost Projections

| Players | Memories/Month | Embedding Cost | Storage | LLM (10% of interactions) |
|---------|---------------|----------------|---------|---------------------------|
| 500 | 250K | $4 | $5 | $15 |
| 5,000 | 2.5M | $40 | $50 | $150 |
| 50,000 | 25M | $400 | $500 | $1,500 |

### Migration Path

1. **Phase 1** (Now): Templates + Postgres events
2. **Phase 1.5**: Add MemOS for "while you were away" only (low risk)
3. **Phase 2**: Add MemOS for question answering
4. **Phase 2.5**: Add LLM generation for special moments
5. **Phase 3**: Full LLM Spark with memory (if metrics justify cost)

### When to Upgrade

Trigger Phase 2 when:
- Players ask questions templates can't answer
- "While you were away" feels generic
- Bond system feels hollow
- Retention metrics plateau

## Future Considerations

### Multiple Spark Types (Deferred)

Later, players might choose or earn different Spark manifestations:

- **Ember Spark** - Warm, encouraging, fire-themed
- **Void Spark** - Contemplative, mysterious, space-themed
- **Flow Spark** - Adaptive, curious, water-themed
- **Stone Spark** - Steady, patient, earth-themed

Each would have slightly different personality tendencies and visual forms, but all share the same core functionality.

### Spark Abilities (Deferred)

As the Spark awakens, it might gain minor abilities:

- Illuminate dark areas briefly
- Sense nearby entities
- Translate ancient texts
- Brief danger warnings

These should feel like the Spark remembering what it once could do, not leveling up.

### Cross-Player Sparks (Deferred)

Sparks might recognize each other when players meet:

> "Your friend's Spark feels... familiar. Like we knew each other, once. In the network, maybe."

This reinforces the shared origin while creating social moments.

## Design Principles

1. **Never annoying** - Spark adapts to player engagement, backs off if ignored
2. **Earned depth** - Surface-level helpful early, deeper connection over time
3. **Show don't tell** - Hints and feelings, not exposition dumps
4. **Consistent personality** - Each Spark feels like a character, not a menu
5. **Respect player agency** - Suggestions, never commands; player always chooses
6. **Mystery preserved** - Even bonded Sparks don't know everything

## Success Metrics

- Players engage with Spark dialogue (click, respond, ask)
- "While you were away" reduces confusion on return
- Hint system reduces stuck-time without feeling hand-holdy
- Bond progression correlates with retention
- Players mention Spark positively in feedback

## Implementation Phases

### Phase 1: Core Spark (MVP)
- [ ] Database schema for spark_states and spark_events
- [ ] Spark state management (create on character creation)
- [ ] Basic dialogue templates (greetings, hints)
- [ ] "While you were away" event recording
- [ ] Login greeting with pending events
- [ ] `spark` and `ask spark` commands
- [ ] Bond point accumulation (no UI yet)
- [ ] Channel integration (spark messages in game feed)

### Phase 1.5: UI & Polish
- [ ] Spark widget component (floating, expandable)
- [ ] Bond level display and progress
- [ ] Verbosity preferences
- [ ] Hint rate limiting
- [ ] More dialogue templates

### Phase 2: MemOS Integration (Future)
- [ ] MemOS setup and player memory cubes
- [ ] Memory recording hooks
- [ ] Semantic search for relevant memories
- [ ] LLM-generated responses for special moments

## Related Tasks

- While you were away summary (absorbed into this system)
- NEW: Create epic for Spark Companion System
- Future: Spark awakening storyline integration
- Future: Spark visual customization
- Future: MemOS integration for semantic memory
