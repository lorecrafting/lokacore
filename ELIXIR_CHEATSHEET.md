# Elixir/Phoenix/LiveView Cheatsheet

Quick reference for syntax and patterns you'll see in the ExMUD codebase.

---

## Data Types

```elixir
# Atoms (like symbols/enums)
:ok
:error
:room
true  # true/false are atoms

# Strings
"hello"
"interpolation: #{variable}"

# Numbers
42
3.14

# Lists (linked lists, not arrays)
[1, 2, 3]
[head | tail] = [1, 2, 3]  # head = 1, tail = [2, 3]

# Tuples (fixed size, contiguous memory)
{:ok, "value"}
{:error, "reason"}

# Maps
%{key: "value", other: 123}
%{"string_key" => "value"}

# Keyword lists (list of 2-tuples, allows duplicate keys)
[name: "Ray", name: "Other"]  # Same as [{:name, "Ray"}, {:name, "Other"}]

# Structs (maps with defined shape)
%User{name: "Ray", email: "ray@example.com"}
```

---

## Pattern Matching Examples

```elixir
# Match and extract
{:ok, user} = {:ok, %User{name: "Ray"}}
# user = %User{name: "Ray"}

# Match in function heads
def process({:ok, data}), do: handle_success(data)
def process({:error, reason}), do: handle_error(reason)

# Match maps (partial match ok)
%{name: name} = %{name: "Ray", age: 30}
# name = "Ray"

# Match lists
[first | rest] = [1, 2, 3]
# first = 1, rest = [2, 3]

[first, second | _] = [1, 2, 3, 4]
# first = 1, second = 2, _ ignores rest

# Pin operator (match against existing value)
expected = "hello"
^expected = some_function()  # Asserts result equals "hello"

# In case expressions
case result do
  {:ok, value} -> value
  {:error, :not_found} -> nil
  {:error, reason} -> raise reason
end
```

---

## Common Functions

### Enum (for lists/maps/ranges)

```elixir
# Transform each element
Enum.map([1, 2, 3], fn x -> x * 2 end)
# [2, 4, 6]

# Filter elements
Enum.filter([1, 2, 3, 4], fn x -> x > 2 end)
# [3, 4]

# Reduce to single value
Enum.reduce([1, 2, 3], 0, fn x, acc -> x + acc end)
# 6

# Find first match
Enum.find([1, 2, 3], fn x -> x > 1 end)
# 2

# Check if any/all match
Enum.any?([1, 2, 3], fn x -> x > 2 end)  # true
Enum.all?([1, 2, 3], fn x -> x > 0 end)  # true

# Group by key
Enum.group_by([%{type: :a}, %{type: :b}, %{type: :a}], & &1.type)
# %{a: [%{type: :a}, %{type: :a}], b: [%{type: :b}]}

# Take/drop
Enum.take([1, 2, 3, 4], 2)   # [1, 2]
Enum.drop([1, 2, 3, 4], 2)   # [3, 4]
```

### Map

```elixir
# Get value
Map.get(%{a: 1}, :a)           # 1
Map.get(%{a: 1}, :b, "default") # "default"

# Put value (returns new map)
Map.put(%{a: 1}, :b, 2)        # %{a: 1, b: 2}

# Update syntax (for existing keys)
%{map | key: new_value}

# Merge maps
Map.merge(%{a: 1}, %{b: 2})    # %{a: 1, b: 2}

# Keys/values
Map.keys(%{a: 1, b: 2})        # [:a, :b]
Map.values(%{a: 1, b: 2})      # [1, 2]
```

### String

```elixir
String.trim("  hello  ")       # "hello"
String.split("a,b,c", ",")     # ["a", "b", "c"]
String.upcase("hello")         # "HELLO"
String.contains?("hello", "ll") # true
String.starts_with?("hello", "he") # true
```

---

## Control Flow

