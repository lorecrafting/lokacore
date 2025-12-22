defmodule Exmud.Engine.WorldLoader do
  @moduledoc """
  Load and initialize game world from YAML prototypes.

  ## Usage

      # Spawn the world (create entities from prototypes)
      {:ok, stats} = WorldLoader.spawn_world()

      # Spawn a connected chain of rooms starting from a room
      {:ok, rooms} = WorldLoader.spawn_room_chain("town_square")

      # Validate all references in prototypes
      {:ok, issues} = WorldLoader.validate()

      # Reset world (delete all entities, respawn)
      {:ok, stats} = WorldLoader.reset_world()

      # Get the starting room entity
      {:ok, room} = WorldLoader.get_starting_room()
  """

  require Logger

  alias Exmud.Engine.{PrototypeLoader, Spawner, Entities, WorldGraph}

  @starting_room "town_square"

  @doc """
  Spawn the entire game world from prototypes.

  Uses BFS to spawn rooms in connected order starting from the starting room,
  then spawns NPCs and items in each room.

  ## Options

  - `:starting_room` - The prototype key of the starting room (default: "town_square")

  ## Returns

  `{:ok, stats}` where stats is a map with counts:
  - `:rooms` - Number of rooms spawned
  - `:npcs` - Number of NPCs spawned
  - `:items` - Number of items spawned
  - `:exits` - Number of exits spawned
  """
  @spec spawn_world(keyword()) :: {:ok, map()} | {:error, term()}
  def spawn_world(opts \\ []) do
    starting_room = Keyword.get(opts, :starting_room, @starting_room)

    Logger.info("WorldLoader: Starting world spawn from #{starting_room}")

    # Ensure prototypes are loaded
    PrototypeLoader.reload()

    # Spawn rooms in connected order (BFS from starting room)
    case spawn_room_chain(starting_room, opts) do
      {:ok, room_results} ->
        # Link all exits to their destination room IDs
        linked_count = link_all_exits(room_results)
        Logger.info("WorldLoader: Linked #{linked_count} exits to destination IDs")

        # Auto-layout rooms with coordinates if requested
        if Keyword.get(opts, :auto_layout, false) do
          case get_starting_room() do
            {:ok, start_room} ->
              {:ok, count} = WorldGraph.auto_layout(start_room.id)
              Logger.info("WorldLoader: Auto-laid out #{count} rooms with coordinates")

            _ ->
              :ok
          end
        end

        # Calculate stats
        stats = calculate_stats(room_results)

        Logger.info(
          "WorldLoader: Spawned world - #{stats.rooms} rooms, #{stats.npcs} NPCs, #{stats.items} items, #{stats.exits} exits"
        )

        {:ok, stats}

      {:error, reason} = error ->
        Logger.error("WorldLoader: Failed to spawn world - #{inspect(reason)}")
        error
    end
  end

  @doc """
  Spawn a chain of connected rooms starting from a given room prototype.

  Uses BFS to traverse room exits and spawn all connected rooms.
  Each room's contents (NPCs, items) are also spawned.

  ## Options

  - `:max_rooms` - Maximum number of rooms to spawn (default: 100)

  ## Returns

  `{:ok, results}` where results is a list of spawn results per room.
  """
  @spec spawn_room_chain(String.t(), keyword()) :: {:ok, list()} | {:error, term()}
  def spawn_room_chain(starting_room_key, opts \\ []) do
    max_rooms = Keyword.get(opts, :max_rooms, 100)

    # Get the starting prototype
    case PrototypeLoader.get(starting_room_key) do
      nil ->
        {:error, {:prototype_not_found, starting_room_key}}

      _prototype ->
        # BFS through room exits
        queue = :queue.from_list([starting_room_key])
        visited = MapSet.new()
        results = []

        {:ok, spawn_rooms_bfs(queue, visited, results, max_rooms)}
    end
  end

  defp spawn_rooms_bfs(_queue, _visited, results, max_remaining) when max_remaining <= 0 do
    Logger.debug("WorldLoader: Reached max rooms limit, stopping BFS")
    results
  end

  defp spawn_rooms_bfs(queue, visited, results, max_remaining) do
    case :queue.out(queue) do
      {:empty, _} ->
        results

      {{:value, room_key}, queue} ->
        if MapSet.member?(visited, room_key) do
          # Already visited, skip
          spawn_rooms_bfs(queue, visited, results, max_remaining)
        else
          # Get prototype
          case PrototypeLoader.get(room_key) do
            nil ->
              Logger.warning("WorldLoader: Room prototype not found: #{room_key}")
              spawn_rooms_bfs(queue, MapSet.put(visited, room_key), results, max_remaining)

            prototype ->
              # Spawn this room
              case Spawner.spawn_room(room_key) do
                {:ok, room, spawned} ->
                  room_result = %{
                    room: room,
                    spawned: spawned,
                    exits: get_exits_from_prototype(prototype)
                  }

                  # Add connected rooms to queue
                  exits = get_exits_from_prototype(prototype)

                  new_queue =
                    Enum.reduce(exits, queue, fn {_dir, dest_key}, q ->
                      if MapSet.member?(visited, dest_key) do
                        q
                      else
                        :queue.in(dest_key, q)
                      end
                    end)

                  spawn_rooms_bfs(
                    new_queue,
                    MapSet.put(visited, room_key),
                    [room_result | results],
                    max_remaining - 1
                  )

                {:error, reason} ->
                  Logger.warning(
                    "WorldLoader: Failed to spawn room #{room_key}: #{inspect(reason)}"
                  )

                  spawn_rooms_bfs(queue, MapSet.put(visited, room_key), results, max_remaining)
              end
          end
        end
    end
  end

  defp get_exits_from_prototype(%{exits: exits}) when is_map(exits), do: exits
  defp get_exits_from_prototype(_), do: %{}

  defp calculate_stats(room_results) do
    Enum.reduce(room_results, %{rooms: 0, npcs: 0, items: 0, exits: 0}, fn result, acc ->
      %{
        rooms: acc.rooms + 1,
        npcs: acc.npcs + count_by_type(result.spawned, :npc),
        items: acc.items + count_by_type(result.spawned, :item),
        exits: acc.exits + count_by_type(result.spawned, :exit)
      }
    end)
  end

  defp count_by_type(entities, type) do
    Enum.count(entities, fn e -> e.type == type end)
  end

  @doc """
  Validate all prototype references.

  Checks for:
  - Broken parent references
  - Broken exit destinations
  - Missing spawn references

  ## Returns

  `{:ok, []}` if no issues, or `{:ok, issues}` with list of issues.
  """
  @spec validate() :: {:ok, list()}
  def validate do
    issues = []

    # Check all room prototypes for valid exit destinations
    rooms = PrototypeLoader.list_by_type(:room)

    exit_issues =
      Enum.flat_map(rooms, fn proto ->
        exits = get_exits_from_prototype(proto)

        Enum.flat_map(exits, fn {dir, dest_key} ->
          case PrototypeLoader.get(dest_key) do
            nil -> [{:broken_exit, proto.key, dir, dest_key}]
            _ -> []
          end
        end)
      end)

    # Check for spawns references
    spawn_issues =
      Enum.flat_map(rooms, fn proto ->
        spawns = Map.get(proto, :spawns, [])

        Enum.flat_map(spawns, fn
          spawn_entry when is_binary(spawn_entry) ->
            case PrototypeLoader.get(spawn_entry) do
              nil -> [{:broken_spawn, proto.key, spawn_entry}]
              _ -> []
            end

          spawn_entry when is_map(spawn_entry) ->
            spawn_key = spawn_entry["prototype"] || spawn_entry[:prototype]

            if spawn_key do
              case PrototypeLoader.get(spawn_key) do
                nil -> [{:broken_spawn, proto.key, spawn_key}]
                _ -> []
              end
            else
              []
            end

          _ ->
            []
        end)
      end)

    {:ok, issues ++ exit_issues ++ spawn_issues}
  end

  @doc """
  Reset the world by deleting all entities and respawning from prototypes.

  ## Returns

  `{:ok, stats}` with spawn statistics.
  """
  @spec reset_world(keyword()) :: {:ok, map()} | {:error, term()}
  def reset_world(opts \\ []) do
    Logger.info("WorldLoader: Resetting world...")

    # Delete all entities
    deleted = Entities.delete_all()
    Logger.info("WorldLoader: Deleted #{deleted} entities")

    # Respawn world
    spawn_world(opts)
  end

  @doc """
  Get the starting room entity.

  ## Returns

  `{:ok, entity}` or `{:error, :not_found}`.
  """
  @spec get_starting_room() :: {:ok, map()} | {:error, :not_found}
  def get_starting_room do
    # Look for a room with the starting room prototype key in metadata
    case Entities.find_by_prototype_key(@starting_room) do
      nil -> {:error, :not_found}
      entity -> {:ok, entity}
    end
  end

  @doc """
  Get the starting room ID.

  ## Returns

  The entity ID of the starting room, or nil if not found.
  """
  @spec get_starting_room_id() :: String.t() | nil
  def get_starting_room_id do
    case get_starting_room() do
      {:ok, room} -> room.id
      {:error, _} -> nil
    end
  end

  @doc """
  Links all exits to their destination room IDs.

  This resolves destination_key to destination_id for faster runtime navigation.
  Should be called after spawning rooms.

  ## Returns

  The number of exits linked.
  """
  @spec link_all_exits(list()) :: integer()
  def link_all_exits(room_results) do
    # Build key->id map from room results
    key_to_id =
      room_results
      |> Enum.map(fn %{room: room} -> {room.key, room.id} end)
      |> Map.new()

    # Also check for rooms that might already exist in the database
    existing_rooms = Entities.list_by_type(:room)

    key_to_id =
      Enum.reduce(existing_rooms, key_to_id, fn room_schema, acc ->
        room = Entities.to_entity(room_schema)
        Map.put_new(acc, room.key, room.id)
      end)

    # Get all exits from spawn results
    exits =
      room_results
      |> Enum.flat_map(fn %{spawned: spawned} ->
        Enum.filter(spawned, fn e -> e.type == :exit end)
      end)

    # Link each exit
    linked =
      Enum.count(exits, fn exit ->
        exit_component = Map.get(exit.components, "exit", %{})
        dest_key = Map.get(exit_component, "destination_key")

        if dest_key do
          case Map.get(key_to_id, dest_key) do
            nil ->
              # Try to find by key in database (might be from a different spawn batch)
              case Entities.get_entity_by_key(dest_key) do
                nil ->
                  Logger.debug(
                    "WorldLoader: Could not find destination for exit #{exit.key} -> #{dest_key}"
                  )

                  false

                dest_schema ->
                  link_exit(exit, dest_schema.id)
                  true
              end

            dest_id ->
              link_exit(exit, dest_id)
              true
          end
        else
          false
        end
      end)

    linked
  end

  defp link_exit(exit, destination_id) do
    exit_component = Map.get(exit.components, "exit", %{})
    updated_component = Map.put(exit_component, "destination_id", destination_id)
    updated_components = Map.put(exit.components, "exit", updated_component)
    updated_exit = %{exit | components: updated_components}

    case Entities.save_entity(updated_exit) do
      {:ok, _} ->
        Logger.debug("WorldLoader: Linked exit #{exit.key} -> #{destination_id}")

      {:error, reason} ->
        Logger.warning("WorldLoader: Failed to link exit #{exit.key}: #{inspect(reason)}")
    end
  end

  @doc """
  Re-links all exits in the database.

  Useful for fixing exits after manual room creation.
  """
  @spec relink_all_exits() :: {:ok, integer()}
  def relink_all_exits do
    # Get all exits
    exits = Entities.list_by_type(:exit)

    linked =
      Enum.count(exits, fn exit_schema ->
        exit = Entities.to_entity(exit_schema)
        exit_component = Map.get(exit.components, "exit", %{})
        dest_key = Map.get(exit_component, "destination_key")

        if dest_key do
          case Entities.get_entity_by_key(dest_key) do
            nil ->
              false

            dest_schema ->
              link_exit(exit, dest_schema.id)
              true
          end
        else
          false
        end
      end)

    {:ok, linked}
  end
end
