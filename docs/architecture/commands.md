# Command System Architecture

Commands are the primary way players interact with the world in Loka.

## Command Behaviour

```elixir
defmodule Loka.Engine.Command do
  @type parse_result :: {:ok, map()} | {:error, String.t()}
  @type execute_result :: {:ok, [Event.t()]} | {:error, String.t()}

  @callback key() :: String.t()
  @callback aliases() :: [String.t()]
  @callback help() :: String.t()
  @callback parse(args :: String.t(), context :: map()) :: parse_result()
  @callback execute(parsed :: map(), context :: map()) :: execute_result()
  @callback locks() :: [atom()]  # Required permissions
end
```

## Example Command Implementation

```elixir
defmodule Commands.Look do
  @behaviour Loka.Engine.Command

  @impl true
  def key, do: "look"

  @impl true
  def aliases, do: ["l", "examine", "ex"]

  @impl true
  def help, do: "Look at your surroundings or a specific object."

  @impl true
  def locks, do: []  # No special permissions needed

  @impl true
  def parse("", _context), do: {:ok, %{target: :room}}
  def parse(args, context) do
    case Search.find_target(args, context) do
      {:ok, target} -> {:ok, %{target: target}}
      :not_found -> {:error, "You don't see '#{args}' here."}
    end
  end

  @impl true
  def execute(%{target: :room}, %{actor: actor, location: room}) do
    events = [
      %Event{type: :display, target: actor.id, payload: describe_room(room)},
      %Event{type: :notify_room, location: room.id,
             payload: "#{actor.name} looks around.", exclude: [actor.id]}
    ]
    {:ok, events}
  end

  def execute(%{target: target}, %{actor: actor}) do
    {:ok, [%Event{type: :display, target: actor.id, payload: describe_entity(target)}]}
  end
end
```

## Command Pipeline

```
Input → Parse → Validate → Execute → Output
```

```elixir
defmodule CommandPipeline do
  def process(raw_input, session) do
    with {:ok, {command_module, args}} <- route(raw_input, session),
         :ok <- check_locks(command_module, session),
         {:ok, parsed} <- command_module.parse(args, build_context(session)),
         {:ok, events} <- command_module.execute(parsed, build_context(session)) do

      # Process all emitted events
      Enum.each(events, &EventBus.emit/1)
      :ok
    else
      {:error, message} ->
        Session.send_message(session, message)
        :ok
    end
  end

  defp route(raw_input, session) do
    [cmd | args] = String.split(raw_input, " ", parts: 2)
    args = List.first(args) || ""

    case CommandRegistry.find(cmd, session.command_sets) do
      {:ok, module} -> {:ok, {module, args}}
      :not_found -> {:error, "Unknown command: #{cmd}"}
    end
  end
end
```

## Command Sets

Command sets allow entities to contribute commands contextually:

```elixir
# Default commands everyone has
defmodule CommandSet.Default do
  def commands do
    [
      Commands.Look,
      Commands.Inventory,
      Commands.Say,
      Commands.Move,
      Commands.Get,
      Commands.Drop,
      Commands.Help,
    ]
  end
end

# Combat commands (added when in combat)
defmodule CommandSet.Combat do
  def commands do
    [
      Commands.Attack,
      Commands.Defend,
      Commands.Flee,
      Commands.UseSkill,
      Commands.CastSpell,
    ]
  end
end

# Builder commands (for world creators)
defmodule CommandSet.Builder do
  def commands do
    [
      Commands.Admin.Create,
      Commands.Admin.Edit,
      Commands.Admin.Delete,
      Commands.Admin.Teleport,
      Commands.Admin.Spawn,
    ]
  end
end
```

## Text-Based Parser

The parser is text-first, working identically across all client types:

```elixir
defmodule Command.Parser do
  @doc """
  Parse raw input into command and arguments.

  Examples:
    "look"           -> {:ok, {LookCommand, ""}}
    "l sword"        -> {:ok, {LookCommand, "sword"}}
    "go north"       -> {:ok, {MoveCommand, "north"}}
    "n"              -> {:ok, {MoveCommand, "north"}}
    "say hello"      -> {:ok, {SayCommand, "hello"}}
    "'hello"         -> {:ok, {SayCommand, "hello"}}
  """

  # Direction shortcuts
  @direction_aliases %{
    "n" => "north", "s" => "south", "e" => "east", "w" => "west",
    "ne" => "northeast", "nw" => "northwest",
    "se" => "southeast", "sw" => "southwest",
    "u" => "up", "d" => "down"
  }

  # Quick command shortcuts
  @shortcuts %{
    "'" => "say",
    ":" => "emote",
    "\"" => "say"
  }
end
```

## Common Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| look | l, ex, examine | Look at room or object |
| get | take, grab | Pick up item |
| drop | put | Drop item |
| inventory | i, inv | List inventory |
| say | ', " | Speak to room |
| emote | :, pose | Emote action |
| whisper | tell | Private message |
| go | move + directions | Move between rooms |
| attack | kill, hit | Start combat |
| use | activate | Use item/ability |

## Context Object

Commands receive a context containing session state:

```elixir
def build_context(session) do
  %{
    actor: session.player,
    location: session.current_room,
    inventory: session.inventory,
    command_sets: session.command_sets,
    permissions: session.permissions,
    game_state: get_game_state()
  }
end
```

## Lock System

Commands can require specific permissions:

```elixir
defmodule Commands.Admin.Teleport do
  @impl true
  def locks, do: [:admin, :builder]

  # ...
end

# In pipeline
defp check_locks(command_module, session) do
  required = command_module.locks()
  has_all = Enum.all?(required, &(&1 in session.permissions))

  if has_all do
    :ok
  else
    {:error, "You don't have permission to do that."}
  end
end
```

## Command Flow Example

```
Player types: "get sword"
    ↓
CommandPipeline.process("get sword", session)
    ↓
route/2 → {:ok, {Commands.Get, "sword"}}
    ↓
check_locks/2 → :ok
    ↓
Commands.Get.parse("sword", context)
    ↓
Search.find_target("sword", context) → {:ok, sword_entity}
    ↓
{:ok, %{target: sword_entity}}
    ↓
Commands.Get.execute(%{target: sword}, context)
    ↓
Lock.check(sword, :get, player) → :allowed
    ↓
{:ok, [
  %Event{type: :move_entity, payload: %{from: room, to: player}},
  %Event{type: :message, target: player, payload: "You pick up the sword."},
  %Event{type: :notify_room, payload: "Player picks up a sword."}
]}
    ↓
EventBus.emit/1 for each event
```

## Related
- [Events](./events.md) - Events emitted by commands
- [Entity System](./entity-system.md) - Entities that commands interact with
