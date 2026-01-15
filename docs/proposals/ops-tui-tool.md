# Operations TUI Tool - Proposal

> **Status**: Proposal (not yet implemented)
> **Issue**: TBD
> **Last Updated**: 2025-01-14

## Problem Statement

Production operations currently require:
1. SSH into Fly.io: `fly ssh console -a loka`
2. Open IEx shell: `/app/bin/loka remote`
3. Type Elixir commands from memory

This workflow has several problems:
- **Error-prone**: No autocomplete, easy to mistype critical commands
- **No safety rails**: No confirmation before dangerous operations
- **Requires memorization**: Operators must remember exact function names and arguments
- **Poor mobile access**: Typing Elixir on phone keyboard is painful
- **No visual feedback**: Can't easily see server state while operating

### When Web Dashboards Don't Work

| Scenario | Why Web Fails | TUI Works |
|----------|---------------|-----------|
| Bastion host access | No browser available | SSH works |
| Phone/tablet (Termius) | Browser is awkward | Native terminal |
| Low bandwidth | Heavy JS assets | Text only (~1KB/screen) |
| During outages | Web app may be down | Direct SSH access |
| Security lockdown | Don't want HTTP exposed | SSH-only access |
| Emergency response | Auth may be broken | SSH keys always work |

## Proposed Solution

Build a Terminal User Interface (TUI) using **Bubbletea** (Go) that provides menu-driven access to common operations tasks. The TUI connects to a lightweight Operations API endpoint on the Phoenix server.

### Key Principle

The TUI is for **operations**, not content editing. Content editing stays in the web-based World Builder where visual tools excel.

## Design Details

### Feature Set

#### 1. Operations Dashboard

