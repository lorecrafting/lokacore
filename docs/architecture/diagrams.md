# Architecture Diagrams

Visual diagrams of Loka's core architecture using Mermaid.

## Supervision Tree

The OTP supervision tree showing process hierarchy and fault tolerance boundaries.

```mermaid
graph TD
    subgraph Application["Loka.Application"]
        PubSub["Phoenix.PubSub"]
        Repo["Ecto.Repo"]
        Endpoint["LokaWeb.Endpoint"]

        subgraph Engine["Engine Processes"]
            Hooks["Hooks GenServer"]
            HooksTaskSup["Hooks.TaskSupervisor"]
            TypedObjectLoader["TypedObject.Loader"]
            EntityRegistry["EntityRegistry"]
            LayoutManager["LayoutManager"]

            subgraph EntitySup["EntitySupervisor (DynamicSupervisor)"]
                ES1["EntityServer\n(room:monastery_gate)"]
                ES2["EntityServer\n(npc:hermit)"]
                ES3["EntityServer\n(item:sword)"]
                ESN["..."]
            end
        end

        subgraph Framework["Framework Processes"]
            RespawnManager["Combat.RespawnManager"]
        end
    end

    Application --> PubSub
    Application --> Repo
    Application --> Endpoint
    Application --> Engine
    Application --> Framework

    Engine --> Hooks
    Engine --> HooksTaskSup
    Engine --> TypedObjectLoader
    Engine --> EntityRegistry
    Engine --> LayoutManager
    Engine --> EntitySup

    EntitySup --> ES1
    EntitySup --> ES2
    EntitySup --> ES3
    EntitySup --> ESN
```

## Entity Lifecycle

State machine showing how entities transition through their lifecycle.

```mermaid
stateDiagram-v2
    [*] --> Prototype: YAML loaded

    Prototype --> InDatabase: Spawner.spawn()

    InDatabase --> Active: EntityRegistry.get_or_start()

    Active --> Active: handle_call/cast
    Active --> Dirty: state modified

    Dirty --> Active: auto-save (60s)
    Dirty --> Hibernating: hibernate (2min idle)

    Active --> Hibernating: hibernate (2min idle)

    Hibernating --> Active: new message
    Hibernating --> Stopped: timeout (5min idle)

    Stopped --> InDatabase: final save

    InDatabase --> [*]: Entities.delete()
    Active --> [*]: Entities.delete()

    note right of Active
        EntityServer GenServer
        holds state in memory
    end note

    note right of Dirty
        Pending save
        marked for persistence
    end note
```

## Command Pipeline

Flow of a player command from input to execution.

```mermaid
flowchart LR
    subgraph Input["Input Layer"]
        LV["LiveView"]
        API["REST API"]
    end

    subgraph Pipeline["Command Pipeline"]
        Parse["Parse\n(tokenize input)"]
        Match["Match\n(find command)"]
        Validate["Validate\n(check locks)"]
        PreHook["Pre-Command\nHooks"]
        Execute["Execute\n(run command)"]
        PostHook["Post-Command\nHooks"]
    end

    subgraph Output["Output"]
        Events["Event Bus"]
        Response["Response"]
    end

    LV --> Parse
    API --> Parse

    Parse --> Match
    Match --> Validate
    Validate -->|"pass"| PreHook
    Validate -->|"denied"| Response
    PreHook -->|":ok"| Execute
    PreHook -->|"{:halt, reason}"| Response
    Execute --> PostHook
    PostHook --> Events
    Events --> Response
```

## Event Flow

How events propagate through the system.

```mermaid
flowchart TD
    subgraph Sources["Event Sources"]
        Cmd["Commands"]
        Behavior["Behaviors"]
        Hook["Hooks"]
        Script["Elixir Scripts"]
    end

    subgraph Bus["Event Bus (Phoenix.PubSub)"]
        Global["events:global"]
        Room["room:{id}"]
        Entity["entity:{id}"]
        Player["player:{id}"]
    end

    subgraph Subscribers["Subscribers"]
        LiveView["LiveView\n(UI updates)"]
        EntityServers["EntityServers\n(state changes)"]
        Framework["Framework\n(combat, quests)"]
        Logging["Logging\n(audit trail)"]
    end

    Sources --> Bus

    Cmd --> Global
    Cmd --> Room
    Behavior --> Entity
    Hook --> Global
    Script --> Entity

    Global --> LiveView
    Global --> Logging
    Room --> LiveView
    Room --> EntityServers
    Entity --> EntityServers
    Player --> LiveView
    Entity --> Framework
```

## Entity-Component-Behavior Model

How entities are composed from components and behaviors.

```mermaid
classDiagram
    class Entity {
        +String id
        +String key
        +String type
        +String name
        +String description
        +Map components
        +List~Module~ behaviors
        +List~String~ tags
        +Map locks
    }

    class Component {
        <<interface>>
        +Map data
    }

    class Behavior {
        <<interface>>
        +can_handle?(entity, event_type)
        +handle_event(entity, event, context)
    }

    Entity "1" *-- "*" Component : has
    Entity "1" *-- "*" Behavior : uses

    class CombatantComponent {
        +health: current/max
        +stats: str/dex/sta
        +xp_reward: integer
    }

    class DialogueComponent {
        +greeting: string
        +nodes: list
    }

    class ShopComponent {
        +buy_multiplier: float
        +inventory: list
    }

    class MobBehavior {
        +handle player_entered
        +handle attacked
        +handle tick
    }

    class ScriptBehavior {
        +execute Elixir scripts
        +sandbox execution
    }

    Component <|-- CombatantComponent
    Component <|-- DialogueComponent
    Component <|-- ShopComponent
    Behavior <|-- MobBehavior
    Behavior <|-- ScriptBehavior
```