```elixir
# If/else
if condition do
  "truthy"
else
  "falsy"
end

# Unless (inverse of if)
unless condition do
  "when falsy"
end

# Cond (multiple conditions)
cond do
  x > 10 -> "big"
  x > 5 -> "medium"
  true -> "small"  # default case
end

# Case (pattern matching)
case value do
  {:ok, result} -> result
  {:error, _} -> nil
end

# With (chain operations)
with {:ok, a} <- step1(),
     {:ok, b} <- step2(a),
     {:ok, c} <- step3(b) do
  {:ok, c}
else
  {:error, reason} -> {:error, reason}
end
```

---

## Ecto Query Syntax

```elixir
import Ecto.Query

# Basic select all
Repo.all(User)

# Where clause
User
|> where([u], u.active == true)
|> Repo.all()

# Multiple conditions
User
|> where([u], u.active == true)
|> where([u], u.role == :admin)
|> Repo.all()

# Or conditions
User
|> where([u], u.role == :admin or u.role == :moderator)
|> Repo.all()

# Order by
User
|> order_by([u], asc: u.name)
|> Repo.all()

# Limit/offset
User
|> limit(10)
|> offset(20)
|> Repo.all()

# Select specific fields
User
|> select([u], {u.id, u.name})
|> Repo.all()

# Preload associations
User
|> preload(:posts)
|> Repo.all()

# Join
from u in User,
  join: p in Post, on: p.user_id == u.id,
  where: p.published == true,
  select: u

# Aggregate
Repo.aggregate(User, :count)
Repo.aggregate(User, :count, :id)
```

---

## Phoenix LiveView

### Mount & Render

```elixir
@impl true
def mount(params, session, socket) do
  # params = URL params
  # session = session data
  # socket = LiveView socket

  socket = assign(socket,
    items: [],
    loading: true
  )

  {:ok, socket}
end

@impl true
def render(assigns) do
  ~H"""
  <div>
    <%= if @loading do %>
      <p>Loading...</p>
    <% else %>
      <%= for item <- @items do %>
        <p><%= item.name %></p>
      <% end %>
    <% end %>
  </div>
  """
end
```

### Event Handling

```elixir
# In template:
# <button phx-click="increment">+</button>
# <button phx-click="delete" phx-value-id={item.id}>Delete</button>
# <form phx-submit="save" phx-change="validate">

@impl true
def handle_event("increment", _params, socket) do
  {:noreply, assign(socket, count: socket.assigns.count + 1)}
end

@impl true
def handle_event("delete", %{"id" => id}, socket) do
  # id comes from phx-value-id
  {:noreply, socket}
end

@impl true
def handle_event("save", %{"user" => user_params}, socket) do
  # Form data under the form name
  {:noreply, socket}
end
```

### PubSub

```elixir
# Subscribe (usually in mount)
if connected?(socket) do
  Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{room_id}")
end

# Broadcast (from anywhere)
Phoenix.PubSub.broadcast(Exmud.PubSub, "room:123", {:new_message, msg})

# Receive
@impl true
def handle_info({:new_message, msg}, socket) do
  {:noreply, assign(socket, messages: [msg | socket.assigns.messages])}
end
```

### Common HEEx Syntax

```elixir
~H"""
<%# Comment %>

<%# Output value (escaped) %>
<%= @name %>

<%# Output raw HTML (dangerous!) %>
<%= raw(@html_content) %>

<%# Conditionals %>
<%= if @show do %>
  <p>Visible</p>
<% end %>

<%# For loops %>
<%= for item <- @items do %>
  <p><%= item.name %></p>
<% end %>

<%# Attributes %>
<div class={@class_name} id={"item-#{@id}"}>

<%# Boolean attributes %>
<button disabled={@disabled}>

<%# Event bindings %>
<button phx-click="action">Click</button>
<button phx-click="delete" phx-value-id={@id}>Delete</button>
<form phx-submit="save" phx-change="validate">
<input phx-blur="validate_field" phx-focus="clear_error">

<%# Components %>
<.button>Click me</.button>
<.link navigate={~p"/users/#{@user}"}>Profile</.link>
"""
```

