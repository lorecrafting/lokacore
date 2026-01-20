# MMORPG Operations Guide

This guide covers operational considerations for running Loka as a living, breathing MMORPG world.

## Table of Contents

1. [Server Lifecycle](#server-lifecycle)
2. [Player Connection Management](#player-connection-management)
3. [Infrastructure Operations](#infrastructure-operations)
4. [Living World Systems](#living-world-systems)
5. [GM/Admin Tools](#gmadmin-tools)
6. [Operational Cadence](#operational-cadence)

---

## Server Lifecycle

### What Survives a Restart

| Data Type | Persistence | Notes |
|-----------|-------------|-------|
| Player accounts | Database | Always persisted |
| Player game state | Database | Inventory, quests, flags, location |
| World content | YAML files | NPCs, items, rooms, quests |
| Active combat | Lost | Players exit combat state |
| NPC conversations | Lost | Dialogue resets |
| Temporary spawns | Lost | Re-spawned from zone definitions |

### Player Experience During Restart

Current implementation:
- WebSocket disconnects immediately
- Phoenix LiveView auto-reconnects with exponential backoff
- Visual overlay shows "Connection lost... reconnecting"
- On reconnect, player returns to last saved location

### Graceful Shutdown Considerations

For zero-downtime deployments:
1. **Warning broadcast** - Alert players before restart
2. **Safe state save** - Force-save all player states
3. **Rolling restart** - If multi-node, drain connections first
4. **Post-restart validation** - Verify world state integrity

---

## Player Connection Management

### Current Implementation

**Web Client (`assets/js/app.js`):**
- ConnectionStatus hook shows visual overlay during disconnect
- Messages: "[Connection lost... reconnecting]" and "[Connection restored]"
- CSS overlay with semi-transparent background

**Mobile Client (`mobile/src/hooks/usePhoenix.ts`):**
- Exponential backoff: 1s → 2s → 4s → ... → 30s max
- Automatic reconnection with token refresh
- Channel rejoin on socket reconnect

### Future Improvements

- [ ] Maintenance mode announcement before planned restarts
- [ ] Estimated downtime display
- [ ] Queue position during high load
- [ ] "While you were away" summary on reconnect

---

## Infrastructure Operations

### 1. Global Broadcasts

**Purpose:** System-wide announcements to all connected players.

**Use Cases:**
- Maintenance warnings
- Server events
- Emergency notifications
- World events (dragon attack, festival starting)

**Implementation Location:** `lib/loka/framework/broadcast/`

**API Design:**
```elixir
Broadcast.to_all("Server restart in 5 minutes!")
Broadcast.to_zone("eldoria", "A dragon has been spotted!")
Broadcast.to_players(player_ids, "Your guild has leveled up!")
```

### 2. Maintenance Mode

**Purpose:** Graceful handling of planned downtime.

**Features:**
- Prevent new logins while allowing existing sessions
- Countdown timer to shutdown
- Force-save all player states
- Display maintenance message to new connection attempts

**Implementation Location:** `lib/loka/framework/maintenance/`

### 3. Automated Backups

**Purpose:** Protect player data and world state.

**Strategy:**
- SQLite database: Daily full backup, hourly WAL checkpoints
- YAML content: Git-based versioning (already in place)
- Player states: Periodic snapshots during peak hours

**Fly.io Considerations:**
- Use `fly volumes snapshots` for volume backups
- Store backups in external storage (S3, R2)
- Test restore procedures regularly

### 4. Content Versioning

**Purpose:** Track and rollback content changes.

**Current State:**
- YAML files in git provide natural versioning
- `TypedObject.Loader.reload()` for hot-reloading

**Improvements:**
- Admin UI to view content change history
- One-click rollback to previous version
- Content staging environment before production push

### 5. Hot Reload System

**Current:** `mix loka.reload` reloads YAML content.

**Improvements:**
- Admin UI button to trigger reload
- Selective reload (specific zones, NPCs, quests)
- Validation before reload (prevent broken content)
- Audit log of reload events

---

## Living World Systems

### 1. NPC Schedules

**Purpose:** NPCs follow daily routines, making the world feel alive.

**Design:**
```yaml
# priv/world/prototypes/npcs/merchant_tom.yml
schedule:
  - time: "06:00"
    action: wake_up
    location: merchant_house_bedroom
  - time: "07:00"
    action: move_to
    location: market_square
    dialogue: "Good morning! Shop's open!"
  - time: "19:00"
    action: move_to
    location: tavern
    dialogue: "Time for a drink..."
  - time: "22:00"
    action: move_to
    location: merchant_house_bedroom
```

**Implementation:** `lib/loka/framework/schedule/`

### 2. World Events

**Purpose:** Dynamic events that affect the world state.

**Event Types:**
- **Scheduled:** Festivals, seasons, holidays
- **Triggered:** Player actions cause world changes
- **Random:** Wandering monsters, weather, merchant caravans

**Design:**
```yaml
# priv/world/events/harvest_festival.yml
event:
  name: "Harvest Festival"
  schedule:
    type: annual
    month: 9
    duration_days: 7
  effects:
    - spawn_npcs: ["festival_merchant", "juggler", "bard"]
    - zone_decorations: "harvest"
    - shop_discounts: 20%
  quests:
    - harvest_festival_intro
    - pumpkin_hunt
```

### 3. Time-Sensitive Content

**Purpose:** Content that changes based on in-game or real-world time.

**Examples:**
- Vampire NPCs only appear at night
- Certain quests available only during events
- Shop inventory rotates weekly
- Daily quests reset at midnight

**Implementation:** Time-aware spawn conditions in YAML.

### 4. "While You Were Away" System

**Purpose:** Show players what happened while offline.

**Tracked Events:**
- Guild activity
- Friend online/offline
- Quest progress (passive income, crafting completion)
- World events they missed
- Messages received

**Display:** Modal on login with summary.

### 5. Dynamic Content Spawning

**Purpose:** World population adjusts to player activity.

**Mechanics:**
- Popular zones get more NPCs/monsters
- Abandoned zones "grow wild" (more aggressive spawns)
- Economy adjusts based on player trading

---

## GM/Admin Tools

### 1. Real-Time Dashboard

**Location:** `/admin` (requires admin role)

**Current Features:**
- Player count and list
- Entity browser
- Script viewer

**Needed Features:**
- Live player map (who's where)
- Server health metrics (memory, connections, message queue)
- Active quest tracking
- Economic indicators (gold in circulation, popular items)

### 2. Broadcast UI

**Purpose:** Send messages to players from admin panel.

**Features:**
- Target: All players, specific zone, specific players
- Message styling: System, event, emergency
- Scheduling: Send now or schedule for later
- History: Log of past broadcasts

### 3. Player Management

**Features:**
- View player details (stats, inventory, quests, flags)
- Teleport player to location
- Grant/revoke items
- Reset quest progress
- Temporary bans (timeout)
- Permanent bans with reason

### 4. Event Scheduling UI

**Purpose:** Schedule and manage world events.

**Features:**
- Calendar view of upcoming events
- Create/edit events with start/end times
- Preview event effects
- Cancel or extend running events

### 5. Content Management

**Purpose:** Edit world content from admin UI.

**Current:** World Builder for rooms, NPCs, items.

**Needed:**
- Quest editor (currently YAML-only)
- Dialogue editor (in World Builder)
- Zone editor (spawn rules, boundaries)

---

## Operational Cadence

### Daily Operations

| Task | Frequency | Owner |
|------|-----------|-------|
| Check server health | Morning | Auto-monitored |
| Review error logs | Morning | Dev |
| Process player reports | As needed | GM |
| Daily quest rotation | Automated | System |

### Weekly Operations

| Task | Frequency | Owner |
|------|-----------|-------|
| Content update review | Monday | Content team |
| Player feedback review | Wednesday | PM |
| Performance analysis | Friday | Dev |
| Backup verification | Sunday | Automated |

### Monthly Operations

| Task | Frequency | Owner |
|------|-----------|-------|
| Major content release | 1st of month | Content team |
| Balance review | Mid-month | Design |
| Security audit | End of month | Dev |
| Player census/analytics | End of month | PM |

### Event Operations

**Before Event:**
1. Test event content in staging
2. Schedule broadcast announcements
3. Prepare rollback plan

**During Event:**
1. Monitor server performance
2. Watch for exploits/bugs
3. Engage with community

**After Event:**
1. Collect metrics (participation, completion rates)
2. Archive event content or disable
3. Post-mortem review

---

## Monitoring & Alerts

### Key Metrics

| Metric | Warning | Critical |
|--------|---------|----------|
| Memory usage | 80% | 95% |
| Active connections | 80% capacity | 95% capacity |
| Response time (p95) | 500ms | 1000ms |
| Error rate | 1% | 5% |
| Database connections | 80% pool | 95% pool |

### Alert Channels

- **Fly.io Metrics:** Built-in monitoring dashboard
- **Application Logs:** Structured logging with Logger
- **External:** Consider Sentry for error tracking

### Incident Response

1. **Detect:** Automated alerts or player reports
2. **Assess:** Determine severity and scope
3. **Communicate:** Broadcast to affected players
4. **Mitigate:** Fix or rollback
5. **Post-mortem:** Document and prevent recurrence

---

## Security Considerations

### Player Safety

- Rate limiting on auth endpoints (3 registrations/hour)
- JWT tokens with short TTL (1 hour access, 7 day refresh)
- Input sanitization in all player-facing inputs
- Sandboxed scripting (no dangerous module access)

### Admin Safety

- Admin routes require `:admin` role
- Audit logging for admin actions
- Two-factor authentication (future)

### Content Safety

- Script validation before execution
- YAML schema validation on load
- Prototype inheritance limits (prevent infinite loops)

---

## Appendix: Implementation Priorities

### Phase 1: Foundation (Current)
- [x] Auto-reconnect with visual feedback
- [x] YAML persistence for World Builder
- [ ] Global broadcast system
- [ ] Maintenance mode

### Phase 2: Living World
- [ ] NPC schedule system
- [ ] Time-based spawn conditions
- [ ] World events framework

### Phase 3: GM Tools
- [ ] Real-time dashboard improvements
- [ ] Broadcast UI
- [ ] Player management tools

### Phase 4: Polish
- [ ] "While you were away" system
- [ ] Event scheduling UI
- [ ] Content versioning UI