```
┌─ Loka Operations ─────────────────────────────────────────┐
│                                                           │
│  Server: loka.fly.dev          Uptime: 3d 14h 22m        │
│  Players Online: 47            Memory: 1.2GB / 2GB       │
│                                                           │
│  ┌─ Quick Actions ──────────────────────────────────────┐│
│  │  [B] Broadcast Message      [R] Reload Content       ││
│  │  [S] Shutdown (graceful)    [M] Maintenance Mode     ││
│  │  [L] Live Sessions          [Q] Query Player         ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  Recent Events:                                           │
│  • 14:32 - Player "Kira" completed Monastery Arc         │
│  • 14:28 - Content reloaded (3 quests, 12 dialogues)     │
│  • 14:15 - Player "Marcus" reported bug #1247            │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

#### 2. Emergency Broadcast

```
┌─ Broadcast Message ───────────────────────────────────────┐
│                                                           │
│  Type: [●] System  [ ] Event  [ ] Maintenance            │
│                                                           │
│  Message:                                                 │
│  ┌───────────────────────────────────────────────────────┐│
│  │ Server restart in 5 minutes. Please find a safe      ││
│  │ location to log out.                                 ││
│  └───────────────────────────────────────────────────────┘│
│                                                           │
│  Preview:                                                 │
│  [SYSTEM] Server restart in 5 minutes. Please find a     │
│           safe location to log out.                      │
│                                                           │
│  Recipients: 47 online players                           │
│                                                           │
│  [ Cancel ]                              [ Send (Enter) ] │
└───────────────────────────────────────────────────────────┘
```

#### 3. Content Reload with Diff Preview

```
┌─ Reload Content ──────────────────────────────────────────┐
│                                                           │
│  Changes detected:                                        │
│                                                           │
│  Quests:                                                  │
│    ~ monastery_final_trial (modified)                    │
│    + new_player_tutorial (added)                         │
│                                                           │
│  Dialogues:                                               │
│    ~ elder_greeting (modified)                           │
│    - old_unused_dialogue (removed)                       │
│                                                           │
│  Prototypes:                                              │
│    ~ guard_captain (modified: +5 HP, +2 damage)          │
│                                                           │
│  ⚠️  2 players currently in monastery_final_trial quest  │
│                                                           │
│  [ Cancel ]                    [ Reload All (Enter) ]    │
└───────────────────────────────────────────────────────────┘
```

#### 4. Graceful Shutdown Wizard

```
┌─ Graceful Shutdown ───────────────────────────────────────┐
│                                                           │
│  Step 2 of 4: Notify Players                             │
│                                                           │
│  ✓ Step 1: Disable new logins                            │
│  → Step 2: Broadcast warning (5 min countdown)           │
│    Step 3: Save all player data                          │
│    Step 4: Shutdown server                               │
│                                                           │
│  Countdown: 4:32 remaining                               │
│  Players still online: 23 (was 47)                       │
│                                                           │
│  Recent disconnects:                                      │
│    • Kira logged out gracefully                          │
│    • Marcus logged out gracefully                        │
│    • (18 more...)                                        │
│                                                           │
│  [ Abort Shutdown ]              [ Skip to Step 3 ]      │
└───────────────────────────────────────────────────────────┘
```

#### 5. Live Session Monitor

```
┌─ Live Sessions ───────────────────────────────────────────┐
│                                                           │
│  47 players online                    Filter: [_______]  │
│                                                           │
│  Player          Location           Status    Duration   │
│  ────────────────────────────────────────────────────────│
│  Kira            monastery_garden   Idle      2h 14m    │
│  Marcus          town_square        In Combat 0h 03m    │
│  Elena           elder_hut          Dialogue  0h 45m    │
│  ...                                                     │
│                                                           │
│  [D] Disconnect Player  [M] Message Player  [W] Watch   │
│                                                           │
│  ↑/↓ Navigate  Enter: Select  Q: Back                   │
└───────────────────────────────────────────────────────────┘
```

#### 6. Player Query Tool

```
┌─ Query Player ────────────────────────────────────────────┐
│                                                           │
│  Search: [marcus_______________]                         │
│                                                           │
│  ┌─ Marcus (ID: 12847) ─────────────────────────────────┐│
│  │  Status: Online (monastery_garden)                   ││
│  │  Level: 12    Gold: 1,247    Playtime: 47h          ││
│  │                                                      ││
│  │  Active Quests:                                      ││
│  │    • monastery_final_trial (Step 3/5)               ││
│  │    • herb_gathering (2/5 herbs)                     ││
│  │                                                      ││
│  │  Flags: caught_stealing, talked_to_elder            ││
│  │  Last Login: 2 hours ago                            ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  [G] Give Item  [T] Teleport  [F] Set Flag  [K] Kick    │
└───────────────────────────────────────────────────────────┘
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT OPTIONS                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Option A: Local TUI + SSH Tunnel                          │
│  ┌────────────────┐                                        │
│  │ loka-ops (Go)  │ ← Runs on operator's machine           │
│  │ Bubbletea TUI  │                                        │
│  └───────┬────────┘                                        │
│          │ SSH tunnel (fly proxy)                          │
│          ▼                                                 │
│  ┌────────────────┐                                        │
│  │ Fly.io Server  │                                        │
│  │ localhost:4000 │                                        │
│  └───────┬────────┘                                        │
│          │ HTTP/JSON                                       │
│          ▼                                                 │
│  ┌────────────────┐                                        │
│  │ Phoenix App    │                                        │
│  │ /api/ops/*     │ ← Internal operations API              │
│  └────────────────┘                                        │
│                                                             │
│  Option B: Server-side Mix Task                            │
│  ┌────────────────┐                                        │
│  │ Operator       │                                        │
│  │ (any terminal) │                                        │
│  └───────┬────────┘                                        │
│          │ fly ssh console                                 │
│          ▼                                                 │
│  ┌────────────────┐                                        │
│  │ Fly.io Server  │                                        │
│  │ mix loka.ops   │ ← Elixir TUI (Ratatouille)            │
│  └───────┬────────┘                                        │
│          │ Direct function calls                           │
│          ▼                                                 │
│  ┌────────────────┐                                        │
│  │ Loka App       │                                        │
│  │ (same BEAM)    │                                        │
│  └────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Choice: Go vs Elixir

| Factor | Go (Bubbletea) | Elixir (Ratatouille) |
|--------|----------------|----------------------|
| **Maturity** | ★★★★★ Excellent | ★★★ Good |
| **Distribution** | Single binary | Requires Elixir runtime |
| **Local dev** | Works without server | Needs SSH to server |
| **Performance** | Excellent | Good enough |
| **Code reuse** | New codebase | Shares types with server |

**Recommendation**: Start with **Elixir (Ratatouille)** as `mix loka.ops` task.

Rationale:
- Faster to build (reuse existing Elixir knowledge)
- Direct access to app state (no API needed initially)
- Can always extract to Go binary later if needed
- Ratatouille is actively maintained and sufficient for our needs

### Operations API Endpoints

For the Go option (or future extraction), we'd need these endpoints:

```
GET  /api/ops/status          # Server stats, player count
GET  /api/ops/sessions        # List active sessions
GET  /api/ops/player/:id      # Player details
POST /api/ops/broadcast       # Send message to all
POST /api/ops/reload          # Reload content
POST /api/ops/maintenance     # Toggle maintenance mode
POST /api/ops/shutdown        # Initiate graceful shutdown
POST /api/ops/player/:id/kick # Disconnect player
POST /api/ops/player/:id/teleport  # Move player
```

Security: These endpoints are internal-only (localhost) and require SSH access.

## Alternatives Considered

### 1. Web-only Admin Dashboard

**Pros**: Single codebase, richer UI capabilities
**Cons**: Doesn't work in SSH-only scenarios, requires HTTP exposure

**Verdict**: Keep web dashboard for content editing, add TUI for operations.

### 2. Enhanced IEx Helpers

Add functions like `Loka.Ops.broadcast("message")` with nice printing.

**Pros**: Zero new infrastructure
**Cons**: Still requires typing, no visual feedback, no menus

**Verdict**: Good as underlying implementation, but TUI provides better UX.

### 3. Slack/Discord Bot

Operations via chat commands.

**Pros**: Works from phone, team visibility
**Cons**: Requires external service, latency, limited interactivity

**Verdict**: Nice complement but not a replacement for direct access.

## Implementation Plan

### Phase 1: Core Operations (1-2 days)

1. Create `mix loka.ops` task with Ratatouille
2. Dashboard view with server stats
3. Broadcast message functionality
4. Live sessions list

### Phase 2: Player Management (1 day)

1. Player search and details
2. Kick player
3. Send direct message
4. Teleport player

### Phase 3: Content Operations (1 day)

1. Content reload with diff preview
2. Show affected players warning
3. Validation before reload

### Phase 4: Graceful Shutdown (1 day)

1. Multi-step shutdown wizard
2. Countdown with player notifications
3. Save-all before shutdown
4. Abort capability

### Phase 5: Polish & Extraction (Optional, 2-3 days)

1. Extract to standalone Go binary
2. Add Operations API endpoints
3. Distribute as `loka-ops` binary

## Open Questions

1. **Authentication for API**: If we extract to Go, how do we authenticate?
   - Option A: Bearer token stored in `~/.loka-ops`
   - Option B: SSH tunnel only (no auth needed)
   - Option C: mTLS with client certificates

2. **Audit logging**: Should operations be logged to a separate audit trail?

3. **Multi-operator**: What if two people try to shutdown simultaneously?

4. **Mobile optimization**: Should we optimize screen layouts for narrow terminals (phone)?

## Success Metrics

- Operations can be performed without typing Elixir code
- Emergency broadcast takes <30 seconds from SSH to delivery
- Graceful shutdown completes with 0 data loss
- All operations have confirmation dialogs
- Works from Termius on phone

## References

- [Bubbletea](https://github.com/charmbracelet/bubbletea) - Go TUI framework
- [Ratatouille](https://github.com/ndreynolds/ratatouille) - Elixir TUI framework
- [docs/operations/live-operations-guide.md](../operations/live-operations-guide.md) - Current ops procedures