---

## Common Repo Operations

```elixir
# Get by ID
Repo.get(User, 123)        # nil if not found
Repo.get!(User, 123)       # raises if not found

# Get by field
Repo.get_by(User, email: "test@example.com")

# Insert
{:ok, user} = Repo.insert(%User{name: "Ray"})
{:error, changeset} = Repo.insert(invalid_changeset)

# Update
{:ok, user} = Repo.update(changeset)

# Delete
{:ok, user} = Repo.delete(user)

# All
Repo.all(User)

# Count
Repo.aggregate(User, :count)

# Transaction
Repo.transaction(fn ->
  Repo.insert!(user)
  Repo.insert!(profile)
end)
```

---

## Debugging

```elixir
# Print to console
IO.inspect(value)
IO.inspect(value, label: "my value")

# In pipelines
value
|> transform()
|> IO.inspect(label: "after transform")
|> another_transform()

# IEx helpers (in iex shell)
h Enum.map          # Help for function
i some_value        # Info about value
recompile()         # Recompile project

# Debug in tests
IO.puts("Debug: #{inspect(value)}")
```

---

## Error Handling

```elixir
# Try/rescue (rarely needed)
try do
  risky_operation()
rescue
  e in RuntimeError -> {:error, e.message}
end

# Better: use tagged tuples
case operation() do
  {:ok, result} -> process(result)
  {:error, reason} -> handle_error(reason)
end

# With clause for chaining
with {:ok, a} <- step1(),
     {:ok, b} <- step2(a) do
  {:ok, b}
else
  {:error, reason} -> {:error, reason}
end

# Bang functions (raise on error)
user = Repo.get!(User, id)  # Raises Ecto.NoResultsError
```

---

## Testing Patterns

```elixir
defmodule MyTest do
  use ExUnit.Case
  # or: use Exmud.DataCase (for database tests)

  describe "function_name/arity" do
    test "does something" do
      assert 1 + 1 == 2
    end

    test "handles error case" do
      assert {:error, _} = some_function()
    end
  end

  # Setup runs before each test
  setup do
    user = create_user()
    {:ok, user: user}
  end

  test "uses setup data", %{user: user} do
    assert user.name == "Test"
  end
end

# Assertions
assert value                    # truthy
refute value                    # falsy
assert value == expected        # equality
assert_raise ErrorType, fn -> ... end
assert %{key: _} = map          # pattern match
```

---

## File Structure Quick Reference

```
lib/
├── exmud/                    # Business logic
│   ├── application.ex        # Supervision tree
│   ├── repo.ex               # Database connection
│   ├── accounts/             # Auth context
│   │   ├── player.ex         # Schema
│   │   ├── player_token.ex   # Schema
│   │   └── scope.ex          # Auth wrapper
│   ├── accounts.ex           # Context functions
│   └── engine/               # Game engine
│       ├── entity.ex         # Core struct
│       ├── entities.ex       # Context
│       └── schema/           # Ecto schemas
│
└── exmud_web/                # Web layer
    ├── router.ex             # Routes
    ├── endpoint.ex           # HTTP config
    ├── controllers/          # REST
    ├── live/                  # LiveViews
    ├── plugs/                 # Middleware
    └── components/           # UI components

test/
├── support/                  # Test helpers
│   ├── data_case.ex          # DB test setup
│   ├── conn_case.ex          # HTTP test setup
│   └── fixtures/             # Test data factories
├── exmud/                    # Unit tests
└── exmud_web/                # Integration tests

config/
├── config.exs                # Shared config
├── dev.exs                   # Development
├── test.exs                  # Test
├── prod.exs                  # Production
└── runtime.exs               # Runtime config
```
