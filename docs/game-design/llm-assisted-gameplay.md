# LLM-Assisted Gameplay: Design Strategy

**Status**: Deliberation
**Last Updated**: 2026-01-07
**Related**: [AI Resilience Strategy](./ai-resilience-strategy.md), [Social Primitives](./social-primitives.md)

## Executive Summary

As LLM-powered tools become ubiquitous, players will inevitably use AI assistants to optimize gameplay. Rather than fighting this trend, Loka can embrace it by designing systems where AI assistance **enhances** rather than **trivializes** the experience.

This document outlines 8 strategic adaptations for the LLM-assisted era, along with implementation priorities and cost estimates.

---

## Core Philosophy Shift

### Traditional MUD Design
> "Make systems hard enough that players need skill to master them"

### LLM-Era Design
> "Make systems **rich** enough that AI assistance enhances rather than trivializes the experience"

### Guiding Principles

1. **Don't fight AI usage** - It's unenforceable and wastes development effort
2. **Design for depth** - Complex systems where AI is a tool, not a solution
3. **Emphasize human strengths** - Social dynamics, creativity, trust, real-time coordination
4. **Make AI part of the game** - First-class features, not external cheating
5. **Reward skilled AI use** - Better prompts = better results = player skill expression

---

## Strategic Adaptations

## 1. AI-Assisted Character Building

### Concept
Integrate AI assistance directly into the game as a feature, rather than letting players use external tools that lack game context.

### Player Experience
```
> /assistant design my character

AI Assistant: "I see you want a mage focused on fire magic. Based on your
playstyle (analyzed from your combat logs), I recommend:

- Primary: Pyromancy (you favor aggressive playstyles)
- Secondary: Alchemy (synergizes with fire DoTs)
- Skip: Ice magic (you rarely use defensive abilities)

Should I allocate your skill points accordingly? [Yes/No/Customize]"
```

### Implementation

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| `/assistant` command | Small | None |
| Playstyle analytics | Medium | Combat/command logging |
| LLM integration | Small | LLM client library |
| Context building | Medium | Access to game balance data |

### Advantages
- Captures behavior that would happen externally anyway
- Your AI knows game balance; external AIs don't
- Creates differentiation (better assistant = competitive advantage)
- Reduces new player friction

### Risks
- May reduce perceived skill ceiling
- Cost of LLM API calls
- Requires careful prompt engineering to prevent exploits

---

## 2. Creative Expression Over Grinding

### Concept
Shift rewards from repetitive tasks (easily automated) to creative challenges that require genuine human creativity and context awareness.

### Traditional vs. Creative Quests

| Traditional Quest | Creative Quest | Why AI Can't Trivialize |
|-------------------|----------------|-------------------------|
| Kill 100 rats | Design a trap for the Rat King | Requires physics understanding + game lore |
| Collect 50 herbs | Create a unique potion recipe | Novelty + balance validation required |
| Find hidden treasure | Convince guardian you deserve it | NPC judges sincerity via context |
| Complete dialogue tree | Win the bard competition | Judged on originality + emotional impact |

### Implementation: Creative Quest System

```yaml
# Example: Bard Competition Quest
key: bard_competition
type: creative_quest
data:
  challenge: "Write a ballad about the Dragon War"
  constraints:
    - must_mention: ["Dragon King Azrath", "Battle of Crimson Fields"]
    - max_length: 500 words
    - must_rhyme: true
  judging:
    - npc_panel: [bard_guildmaster, court_poet, tavern_crowd]
    - criteria: [originality, lore_accuracy, emotional_impact]
    - ai_judge: true  # LLM scores on criteria
  rewards:
    gold: {1st: 1000, 2nd: 500, 3rd: 100}
    title: {1st: "Master Bard"}
```

### Technical Requirements

| Component | Effort | Technology |
|-----------|--------|------------|
| Creative quest framework | Medium | Extend quest system |
| AI judging system | Medium | LLM with scoring rubrics |
| Submission validation | Small | Text processing |
| Leaderboard/ranking | Small | ETS + DB |

### Advantages
- LLMs can help, but can't guarantee winning
- Rewards genuine creativity
- Infinite replayability
- Community-driven content

### Risks
- Subjective judging may feel unfair
- Need anti-gaming measures (plagiarism detection)
- Requires active moderation for inappropriate content

---

## 3. Social Puzzles and Politics

### Concept
Design systems where success depends on **social dynamics** that require human judgment, trust-building, and long-term reputation.

### Example: Guild Politics System

