# review-architecture

Check layer separation and MUD architectural patterns.

## Purpose

Review code changes for architectural violations, ensuring clean separation of concerns and adherence to Loka's design patterns.

## Instructions

Analyze the codebase for architectural issues in these areas:

### 1. Layer Separation

Check the three-layer architecture:

```
GAME CONTENT (YAML)
    ↓
FRAMEWORK (lib/loka/framework/)
    ↓
ENGINE (lib/loka/engine/)
    ↓
PLATFORM (Phoenix, Ecto)
```

**Rules**:
- ❌ Engine MUST NOT import Framework modules
- ❌ Framework MUST NOT import Web modules
- ❌ Engine MUST NOT contain game-specific data (no hardcoded NPCs, items, quests)
- ✅ Framework can import Engine
- ✅ Web can import Framework and Engine
- ✅ All game data belongs in YAML prototypes

**Check**:
```bash
# Search for violations
grep -r "alias Loka.Framework" lib/loka/engine/
grep -r "alias LokaWeb" lib/loka/framework/
grep -r "hardcoded_npc\|goblin\|sword" lib/loka/engine/
```

### 2. Entity-Component-Behavior Pattern

**Rules**:
- Entities are data containers (structs with components map)
- Components hold state (maps with data)
- Behaviors define logic (modules implementing callbacks)
- No behavior in entity structs themselves

**Check**:
- Entity structs should be simple (id, key, type, components)
- No complex logic in Entity module (only CRUD)
- Behaviors in `lib/loka/behaviors/` or framework subsystems

### 3. Command Pattern

**Rules**:
- Commands parse input → validate → execute → emit events
- Commands NEVER mutate state directly
- Commands return `{:ok, [Event.t()]}` or `{:error, reason}`
- State changes happen via event handlers

**Check**:
```elixir
# ❌ BAD - Direct mutation
def execute(player, target) do
  player = %{player | health: player.health - 10}
  {:ok, player}
end

# ✅ GOOD - Emit events
def execute(player, target) do
  event = Event.new(:damage_dealt, %{target: target, amount: 10})
  {:ok, [event]}
end
```

### 4. Event Bus Pattern

**Rules**:
- Use PubSub for entity communication
- Subscribe to topics: `room:{id}`, `player:{id}`, `entity:{id}`, `events:global`
- Don't use direct process messages between entities
- Events are immutable data

**Check**:
- No `send/2` calls to entity processes
- Use `EventBus.emit/1` or `Registry.broadcast/2`

### 5. SOLID Principles

#### Single Responsibility
- Modules do one thing well
- Large modules (>500 lines) likely violate SRP
- Split by responsibility, not by arbitrary size

#### Open/Closed
- Extend via behaviors/hooks, not by modifying core
- New features should add modules, not modify existing

#### Liskov Substitution
- Behaviors are swappable
- Protocol implementations are complete

#### Interface Segregation
- Small, focused behaviors
- Don't require implementers to stub unused callbacks

#### Dependency Inversion
- Depend on behaviors/protocols, not concrete modules
- Use dependency injection for testability

**Check**:
```bash
# Find large modules
find lib/loka -name "*.ex" -exec wc -l {} \; | sort -rn | head -20

# Find modules with multiple concerns (look for "and" in module docs)
grep -r "@moduledoc" lib/loka/ | grep -i "and"
```

### 6. Error Handling

**Rules**:
- Web layer: Never use `!` functions (get!, fetch!, etc.)
- Always handle errors from Engine/Framework
- Return tuples: `{:ok, result}` or `{:error, reason}`
- Use `with` for sequential operations

**Check**:
```bash
# Find dangerous functions in web layer
grep -r "Repo.get!\|Repo.fetch!\|Enum.fetch!\|Map.fetch!" lib/loka_web/
```

### 7. GenServer Patterns

**Rules**:
- EntityServer is the only GenServer per entity
- Use Registry for process lookup, not global names
- Hibernate after idle timeout
- Clean shutdown with terminate/2

**Check**:
- No GenServer modules outside lib/loka/engine/entity_server.ex (except infrastructure)
- All entities use EntityServer, not custom GenServers

## Output Format

```markdown
# Architecture Review Report

## 🚨 Critical Violations (Fix Immediately)

### 1. Layer Separation Violation
**File**: lib/loka/engine/spawner.ex
**Line**: 45
**Issue**: Engine imports Framework.Combat
**Impact**: Creates circular dependency, breaks architecture
**Fix**: Move combat logic to Framework, Engine only handles entity creation

## ⚠️ High Priority

### 1. [Violation]
...

## 📋 Medium Priority

### 1. [Issue]
...

## ✅ Architecture Strengths

- Clean layer separation in X modules
- Proper use of Entity-Component pattern
- Event-driven communication

## 📊 Metrics

- Modules analyzed: X
- Large modules (>500 lines): Y
- Layer violations: Z
- SOLID violations: W

## Summary

Status: ✅ CLEAN | ⚠️ NEEDS REFACTORING | 🚨 CRITICAL ISSUES

Priority Actions:
1. [Specific fix]
2. [Specific fix]
```

## Success Criteria

- Zero layer violations (Engine ← Framework ← Web)
- No game data in Engine layer
- All commands follow event pattern
- No SOLID violations in core systems
- Error handling complete in Web layer

## When to Run

- Before creating PRs
- After adding new subsystems
- After major refactoring
- When in doubt about design decisions

## Notes

- Some warnings are acceptable (document why)
- Balance pragmatism with purity (don't over-engineer)
- Focus on critical path first (engine/framework core)
- Web layer can be more pragmatic
