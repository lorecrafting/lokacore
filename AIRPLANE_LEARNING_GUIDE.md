# ExMUD Codebase Learning Guide (Offline Edition)

A comprehensive guide for learning the ExMUD codebase without internet. Designed for programmers new to Elixir/Phoenix/LiveView in production.

---

## Table of Contents

1. [Elixir Syntax Quick Reference](#part-1-elixir-syntax-quick-reference)
2. [Phoenix/LiveView Patterns](#part-2-phoenixliveview-patterns)
3. [Codebase Learning Path](#part-3-codebase-learning-path)
4. [Deep Dives by Topic](#part-4-deep-dives-by-topic)
5. [Architecture Decision Log](#part-5-architecture-decisions)
6. [Exercises to Try](#part-6-exercises)

---

## Part 1: Elixir Syntax Quick Reference

Before diving into the codebase, here's the Elixir syntax you'll encounter:

### 1.1 Module Definition & Functions

```elixir
defmodule MyModule do
  @moduledoc """
  Module-level documentation (like a class docstring)
  """

  # Module attribute (like a constant)
  @some_constant 42

  @doc """
  Function documentation
  """
  def public_function(arg1, arg2) do
    # Function body
  end

  # Private function (only callable within this module)
  defp private_helper(x) do
    x * 2
  end
end
```

### 1.2 Pattern Matching

Pattern matching is EVERYWHERE in Elixir. It's not just assignment—it's destructuring + assertion:

```elixir
# Simple assignment
x = 5

# Destructuring a tuple
{:ok, value} = {:ok, "hello"}  # value = "hello"

# This FAILS at runtime (MatchError):
{:ok, value} = {:error, "oops"}

# Destructuring a map
%{name: name, age: age} = %{name: "Ray", age: 30}

# In function heads (multiple function clauses)
def handle_result({:ok, data}), do: process(data)
def handle_result({:error, reason}), do: log_error(reason)

# The pin operator ^ matches against existing value
x = 5
^x = 5  # Works (asserts x equals 5)
^x = 6  # Fails! (MatchError)
```

### 1.3 The Pipe Operator `|>`

Transforms nested function calls into readable pipelines:

```elixir
# Without pipe (read inside-out):
String.upcase(String.trim("  hello  "))

# With pipe (read top-to-bottom):
"  hello  "
|> String.trim()
|> String.upcase()

# Result: "HELLO"
```

### 1.4 `with` Expression

Chains operations that might fail, with early exit:

```elixir
with {:ok, user} <- find_user(id),
     {:ok, profile} <- load_profile(user),
     :ok <- check_permissions(profile) do
  # All three succeeded
  {:ok, profile}
else
  {:error, :not_found} -> {:error, "User not found"}
  {:error, :forbidden} -> {:error, "Access denied"}
  error -> error  # Catch-all
end
```

### 1.5 Structs

Structs are maps with a defined shape:

```elixir
defmodule User do
  defstruct [:id, :name, :email, active: true]
  #                              ^^^ default value
end

# Creating
user = %User{name: "Ray", email: "ray@example.com"}

# Updating (creates new struct, immutable!)
updated = %{user | name: "Raymond"}

# Pattern matching
%User{name: name} = user
```

### 1.6 Behaviours (Interfaces)

Behaviours define a contract (like interfaces in other languages):

```elixir
defmodule MyBehaviour do
  @callback required_function(arg :: any()) :: {:ok, any()} | {:error, term()}
  @callback optional_function() :: any()
  @optional_callbacks [optional_function: 0]
end

defmodule MyImplementation do
  @behaviour MyBehaviour

  @impl true  # Marks this as implementing the behaviour
  def required_function(arg) do
    {:ok, arg}
  end
end
```

### 1.7 GenServer Basics

GenServer is a "generic server" process pattern:

```elixir
defmodule Counter do
  use GenServer

  # Client API (called from other processes)
  def start_link(initial) do
    GenServer.start_link(__MODULE__, initial, name: __MODULE__)
  end

  def increment do
    GenServer.call(__MODULE__, :increment)
  end

  # Server callbacks (run in the GenServer process)
  @impl true
  def init(initial) do
    {:ok, initial}  # initial becomes the "state"
  end

  @impl true
  def handle_call(:increment, _from, state) do
    new_state = state + 1
    {:reply, new_state, new_state}
    #        ^^^ sent back to caller
  end

  @impl true
  def handle_info(:some_message, state) do
    # Handle async messages
    {:noreply, state}
  end
end
```

### 1.8 Common Patterns You'll See

```elixir
# Guard clauses
def process(x) when is_integer(x) and x > 0 do
  # Only runs if x is positive integer
end

# Anonymous functions
fn x -> x * 2 end
&(&1 * 2)  # Shorthand: &1 is first arg

# Keyword lists (often used for options)
[name: "Ray", age: 30]  # Same as [{:name, "Ray"}, {:age, 30}]

# Default arguments
def greet(name, greeting \\ "Hello") do
  "#{greeting}, #{name}!"
end
```

---

## Part 2: Phoenix/LiveView Patterns

### 2.1 Phoenix MVC Structure

```
lib/
├── exmud/           # "Context" modules (business logic)
│   ├── accounts.ex  # Functions for user management
│   └── engine/      # Game engine logic
└── exmud_web/       # Web layer
    ├── router.ex    # URL -> Controller/LiveView mapping
    ├── controllers/ # Traditional request/response
    └── live/        # LiveView (real-time UI)
```

### 2.2 Contexts Pattern

Phoenix encourages "Contexts" - modules that group related functionality:

```elixir
# lib/exmud/accounts.ex
defmodule Exmud.Accounts do
  # All player-related database operations
  def get_player(id), do: Repo.get(Player, id)
  def list_players, do: Repo.all(Player)
  def create_player(attrs), do: ...
end

# Controllers/LiveViews call contexts, not Repo directly:
player = Accounts.get_player(123)
```

**Why?** Separation of concerns. Web layer doesn't know about database details.

### 2.3 Ecto (Database Layer)

**Schema** - Maps database table to Elixir struct:
```elixir
defmodule Exmud.Accounts.Player do
  use Ecto.Schema

  schema "players" do
    field :email, :string
    field :is_admin, :boolean, default: false
    timestamps()  # Adds inserted_at, updated_at
  end
end
```

**Changeset** - Validates and transforms data before DB:
```elixir
def changeset(player, attrs) do
  player
  |> cast(attrs, [:email, :name])  # Allow these fields
  |> validate_required([:email])    # Must be present
  |> validate_format(:email, ~r/@/) # Must match regex
  |> unique_constraint(:email)      # DB-level uniqueness
end
```

**Queries**:
```elixir
import Ecto.Query

# Basic query
Player |> where([p], p.is_admin == true) |> Repo.all()

# Query composition
def list_active_admins do
  Player
  |> where([p], p.is_admin == true)
  |> where([p], p.active == true)
  |> order_by([p], asc: p.email)
  |> Repo.all()
end
```

### 2.4 LiveView Basics

LiveView = Server-rendered real-time UI. No JavaScript needed for most interactions.

```elixir
defmodule ExmudWeb.GameLive do
  use ExmudWeb, :live_view

  # Called once when page loads
  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, messages: [], input: "")}
    #            ^^^^^^ socket.assigns holds all state
  end

  # Renders the HTML (called after mount and after each event)
  @impl true
  def render(assigns) do
    ~H"""
    <div>
      <%= for msg <- @messages do %>
        <p><%= msg %></p>
      <% end %>

      <form phx-submit="send">
        <input name="text" value={@input} phx-change="update_input" />
        <button>Send</button>
      </form>
    </div>
    """
  end

  # Handle form submission
  @impl true
  def handle_event("send", %{"text" => text}, socket) do
    messages = [text | socket.assigns.messages]
    {:noreply, assign(socket, messages: messages, input: "")}
  end

  # Handle input changes
  @impl true
  def handle_event("update_input", %{"text" => text}, socket) do
    {:noreply, assign(socket, input: text)}
  end

  # Handle PubSub messages
  @impl true
  def handle_info({:new_message, msg}, socket) do
    {:noreply, assign(socket, messages: [msg | socket.assigns.messages])}
  end
end
```

**Key LiveView Callbacks**:
- `mount/3` - Initialize state
- `render/1` - Return HTML (HEEx template)
- `handle_event/3` - User interactions (clicks, form submits)
- `handle_info/2` - Server-side messages (PubSub, timers)
- `handle_params/3` - URL parameter changes

### 2.5 Router

```elixir
defmodule ExmudWeb.Router do
  use ExmudWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    # ... more plugs
  end

  scope "/", ExmudWeb do
    pipe_through :browser

    get "/", PageController, :home        # Traditional controller
    live "/game", GameLive, :index        # LiveView
    live "/admin", AdminLive, :index
  end
end
```

### 2.6 Plugs

Plugs are middleware that transform the connection:

```elixir
defmodule ExmudWeb.Plugs.RequireAdmin do
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    if admin?(conn.assigns[:current_scope]) do
      conn  # Pass through
    else
      conn
      |> put_flash(:error, "Admin required")
      |> redirect(to: "/")
      |> halt()  # Stop processing
    end
  end
end
```

---

## Part 3: Codebase Learning Path

Read files in this order for maximum understanding:

### Phase 1: Foundation (30 mins)

**Start here to understand the project structure:**

1. **`CLAUDE.md`** (5 min)
   - Project overview, tech stack, routes
   - Read the entire file

2. **`mix.exs`** (5 min)
   - Dependencies list
   - Look at `deps` function to see what libraries are used

3. **`config/config.exs`** and **`config/dev.exs`** (5 min)
   - How the app is configured
   - Database, endpoints, etc.

4. **`lib/exmud/application.ex`** (5 min)
   - The supervision tree
   - What processes start when the app boots

5. **`lib/exmud_web/router.ex`** (10 min)
   - All routes in the app
   - How pipelines protect routes

### Phase 2: Database Layer (45 mins)

**Understand how data is stored:**

1. **`priv/repo/migrations/`** (10 min)
   - Read in chronological order (oldest first)
   - Understand the database schema evolution

2. **`lib/exmud/accounts/player.ex`** (10 min)
   - A complete Ecto schema
   - Changesets for validation
   - Notice `is_admin` field we added

3. **`lib/exmud/accounts.ex`** (15 min)
   - A complete Phoenix Context
   - CRUD operations, token management
   - Notice the admin functions at the top

4. **`lib/exmud/ecto/term.ex`** (5 min)
   - Custom Ecto type
   - How Erlang terms are serialized to binary

5. **`lib/exmud/engine/schema/entity_schema.ex`** (5 min)
   - More complex schema with relationships
   - Binary fields for Erlang term storage

### Phase 3: Engine Core (60 mins)

**The heart of the MUD engine:**

1. **`lib/exmud/engine/entity.ex`** (10 min)
   - Core Entity struct
   - This is what entities look like in memory

2. **`lib/exmud/engine/entities.ex`** (15 min)
   - Entity CRUD context
   - Attribute system (EAV pattern)
   - Query helpers

3. **`lib/exmud/engine/event.ex`** (5 min)
   - Event struct definition
   - How events carry information

4. **`lib/exmud/engine/event_bus.ex`** (10 min)
   - PubSub wrapper
   - How entities communicate

5. **`lib/exmud/engine/scripting.ex`** (10 min)
   - Lua integration via Luerl
   - Sandbox security model

6. **`lib/exmud/engine/scripts.ex`** (10 min)
   - Script CRUD context
   - How scripts are managed

### Phase 4: Web Layer (45 mins)

**How users interact with the system:**

1. **`lib/exmud_web/plugs/require_admin.ex`** (5 min)
   - Simple plug example
   - Authorization pattern

2. **`lib/exmud_web/controllers/api/auth_controller.ex`** (10 min)
   - REST API controller
   - JWT authentication with Guardian

3. **`lib/exmud_web/live/game_live.ex`** (15 min)
   - The game client LiveView
   - PubSub subscriptions
   - Real-time updates

4. **`lib/exmud_web/live/admin_live.ex`** (15 min)
   - Complex multi-tab LiveView
   - Form handling patterns
   - CRUD operations in LiveView

### Phase 5: Authentication (30 mins)

**How auth works:**

1. **`lib/exmud_web/player_auth.ex`** (15 min)
   - Generated by `phx.gen.auth`
   - Session management
   - `current_scope` assignment

2. **`lib/exmud/auth/guardian.ex`** (5 min)
   - JWT token handling
   - Used for API authentication

3. **`lib/exmud_web/plugs/auth_pipeline.ex`** (5 min)
   - Guardian plug pipeline
   - How API requests are authenticated

4. **`lib/exmud/accounts/scope.ex`** (5 min)
   - Wraps player for authorization checks

### Phase 6: Tests (30 mins)

**Learn patterns from tests:**

1. **`test/support/data_case.ex`** (5 min)
   - Test helper for database tests
   - Sandbox mode

2. **`test/support/fixtures/accounts_fixtures.ex`** (5 min)
   - How test data is created

3. **`test/exmud/accounts_test.exs`** (10 min)
   - Comprehensive context tests
   - Good patterns to follow

4. **`test/exmud/engine/entities_test.exs`** (10 min)
   - Tests for the engine we built

---

## Part 4: Deep Dives by Topic

### 4.1 The Entity System (Evennia-inspired)

Read these files together:

```
lib/exmud/engine/
├── entity.ex              # In-memory struct
├── schema/
│   ├── entity_schema.ex   # Database schema
│   └── entity_attribute.ex # EAV attributes
└── entities.ex            # CRUD context
```

**Key insight**: Separation between runtime (`Entity`) and persistence (`EntitySchema`).

The EAV (Entity-Attribute-Value) pattern allows flexible attributes:
```elixir
# Instead of adding columns for every attribute:
# ALTER TABLE entities ADD COLUMN health INTEGER;
# ALTER TABLE entities ADD COLUMN mana INTEGER;

# We use a separate attributes table:
Entities.set_attribute(entity_id, "health", 100)
Entities.set_attribute(entity_id, "mana", 50)
Entities.set_attribute(entity_id, "custom_stat", %{complex: "data"})
```

**Study question**: How does `Exmud.Ecto.Term` enable storing any Erlang term in the `value` column?

### 4.2 Authentication Flow

**Web (session-based)**:
```
Browser → POST /players/log-in
       → PlayerSessionController.create
       → Accounts.get_player_by_email_and_password
       → Generate session token
       → Store in session cookie
       → Redirect to /game

On each request:
       → Plug fetches session token
       → Accounts.get_player_by_session_token
       → Assigns current_scope to conn
```

**API (JWT-based)**:
```
Client → POST /api/v1/auth/login
       → AuthController.login
       → Validate credentials
       → Guardian.encode_and_sign (creates JWT)
       → Return JWT to client

On each request:
       → Authorization: Bearer <jwt>
       → Guardian.Plug.Pipeline validates
       → Assigns current_player to conn
```

**Study question**: Why have two auth systems? (Hint: cookies don't work well in mobile apps)

### 4.3 LiveView Lifecycle

```
1. HTTP GET /admin
   ├── Router matches → AdminLive
   ├── mount/3 called (disconnected)
   ├── render/1 called
   └── HTML sent to browser

2. WebSocket connects
   ├── mount/3 called again (connected)
   ├── Subscribe to PubSub topics
   └── Initial state pushed

3. User clicks button (phx-click="switch_tab")
   ├── Event sent over WebSocket
   ├── handle_event/3 called
   ├── State updated with assign/2
   ├── render/1 called
   └── Diff sent to browser

4. PubSub message arrives
   ├── handle_info/2 called
   ├── State updated
   └── Diff sent to browser
```

**Study the AdminLive tabs**: Each tab is just different assigns being rendered conditionally.

### 4.4 The Supervision Tree

In `lib/exmud/application.ex`:

```elixir
children = [
  ExmudWeb.Telemetry,        # Metrics
  Exmud.Repo,                # Database connection pool
  {Phoenix.PubSub, ...},     # PubSub for real-time messaging
  ExmudWeb.Endpoint,         # HTTP server
]
```

Each child is a process (or process tree). If one crashes, the supervisor restarts it.

**Study question**: What happens if `Exmud.Repo` crashes? (Hint: Supervisor restarts it, and queries retry)

---

## Part 5: Architecture Decisions

### Why LiveView instead of React?

1. **Single codebase** - No separate frontend repo
2. **Real-time built-in** - PubSub → LiveView is seamless
3. **No API needed** - Context functions called directly
4. **SEO-friendly** - Server-rendered HTML

Trade-offs:
- Requires persistent WebSocket connection
- Less suitable for offline-first apps
- Smaller ecosystem than React

### Why SQLite instead of PostgreSQL?

1. **Simpler deployment** - No separate database server
2. **Cheaper** - $0 vs $15/month for managed Postgres
3. **Sufficient for MVP** - Single server handles thousands of users
4. **Easy backup** - Just copy a file

Trade-offs:
- No multi-server support
- No advanced Postgres features (JSONB queries, full-text search)

### Why Lua for scripting?

1. **Safe sandboxing** - Luerl provides isolated execution
2. **Familiar syntax** - Easy for game designers to learn
3. **Proven in games** - Used by WoW, Roblox, etc.
4. **CPU/memory limits** - Can prevent infinite loops

### Why EAV for attributes?

1. **Flexibility** - Add attributes without migrations
2. **Dynamic content** - Game designers can create new stats
3. **Evennia compatibility** - Similar to their attribute system

Trade-offs:
- Slightly slower queries
- No database-level type safety
- Harder to query across attributes

---

## Part 6: Exercises

Try these while reading the code (no running required):

### Exercise 1: Trace a Request
Starting from `router.ex`, trace what happens when:
- A user visits `/admin`
- What plugs run?
- What LiveView mounts?
- What assigns are set?

### Exercise 2: Add a Mental Model
In `admin_live.ex`, find:
- How tabs are switched
- How players are listed
- How a player's admin status is toggled

Write down the flow in pseudocode.

### Exercise 3: Understand the Entity System
In the entity files, answer:
- How is an Entity different from EntitySchema?
- Where do components get serialized?
- How would you add a new entity type?

### Exercise 4: Security Audit
Find and list:
- All places that check `is_admin`
- How API endpoints are protected
- What prevents SQL injection in queries

### Exercise 5: Design Extension
Without writing code, design how you would add:
- A "kick player" feature in admin
- An in-game chat system
- A simple combat system

What contexts would you modify? What events would you emit?

---

## Quick Reference: File Locations

| What | Where |
|------|-------|
| Routes | `lib/exmud_web/router.ex` |
| Database schemas | `lib/exmud/*/` and `lib/exmud/engine/schema/` |
| Migrations | `priv/repo/migrations/` |
| LiveViews | `lib/exmud_web/live/` |
| Controllers | `lib/exmud_web/controllers/` |
| Plugs | `lib/exmud_web/plugs/` |
| Templates | Inline in LiveViews (`~H"""..."""`) |
| JavaScript | `assets/js/app.js` |
| Tests | `test/` (mirrors `lib/` structure) |
| Config | `config/*.exs` |

---

## Glossary

| Term | Meaning |
|------|---------|
| Context | Module grouping related business logic |
| Changeset | Validated/transformed data before DB operation |
| Plug | Middleware that transforms a connection |
| Socket | LiveView's stateful connection to browser |
| Assigns | Key-value state stored in socket/conn |
| PubSub | Publish/Subscribe messaging system |
| GenServer | Generic server process (OTP pattern) |
| ETS | Erlang Term Storage (in-memory cache) |
| Supervision | Automatic process restart on crash |
| HEEx | HTML + Embedded Elixir templates |

---

## Reading Order Summary

```
1. CLAUDE.md                           (overview)
2. mix.exs                             (dependencies)
3. config/config.exs                   (configuration)
4. lib/exmud/application.ex            (startup)
5. lib/exmud_web/router.ex             (routes)
6. priv/repo/migrations/*              (database evolution)
7. lib/exmud/accounts/player.ex        (schema example)
8. lib/exmud/accounts.ex               (context example)
9. lib/exmud/engine/entity.ex          (core domain)
10. lib/exmud/engine/entities.ex       (engine context)
11. lib/exmud/engine/scripting.ex      (Lua integration)
12. lib/exmud_web/live/game_live.ex    (simple LiveView)
13. lib/exmud_web/live/admin_live.ex   (complex LiveView)
14. lib/exmud_web/player_auth.ex       (auth system)
15. test/exmud/accounts_test.exs       (test patterns)
```

---

**Have a great flight! By the time you land, you'll understand this codebase inside and out.**