```
Your guild must decide:
- Ally with Merchants Guild (economic power) OR
- Ally with Warriors Guild (military power)

But:
- Your guild leader secretly loves the Merchant Queen
- Your best warrior hates merchants (his family was bankrupted)
- The Warriors Guild offered your rival a promotion
- Election for guild leader is in 3 days

What do you do?
```

### Why AI Can't Solve This

| Human Skill Required | AI Limitation |
|---------------------|---------------|
| Who to trust? | Can't read hidden motives |
| Who's lying? | No access to private information |
| Long-term reputation | Doesn't track social capital over time |
| Emotional dynamics | Lacks genuine empathy |
| Negotiation timing | Doesn't understand social context |

### Implementation: Social Graph System

| Component | Effort | Description |
|-----------|--------|-------------|
| Relationship tracking | Medium | Graph DB or ETS tables |
| Reputation scoring | Medium | Multi-dimensional reputation |
| Secret knowledge system | Large | Asymmetric information mechanics |
| Gossip/rumor propagation | Medium | PubSub-based spreading |
| Political mechanics | Large | Voting, alliances, betrayals |

### Advantages
- Highly resistant to automation
- Encourages genuine social gameplay
- Creates emergent narratives
- High engagement and retention

### Risks
- Complex to balance
- Requires critical mass of players
- Can create toxic dynamics if not moderated

---

## 4. Asymmetric Information Games

### Concept
Different players/NPCs have different information. AI can't solve what it doesn't know.

### Example: The Spy Game

```
You're a spy infiltrating the Royal Court.
- You know the Duke is embezzling
- The Duke knows YOU know
- The Queen suspects someone, but not who
- The Court Mage can detect lies, but the Duke doesn't know this
- You need 3 allies to expose the Duke safely

WHO do you trust? WHO do you tell?
```

### Implementation: Secrets System

```elixir
defmodule Loka.Framework.Secrets do
  @moduledoc """
  Entity-specific knowledge that's not globally visible.
  Secrets can be shared, traded, sold, or used for leverage.
  """

  # Store secret knowledge per entity
  def add_secret(entity_id, secret_key, secret_data)

  # Transfer knowledge to another entity
  def reveal_secret(entity_id, secret_key, to: target_id)

  # Check if entity knows something
  def knows_secret?(entity_id, secret_key)

  # List all who know a secret (for blackmail/leverage)
  def who_knows?(secret_key)
end
```

### Mechanics Table

| Mechanic | AI Resistance | Implementation Effort |
|----------|---------------|----------------------|
| Hidden information | High | Medium |
| Dynamic alliances | High | Medium |
| Lie detection | Medium | Large |
| Blackmail/leverage | High | Medium |
| Trust mechanics | Very High | Large |

### Advantages
- Fundamentally requires human social skills
- Creates dramatic moments
- High player agency
- Excellent for roleplay

### Risks
- Information leakage via Discord/external comms
- Complexity may confuse new players
- Requires careful balancing

---

## 5. Time-Pressure Mechanics

### Concept
LLMs need time to process. Design systems where **speed and coordination matter**.

### Example: Real-Time Zone Event

```
[SERVER BROADCAST]
The dragon is attacking Riverside Village!
Defenders have 5 minutes to organize before walls fall!

> /shout "Mages to the north gate! Warriors form shield wall!"
> give potion to warrior_jane
> cast haste on party

[2:34 remaining...]
```

### Event Types

| Event Type | Duration | AI Mitigation | Coordination Required |
|------------|----------|---------------|----------------------|
| Zone defense | 5-10 min | High | Very High |
| Boss raid mechanics | 2-3 min phases | High | High |
| Auction bidding | 30 sec per item | Medium | Medium |
| Timed puzzles | 3-5 min | Medium | Low |
| PvP combat | Real-time | Very High | Very High |

### Implementation

```elixir
defmodule Loka.Framework.ZoneEvents do
  @moduledoc """
  Real-time events that require coordinated player response.
  """

  def trigger_event(zone_id, event_type, duration_seconds) do
    # Start countdown timer
    # Broadcast to all players in zone
    # Track participation
    # Calculate success/failure based on player actions
    # Apply consequences (village saved/destroyed, NPCs live/die)
  end
end
```

### Advantages
- AI assistance useful but not decisive
- Encourages social play
- Creates memorable moments
- Natural resistance to automation

### Risks
- Timezone issues for global playerbase
- May disadvantage solo players
- Requires sufficient player density

---

## 6. Economic Complexity: AI as Trading Partner

### Concept
Make the economy so complex that AI assistance becomes a **feature** rather than exploitation.

### Example: Market Intelligence System

