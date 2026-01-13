# Social Primitives

> Foundational building blocks for Loka's social systems. These primitives enable emergent social behavior and can be composed into higher-level systems.

---

## Table of Contents

1. [Communication Primitives](#communication-primitives)
2. [Expression Primitives](#expression-primitives)
3. [Presence Primitives](#presence-primitives)
4. [Relationship Primitives](#relationship-primitives)
5. [Group Primitives](#group-primitives)
6. [Notification Primitives](#notification-primitives)
7. [Identity Primitives](#identity-primitives)
8. [Interaction Primitives](#interaction-primitives)
9. [Persistence Primitives](#persistence-primitives)
10. [Witnessing Primitives](#witnessing-primitives)
11. [Space Primitives](#space-primitives)
12. [Meta Primitives](#meta-primitives)
13. [UI Primitives](#ui-primitives)
14. [Emergent Possibilities](#emergent-possibilities)
15. [Implementation Priority](#implementation-priority)
16. [Technical Notes](#technical-notes)

---

## Communication Primitives

### 1. Spatial Communication

```
┌─────────────────────────────────────────────────────────────┐
│ SPATIAL HIERARCHY                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Whisper ──► Adjacent ──► Room ──► Zone ──► World          │
│  (1 tile)   (neighbors)  (local)  (region)  (global)       │
│                                                             │
│  Each layer has different:                                  │
│  • Visibility (who sees)                                    │
│  • Persistence (how long)                                   │
│  • Cost (if any)                                            │
│  • Rate limits                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Primitives:**

| Primitive | Scope | Persistence | Notes |
|-----------|-------|-------------|-------|
| `say` | Room | Ephemeral | Everyone in room sees |
| `whisper` | 1 target in room | Ephemeral | Only target sees |
| `shout` | Adjacent rooms | Ephemeral | Bleeds to neighbors |
| `yell` | Zone | Ephemeral | Entire area hears |
| `ooc` | Room | Ephemeral | Out-of-character bracket |

### 2. Direct Communication

| Primitive | Scope | Persistence | Notes |
|-----------|-------|-------------|-------|
| `tell` | 1 player anywhere | Ephemeral | Private 1:1 |
| `reply` | Last teller | Ephemeral | Quick response |
| `retell` | Last tell target | Ephemeral | Continue conversation |
| `mail` | 1+ players | Persistent | Offline delivery |

### 3. Group Communication

| Primitive | Scope | Persistence | Notes |
|-----------|-------|-------------|-------|
| `party` | Party members | Ephemeral | Temporary group |
| `guild` | Guild members | Ephemeral | Persistent org |
| `channel` | Subscribers | Ephemeral | Topic-based |

---

## Expression Primitives

### 4. Emotes (Socials)

The classic MUD social system:

```
┌─────────────────────────────────────────────────────────────┐
│ EMOTE TYPES                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Intransitive:  "bow"    → "Raymond bows gracefully."        │
│ Targeted:      "bow Kim" → "Raymond bows to Kim."           │
│ Self:          "bow self"→ "Raymond bows to himself."       │
│ Custom:        "emote X" → "Raymond X"                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Categories (LegendMUD-style):**

| Category | Examples | Emotional Register |
|----------|----------|-------------------|
| Greeting | bow, wave, nod, salute, curtsey | Neutral/Formal |
| Affection | hug, kiss, pat, comfort, cuddle | Warm |
| Playful | poke, tickle, wink, nudge, tease | Light |
| Aggressive | glare, growl, snarl, threaten | Hostile |
| Emotional | cry, laugh, sigh, groan, cheer | Expressive |
| Physical | sit, stand, kneel, stretch, yawn | Action |
| Social | thank, apologize, agree, disagree | Interaction |
| Respect | honor, praise, salute, toast | Formal positive |
| Contempt | sneer, scoff, dismiss, ignore | Formal negative |

### 5. Moods

Persistent emotional state that colors actions:

```yaml
mood_system:
  available_moods:
    - neutral      # Default
    - cheerful     # "Raymond cheerfully waves."
    - melancholy   # "Raymond waves sadly."
    - fierce       # "Raymond waves fiercely."
    - distracted   # "Raymond absently waves."
    - formal       # "Raymond formally waves."
    - playful      # "Raymond playfully waves."
    - weary        # "Raymond wearily waves."

  mechanics:
    - persists_until_changed
    - visible_to_others: "Raymond seems melancholy."
    - modifies_all_emotes
    - affects_combat_messages: optional
```

### 6. Poses (Persistent Emotes)

```yaml
pose_system:
  description: "Visible state that persists in room description"

  example:
    command: "pose sits cross-legged, eyes closed in meditation"
    result: "Raymond sits cross-legged, eyes closed in meditation."

  visibility:
    - appears_in_room_description
    - clears_on_movement
    - clears_on_action
    - can_be_manually_cleared
```

### 7. Custom Reactions (Emoji Equivalent)

```yaml
reaction_system:
  description: "Quick responses to messages/events"

  built_in:
    - nod        # Agreement
    - shake      # Disagreement
    - shrug      # Uncertainty
    - applaud    # Approval
    - frown      # Disapproval

  purchasable_sets:
    eastern_expressions:
      - kowtow
      - namaste
      - gassho
      - seiza

    noble_expressions:
      - curtsey_deep
      - flourish
      - sniff_disdainfully

    warrior_expressions:
      - salute_fist
      - battle_cry
      - kneel_in_defeat
```

---

## Presence Primitives

### 8. Awareness

```yaml
presence_primitives:
  who:
    description: "List online players"
    variants:
      - who              # All online
      - who friends      # Friends only
      - who guild        # Guild members
      - who zone         # Same area

  where:
    description: "Location of known players"
    constraints:
      - friends_only
      - can_be_hidden
      - permission_based

  look:
    description: "See who's in current room"
    shows:
      - player_names
      - poses
      - visible_status

  scan:
    description: "See adjacent rooms"
    shows:
      - room_names
      - player_counts
```

### 9. Status

```yaml
status_system:
  availability:
    - available      # Default, open to interaction
    - busy          # In combat/dialogue, auto-set
    - away          # AFK, manual set
    - hidden        # Invisible to who list
    - do_not_disturb # Blocks tells

  custom_status:
    description: "Short text visible to friends"
    example: "Training in the dojo"
    max_length: 50

  last_seen:
    description: "When player was last active"
    visibility: "friends_only"
```

---

## Relationship Primitives

### 10. Connections

```yaml
relationship_primitives:
  friend:
    description: "Mutual connection"
    requires: "both_accept"
    enables:
      - see_online_status
      - see_location
      - priority_tells
      - friend_chat_channel

  acquaintance:
    description: "One-way awareness"
    requires: "unilateral"
    enables:
      - see_online_status
      - notes_on_player

  block:
    description: "Prevent interaction"
    effects:
      - no_tells_received
      - no_emotes_received
      - hidden_from_your_who

  trust:
    description: "Grant permissions"
    levels:
      - can_see_location
      - can_enter_home
      - can_access_storage
      - can_speak_for_me
```

### 11. Follow/Lead

```yaml
follow_system:
  follow:
    description: "Automatically move with target"
    requires: "same_room"
    behavior:
      - follows_movement
      - can_unfollow_anytime
      - leader_notified

  lead:
    description: "Invite to follow"
    creates: "implicit_party"

  formation:
    description: "Group movement pattern"
    options:
      - single_file
      - cluster
      - protective (tank front)
```

---

## Group Primitives

### 12. Party (Temporary Group)

```yaml
party_system:
  formation:
    - invite_player
    - accept_invite
    - auto_forms_on_accept

  properties:
    max_size: 6
    leader: "inviter_initially"
    chat_channel: "automatic"

  features:
    - shared_experience: optional
    - shared_loot: configurable
    - formation_positioning
    - ready_check

  dissolution:
    - leader_disbands
    - all_leave
    - timeout_after_separation
```

### 13. Guild (Persistent Organization)

```yaml
guild_system:
  formation:
    requires:
      - founding_members: 5
      - charter_written
      - name_unique

  structure:
    ranks:
      - leader
      - officer
      - member
      - initiate

    permissions_per_rank:
      - invite_members
      - kick_members
      - access_vault
      - edit_motd
      - promote_members

  features:
    - guild_chat
    - guild_vault (shared storage)
    - guild_hall (physical space)
    - guild_bank (shared currency)
    - guild_log (activity history)
    - guild_motd (message of the day)
    - guild_roster
```

### 14. Channels (Topic Groups)

```yaml
channel_system:
  types:
    public:
      description: "Anyone can join"
      examples: [trade, newbie, roleplay, pvp]

    private:
      description: "Invite only"
      examples: [guild_officer, raid_planning]

    system:
      description: "Auto-subscribed"
      examples: [announcements, events]

  operations:
    - join channel
    - leave channel
    - list channels
    - who channel
    - channel message

  moderation:
    - channel_owner
    - channel_mods
    - mute_player
    - ban_player
```

---

## Notification Primitives

### 15. Alerts

```yaml
notification_system:
  categories:
    presence:
      - friend_online
      - friend_offline
      - guild_member_online
      - player_enters_room
      - player_leaves_room

    social:
      - mentioned_in_chat
      - tell_received
      - mail_received
      - party_invite
      - guild_invite

    game:
      - combat_started
      - quest_update
      - item_received
      - level_up

  controls:
    - enable/disable per category
    - do_not_disturb mode
    - priority levels
```

---

## Identity Primitives

### 16. Profile

```yaml
profile_system:
  visible_always:
    - name
    - title (if set)
    - guild (if public)
    - visible_equipment

  visible_on_look:
    - description (player-written)
    - mood
    - pose
    - status

  visible_to_friends:
    - location
    - last_seen
    - bio (extended)

  visible_on_inspect:
    - achievements (selected)
    - reputation_summary
    - lineage (if mentorship exists)
```

### 17. Titles

```yaml
title_system:
  types:
    earned:
      description: "Achievement-based"
      examples:
        - "the Dragonslayer"
        - "Defender of Millbrook"
        - "Master Smith"

    granted:
      description: "Given by authority"
      examples:
        - "Knight of the Realm"
        - "Elder of the Council"

    purchased:
      description: "Vanity titles"
      examples:
        - "the Magnificent"
        - "the Mysterious"

    guild:
      description: "From guild rank"
      examples:
        - "of the Iron Brotherhood"
        - ", Guildmaster of Weavers"

  display:
    - one_active_title
    - appears_with_name
    - can_be_hidden
```

---

## Interaction Primitives

### 18. Object Interactions

```yaml
interaction_primitives:
  give:
    description: "Transfer item to player"
    requires: "same_room, target_accepts"
    variants:
      - give item to player
      - give all.item to player
      - give coins to player

  trade:
    description: "Mutual exchange"
    process:
      - initiate_trade
      - add_items
      - add_coins
      - confirm
      - complete

  show:
    description: "Display item without giving"
    effect: "Target sees item description"

  point:
    description: "Reference something in room"
    effect: "Highlights for all in room"
```

### 19. Reference System

```yaml
reference_system:
  description: "Mention players/things in messages"

  syntax:
    - "@player" in say/tell
    - "#item" for objects
    - "^location" for places

  effects:
    - target_notified (if player)
    - creates_link (clickable)
    - logged_for_context
```

---

## Persistence Primitives

### 20. Mail System

```yaml
mail_system:
  operations:
    - compose (to, subject, body)
    - send
    - read
    - reply
    - forward
    - delete
    - attach_item (optional)
    - attach_coins (optional)

  features:
    - offline_delivery
    - notification_on_login
    - inbox_limit
    - sent_folder

  anti_spam:
    - rate_limit
    - block_list_respected
    - report_spam
```

### 21. Boards (Persistent Public Messages)

```yaml
board_system:
  types:
    - town_board (per location)
    - guild_board (per guild)
    - trade_board (global)
    - story_board (creative)

  operations:
    - read board
    - post to board
    - reply to post
    - remove post (author/mod)

  features:
    - threaded_replies
    - sticky_posts
    - moderation
    - expiration
```

### 22. Journal (Private Persistent)

```yaml
journal_system:
  description: "Player's private notes"

  operations:
    - write entry
    - read entries
    - search entries
    - tag entries

  features:
    - date_stamped
    - searchable
    - unlimited (or large limit)
    - export_option

  potential_sharing:
    - share_entry_with_player
    - make_entry_public (posthumously)
```

---

## Witnessing Primitives

### 23. Witness System

```yaml
witness_system:
  description: "Presence creates record"

  auto_witnessed:
    - deaths
    - achievements
    - rank_changes
    - major_trades

  explicit_witnessing:
    command: "witness"
    effect: "Formally records your presence"
    uses:
      - oaths
      - ceremonies
      - agreements
      - trials

  witness_record:
    - stored_permanently
    - queryable_later
    - affects_validity
```

### 24. Oath System

```yaml
oath_system:
  description: "Promises with weight"

  mechanics:
    - declare_oath (public statement)
    - requires_witnesses (min 1)
    - tracked_by_system
    - breaking_visible

  consequences:
    kept_oath:
      - reputation_increase
      - visible_achievement
      - trust_building

    broken_oath:
      - reputation_damage
      - visible_shame
      - recorded_permanently

  types:
    - personal_vow
    - promise_to_player
    - guild_oath
    - sacred_oath (extra weight)
```

---

## Space Primitives

### 25. Personal Space

```yaml
personal_space:
  types:
    room:
      description: "Player's private room"
      features:
        - always_accessible
        - decoratable
        - guest_list
        - storage

    home:
      description: "Larger personal space"
      features:
        - multiple_rooms
        - furniture
        - guest_permissions
        - address_in_world

  permissions:
    - can_enter (friend list)
    - can_modify (owner only)
    - can_use_storage (trust level)
```

### 26. Shared Space

```yaml
shared_space:
  types:
    guild_hall:
      owner: "guild"
      permissions: "by_rank"
      features:
        - meeting_room
        - vault_access
        - craft_stations

    rented_venue:
      owner: "renter_temporary"
      uses:
        - events
        - weddings
        - ceremonies
        - parties
```

---

## Meta Primitives

### 27. Ignore/Block

```yaml
block_system:
  levels:
    soft_ignore:
      - no_tells
      - no_emotes_to_you
      - still_see_room_say

    hard_block:
      - no_tells
      - no_emotes
      - no_room_say
      - hidden_from_each_other

  management:
    - add_to_block
    - remove_from_block
    - list_blocked
```

### 28. Report

```yaml
report_system:
  types:
    - harassment
    - cheating
    - bug_exploit
    - spam

  process:
    - submit_report (with context)
    - auto_log_recent_messages
    - sent_to_moderators
    - anonymized_feedback
```

---

## UI Primitives

### 29. Communication Pane

```yaml
communication_pane:
  tabs:
    - room (local chat)
    - party (if in party)
    - guild (if in guild)
    - tells (private messages)
    - channels (subscribed)

  features:
    - tab_notifications (unread count)
    - scroll_history
    - clickable_names
    - timestamp_toggle
    - filter_by_type
```

### 30. Social Pane

```yaml
social_pane:
  sections:
    friends:
      - online_friends (top)
      - offline_friends (collapsed)
      - friend_requests

    party:
      - current_members
      - health_bars
      - ready_status

    guild:
      - online_members
      - recent_activity
      - guild_motd

  actions_per_player:
    - tell
    - invite
    - inspect
    - add_friend
    - block
```

---

## Emergent Possibilities

These primitives enable emergent systems:

| Primitives Combined | Emergent System |
|---------------------|-----------------|
| oath + witness + reputation | Trust networks |
| party + shared_space + board | Raid guilds |
| mail + journal + witness | Legal contracts |
| emote + mood + pose | Roleplay culture |
| channel + board + vote | Democratic governance |
| title + oath + lineage | Honor systems |
| give + witness + reputation | Gift economies |
| block + report + reputation | Community moderation |

---

## Implementation Priority

### Tier 1: Foundation (Implement First)

1. **say/tell/reply** - Basic communication
2. **emotes (20-30 basic)** - Expression
3. **who/look** - Presence awareness
4. **friend/block** - Relationship basics
5. **party chat** - Group communication
6. **communication pane** - UI for messages

### Tier 2: Depth (Second Phase)

7. **moods** - Expressive enhancement
8. **poses** - Persistent expression
9. **channels** - Topic groups
10. **mail** - Async communication
11. **guild basics** - Persistent orgs
12. **social pane** - UI for relationships

### Tier 3: Emergence (Third Phase)

13. **witness system** - Weight to presence
14. **oath system** - Promises matter
15. **boards** - Persistent public messages
16. **journal** - Private persistence
17. **titles** - Identity expression
18. **custom reactions** - Purchasable expression

### Tier 4: Richness (Ongoing)

19. **additional emote sets** - Vanity purchases
20. **personal space** - Player rooms
21. **shared space** - Guild halls
22. **profile expansion** - Rich identity

---

## Technical Notes

### Message Routing Architecture

```elixir
defmodule Loka.Framework.Social.Router do
  @doc """
  Routes messages based on scope and permissions.
  """
  def route(message, scope) do
    case scope do
      :room -> broadcast_to_room(message)
      :party -> broadcast_to_party(message)
      :guild -> broadcast_to_guild(message)
      :tell -> send_to_player(message)
      :channel -> broadcast_to_channel(message)
      :zone -> broadcast_to_zone(message)
    end
  end
end
```

### Component Structure

```yaml
# Base player social components
components:
  communication:
    channels: []
    muted_channels: []
    tell_history: []

  relationships:
    friends: []
    blocked: []
    trust_levels: {}

  expression:
    current_mood: "neutral"
    current_pose: null
    unlocked_emotes: []
    unlocked_reactions: []

  social_status:
    availability: "available"
    custom_status: null
    do_not_disturb: false

  group:
    party_id: null
    guild_id: null
```

### PubSub Topics

```elixir
# Social message topics
"room:#{room_id}"           # Room-local messages
"party:#{party_id}"         # Party chat
"guild:#{guild_id}"         # Guild chat
"channel:#{channel_name}"   # Named channels
"player:#{player_id}"       # Direct messages (tells)
"zone:#{zone_id}"           # Zone-wide announcements
```

---

## Related Documents

- [AI Resilience Strategy](./ai-resilience-strategy.md) - Why social systems matter for bot resistance
- [Living School Vision](./living-school-vision.md) - Higher-level social design philosophy