## Framework Subsystem Relationships

How the 27 framework subsystems interact.

```mermaid
flowchart TB
    subgraph Core["Core Systems"]
        Player["Player\n(GameState)"]
        Inventory["Inventory"]
        Progression["Progression\n(XP/Levels)"]
    end

    subgraph Character["Character Systems"]
        Abilities["Abilities"]
        Skills["Skills"]
        Status["Status Effects"]
        Resources["Resources\n(Mana/Stamina)"]
    end

    subgraph World["World Systems"]
        WorldSys["World\n(Rooms)"]
        Economy["Economy\n(Shops)"]
        Faction["Factions"]
    end

    subgraph Gameplay["Gameplay Systems"]
        Combat["Combat"]
        Quest["Quests"]
        Dialogue["Dialogue"]
    end

    subgraph Crafting["Crafting Systems"]
        CraftSys["Crafting"]
        Gathering["Gathering"]
        Magic["Magic"]
    end

    Player --> Inventory
    Player --> Progression
    Player --> Status
    Player --> Resources

    Progression --> Skills
    Skills --> Abilities
    Abilities --> Combat
    Abilities --> Magic

    Combat --> Status
    Combat --> Resources
    Combat --> Progression

    Quest --> Dialogue
    Quest --> Progression
    Quest --> Inventory

    Economy --> Inventory
    Economy --> Faction

    Gathering --> Inventory
    Gathering --> Skills
    CraftSys --> Inventory
    CraftSys --> Skills
```

## Database Schema

Entity-Attribute-Value storage pattern.

```mermaid
erDiagram
    ENTITIES {
        uuid id PK
        string key UK
        string type
        string name
        text description
        json components
        json tags
        json locks
        uuid location_id FK
        datetime inserted_at
        datetime updated_at
    }

    ENTITY_ATTRIBUTES {
        uuid id PK
        uuid entity_id FK
        string key
        string value_type
        text value
        datetime inserted_at
        datetime updated_at
    }

    SCRIPTS {
        uuid id PK
        string name UK
        string script_type
        text code
        json metadata
        datetime inserted_at
        datetime updated_at
    }

    PLAYERS {
        uuid id PK
        string email UK
        binary hashed_password
        boolean is_admin
        datetime confirmed_at
        datetime inserted_at
        datetime updated_at
    }

    GAME_STATES {
        uuid id PK
        uuid player_id FK UK
        json inventory
        json equipment
        json quests
        json flags
        json stats
        json health
        string current_room_id
        datetime inserted_at
        datetime updated_at
    }

    ENTITIES ||--o{ ENTITY_ATTRIBUTES : has
    ENTITIES ||--o| ENTITIES : "location (room)"
    PLAYERS ||--|| GAME_STATES : has
```

## Prototype Inheritance

How YAML prototypes inherit from parent templates.

```mermaid
flowchart BT
    subgraph Base["_base/ (Parent Templates)"]
        BaseRoom["base_room.yml"]
        BaseNPC["base_npc.yml"]
        BaseItem["base_item.yml"]
    end

    subgraph Rooms["rooms/"]
        Monastery["monastery_gate.yml"]
        Courtyard["monastery_courtyard.yml"]
        Temple["monastery_temple.yml"]
    end

    subgraph NPCs["npcs/"]
        Hermit["hermit.yml"]
        Guard["monastery_guard.yml"]
        Merchant["traveling_merchant.yml"]
    end

    subgraph Items["items/"]
        Sword["iron_sword.yml"]
        Potion["health_potion.yml"]
        Scroll["wisdom_scroll.yml"]
    end

    Monastery -->|parent| BaseRoom
    Courtyard -->|parent| BaseRoom
    Temple -->|parent| BaseRoom

    Hermit -->|parent| BaseNPC
    Guard -->|parent| BaseNPC
    Merchant -->|parent| BaseNPC

    Sword -->|parent| BaseItem
    Potion -->|parent| BaseItem
    Scroll -->|parent| BaseItem
```

## Request Flow (LiveView)

How a player action flows through the system.

```mermaid
sequenceDiagram
    participant Browser
    participant LiveView
    participant Session
    participant Command
    participant Entity
    participant EventBus

    Browser->>LiveView: click "go north"
    LiveView->>Session: send_input("north")
    Session->>Command: execute("north", context)

    Command->>Command: parse & validate
    Command->>Entity: get_room(current_room_id)
    Entity-->>Command: room entity

    Command->>Entity: get_exit("north")
    Entity-->>Command: exit entity

    Command->>EventBus: publish(:player_move, payload)
    EventBus-->>Entity: notify room subscribers
    EventBus-->>LiveView: notify player subscriber

    LiveView->>LiveView: update assigns
    LiveView-->>Browser: push_patch (new room)

    Browser->>Browser: re-render UI
```

## Related

- [Entity System](./entity-system.md) - Detailed ECB documentation
- [Entity Lifecycle](./entity-lifecycle.md) - Process management details
- [Commands](./commands.md) - Command pipeline implementation
- [Events](./events.md) - Event bus patterns
- [Prototypes](./prototypes.md) - YAML template system