```
> /market analyze oak_logs

AI Assistant: "Oak log prices are crashing due to the Forest Peace treaty
(zone #23 now accessible). However, I predict a spike in 7 days when the
Duke's Festival requires oak barrels (event in calendar).

Recommendation:
- BUY: 500 oak logs at 8gp (current floor)
- HOLD: 6 days
- SELL: 1 day before festival at projected 25gp
- Risk: Medium (treaty could fail, festival could cancel)

Want me to set up automated buy orders?"
```

### Economic Systems Table

| System | Complexity | AI Value | Player Skill Expression |
|--------|------------|----------|------------------------|
| Supply/demand simulation | High | High | Reading market trends |
| Event-driven price changes | Medium | Medium | Anticipating events |
| Guild market manipulation | Very High | Low | Social coordination |
| Speculation/futures | Very High | High | Risk assessment |
| Crafting chains (10+ steps) | High | High | Optimization |

### Implementation

```elixir
defmodule Loka.Framework.Economy.Intelligence do
  @moduledoc """
  Provides market analysis data for AI assistants and players.
  """

  def analyze_market(item_key, opts \\ []) do
    %{
      current_price: get_current_price(item_key),
      price_history: get_price_history(item_key, days: 30),
      supply_sources: list_supply_sources(item_key),
      demand_drivers: list_demand_drivers(item_key),
      upcoming_events: relevant_events(item_key),
      predictions: forecast_price(item_key),
      risks: identify_risks(item_key)
    }
  end
end
```

### Advantages
- AI assistance adds depth rather than trivializing
- Better prompts = better advice = skill expression
- Social elements (guild manipulation) resist AI
- Infinite depth for optimization

### Risks
- May be too complex for casual players
- Requires active economy management
- Bot detection needed for trading

---

## 7. Collaborative Content Creation

### Concept
Let players use AI to **build content** for other players, with validation and moderation.

### Example: Player-Authored Quests

```
> /create quest

AI Assistant: "Let's design a quest together. What's the story?"

Player: "A merchant's son was kidnapped by bandits."

AI: "Great! I'll help with game mechanics. Where should it take place?"

Player: "The Darkwood."

AI: "I see Darkwood is a level 15-20 zone with bandit camps. I suggest:
- Quest level: 17
- Location: Bandit Camp #3 (north of Darkwood)
- Enemies: 3 bandits (level 16-18)
- Rescue objective: Find the son in the camp

What should the reward be? Standard would be 500 XP + 200 gold."

Player: "Add a unique item: a merchant's favor token."

AI: "Good idea! I'll create the token with +10% merchant discounts.
Should this quest require any prerequisites?"

[AI validates balance, generates YAML, submits for moderator approval]
```

### Content Creation Pipeline

| Stage | AI Role | Human Role | Moderation |
|-------|---------|------------|------------|
| Idea generation | Suggest mechanics | Creative vision | None |
| Balance validation | Auto-check | Approve/reject | None |
| Narrative writing | Draft dialogue | Edit/refine | Auto (toxicity) |
| Technical generation | Generate YAML | Review | Auto (format) |
| Approval | Flag issues | Final approve | Manual |
| Publication | Deploy | Announce | Community reports |

### Implementation

| Component | Effort | Description |
|-----------|--------|-------------|
| Quest builder UI | Large | Web-based creation tool |
| AI co-author | Medium | LLM integration for assistance |
| Balance validator | Large | Check rewards, difficulty, loot |
| YAML generator | Small | Template-based generation |
| Moderation queue | Medium | Admin approval workflow |
| Community voting | Medium | Let players rate quests |

### Advantages
- Infinite content generation
- Community engagement
- Reduced content creation burden
- AI ensures technical correctness

### Risks
- Quality control challenges
- Inappropriate content risk
- May flood game with low-quality quests
- Balancing community vs. developer authority

---

## 8. Meta-Game: AI Interaction as Gameplay

### Concept
Make the **AI interaction itself** part of the game mechanics.

### Example 1: NPC Turing Test

```
You enter a tavern. 10 patrons sit inside.
- 5 are AI NPCs
- 5 are human players (anonymous mode)

Your quest: Identify which are AI within 30 minutes by chatting.
Reward: 1000 XP if you correctly identify 4/5

[Player must ask questions, observe behavior, judge responses]
```

### Example 2: AI Detective

```
Murder mystery begins:
- 1 player is the murderer (knows they did it)
- 8 players are innocent (don't know who did it)
- 1 AI investigator (Claude) interrogates everyone
- Players can lie, deflect, roleplay

Can the AI catch the human liar? Can the liar fool the AI?
```

### Game Mode Ideas

| Mode | AI Role | Player Goal | Difficulty |
|------|---------|-------------|------------|
| Turing Test | Hidden NPC | Identify AI vs human | Medium |
| AI Detective | Interrogator | Lie convincingly | Hard |
| AI Dungeon Master | Story generator | Collaborative storytelling | Easy |
| AI Judge | Contest evaluator | Win creative competition | Medium |
| AI Merchant | Dynamic pricing | Negotiate best deal | Hard |

### Implementation Effort

| Component | Effort | Technology |
|-----------|--------|------------|
| Anonymous mode | Small | Session masking |
| AI NPC conversations | Medium | LLM with personality prompts |
| Detective logic | Large | Multi-turn interrogation system |
| Scoring/rewards | Small | Standard quest rewards |

### Advantages
- Turns AI into feature, not external tool
- Creates unique gameplay moments
- Educational (teaches AI capabilities/limits)
- High novelty factor

### Risks
- AI unpredictability may cause issues
- Requires careful prompt engineering
- May feel gimmicky if not well-executed

---

## Implementation Priorities

### Phase 1: Foundation (MVP)

| Feature | Effort | Cost/Month | Impact | Priority |
|---------|--------|------------|--------|----------|
| AI NPCs (Dynamic Dialogue) | Medium | $80 | Very High | **P0** |
| `/assistant` command | Small | $20 | High | **P0** |
| Creative quest framework | Medium | $0 | Medium | P1 |

**Total Phase 1**: 2-3 weeks, ~$100/month

### Phase 2: Depth Systems

| Feature | Effort | Cost/Month | Impact | Priority |
|---------|--------|------------|--------|----------|
| Social graph/reputation | Medium | $0 | High | **P0** |
| Secrets/asymmetric info | Large | $0 | Medium | P1 |
| Economic intelligence | Medium | $10 | Medium | P1 |

**Total Phase 2**: 4-6 weeks, ~$10/month

### Phase 3: Advanced Features

| Feature | Effort | Cost/Month | Impact | Priority |
|---------|--------|------------|--------|----------|
| Time-pressure events | Medium | $0 | High | **P0** |
| Player-created content | Large | $40 | Medium | P1 |
| Meta-game modes | Medium | $30 | Low | P2 |

**Total Phase 3**: 6-8 weeks, ~$70/month

### Cost Breakdown

**Assumptions**:
- 100 active players
- Average engagement patterns
- Claude Haiku for most operations ($0.25/$1.00 per MTok)
- Claude Sonnet for critical moments ($3/$15 per MTok)

| Feature | Requests/Hour | Cost/Hour | Cost/Month (24/7) |
|---------|---------------|-----------|-------------------|
| AI NPCs | 300 | $0.011 | $80 |
| `/assistant` | 50 | $0.003 | $20 |
| Creative judging | 20 | $0.005 | $40 |
| Economic analysis | 10 | $0.001 | $10 |
| Meta-games | 30 | $0.004 | $30 |
| **TOTAL** | **410** | **$0.024** | **$180** |

**Revenue comparison**: If 100 active players → ~20 paying subscribers at $10/month = $200/month revenue. **AI costs are sustainable**.

---

## Risk Mitigation Strategies

### 1. Cost Control

| Risk | Mitigation |
|------|------------|
| API costs spike | Rate limiting (1 req/5sec per player) |
| Abuse/farming | Request quotas, daily caps |
| Inefficient prompts | Cache identical contexts (ETS) |
| Expensive models | Use Haiku by default, Sonnet for critical paths |

### 2. Quality Control

| Risk | Mitigation |
|------|------------|
| Inappropriate content | Content filters, Claude's built-in safety |
| Inconsistent AI responses | Strong system prompts, validation layer |
| AI hallucinations | Fallback to scripted content on errors |
| Prompt injection | Sandboxed execution, action validation |

### 3. Gameplay Balance

| Risk | Mitigation |
|------|------------|
| AI too powerful | Design for AI-assisted play from start |
| AI trivializes content | Focus on social/creative/time-pressure mechanics |
| Pay-to-win perception | Free tier with limits, premium for convenience |
| Skill ceiling collapse | Reward prompt engineering skill |

### 4. Technical Reliability

| Risk | Mitigation |
|------|------------|
| LLM API downtime | Graceful degradation to scripted content |
| Latency issues | Async generation, loading indicators |
| Context limit exceeded | Summarization, priority context |
| State inconsistency | Validate AI outputs against game state |

---

## Success Metrics

### Player Engagement

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI feature adoption | >60% of active players | Usage logs |
| Creative quest submissions | 10+ per week | Submission queue |
| Social interaction depth | 5+ connections per player | Social graph |
| Retention improvement | +20% 30-day retention | Cohort analysis |

### Economic Viability

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI cost per player | <$2/month | LLM API bills |
| Premium conversion | >20% of active players | Subscription data |
| Net margin | >40% after AI costs | Revenue - costs |

### Content Quality

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI NPC satisfaction | >4.0/5.0 rating | Player surveys |
| Creative quest quality | >3.5/5.0 average | Community votes |
| Moderation burden | <5% rejection rate | Moderation queue |

---

## Open Questions for Deliberation

### Strategic

1. **Philosophy**: Should we embrace AI assistance as a core feature, or treat it as an optional enhancement?
2. **Monetization**: Should AI features be premium-only, or free with usage limits?
3. **Competition**: How do we prevent "AI arms race" where richest players win?
4. **Identity**: Does Loka want to be known as "the AI-enhanced MUD" or is that limiting?

### Design

5. **Balance**: What percentage of content should be AI-resistant vs AI-enhanced?
6. **Social**: How do we prevent AI from replacing human interaction?
7. **Creativity**: Can we validate "genuine creativity" programmatically?
8. **Fairness**: Is it fair that players with better prompt engineering skills have advantages?

### Technical

9. **Providers**: Claude (safer, better reasoning) vs OpenAI (cheaper, faster)?
10. **Caching**: How do we cache LLM responses without making NPCs feel robotic?
11. **Fallbacks**: What's acceptable degraded experience when AI is unavailable?
12. **Privacy**: How much player data should we feed to LLM context?

### Business

13. **Costs**: At what player scale does $180/month AI cost become unsustainable?
14. **Differentiation**: Is "AI-enhanced gameplay" a compelling marketing angle?
15. **Competition**: Will other MUDs copy this, eliminating the advantage?
16. **Legal**: Any ToS implications of using player data in LLM prompts?

---

## Next Steps

### Immediate Actions

1. **Prototype AI NPC system** - Build one conversational NPC to validate core concept
2. **Cost modeling** - Run real API calls to validate cost estimates
3. **Player survey** - Gauge interest in AI-assisted features
4. **Competitive analysis** - Research what other games are doing

### Research Needed

1. **LLM provider comparison** - Benchmark Claude vs GPT-4o vs Gemini for game use
2. **Prompt engineering** - Develop templates for NPCs, assistants, judges
3. **Caching strategies** - Measure cache hit rates for typical gameplay
4. **Safety testing** - Red-team AI systems for exploits and abuse

### Decisions Required

1. **Go/no-go on AI features** - Commit to AI-enhanced gameplay or stay traditional?
2. **Budget allocation** - How much monthly spend on AI is acceptable?
3. **Premium vs free** - Monetization model for AI features
4. **Timeline** - When should Phase 1 features launch?

---

## Related Documents

- [AI Resilience Strategy](./ai-resilience-strategy.md) - Defense against AI automation
- [Social Primitives](./social-primitives.md) - Building blocks for social gameplay
- [Monetization Ideas](./monetization-ideas.md) - Revenue model considerations
- [World Platform](./world-platform.md) - Long-term platform vision

---

## Appendix: Competitive Landscape

### Games Using AI

| Game | AI Feature | Implementation | Reception |
|------|------------|----------------|-----------|
| AI Dungeon | AI-generated stories | GPT-3 | Mixed (quality inconsistent) |
| Replica | Companion chatbot | Custom LLM | Positive (niche audience) |
| ChatGPT Adventures | Text RPG | GPT-4 | Experimental |
| Skyrim Mods | NPC dialogue | LLM integration | Early days |

**Observation**: Most are **story-focused**, few tackle **gameplay mechanics**. Opportunity for differentiation.

### What Makes Loka Different

1. **Game-first, AI-second** - AI enhances existing systems, not the core loop
2. **Hybrid approach** - Mix scripted and AI content strategically
3. **Social focus** - AI can't replace human connection
4. **Economic depth** - AI as trading tool, not replacement for gameplay
5. **Transparent** - AI usage is visible and part of the experience

---

## Conclusion

The LLM era presents both a **threat** (automation trivializing gameplay) and an **opportunity** (deep, AI-enhanced experiences).

By embracing AI as a **design constraint** rather than fighting it, Loka can create systems that are:
- **Richer** because AI handles repetitive tasks
- **More social** because AI can't replace human connection
- **More creative** because AI can't guarantee originality
- **More strategic** because better AI usage = player skill

The question isn't "Should we use AI?" but rather "How do we use AI to make a better game?"

This document provides a framework for that conversation.
