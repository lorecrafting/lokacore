defmodule Loka.Testing.Content.WorldValidator do
  @moduledoc """
  Validates world connectivity and integrity.

  Performs BFS traversal from the starting room to verify:
  - All rooms are reachable
  - All exit destinations exist
  - Bidirectional exits are properly configured
  - No orphan rooms exist

  ## Usage

      {:ok, results} = WorldValidator.validate()

      # Check for errors
      if Enum.any?(results.errors) do
        IO.puts("Validation failed:")
        Enum.each(results.errors, &IO.inspect/1)
      end

  ## Result Structure

      %{
        rooms_checked: 5,
        rooms_reachable: 4,
        errors: [
          {:orphan_room, "hidden_cave"},
          {:broken_exit, "town_square", "north", "missing_room"}
        ],
        warnings: [
          {:missing_return_exit, "town_square", "north", "forest_path"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.{Directions, Entities}

  @type validation_result :: %{
          rooms_checked: non_neg_integer(),
          rooms_reachable: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:orphan_room, String.t()}
          | {:broken_exit, String.t(), String.t(), String.t()}
          | {:invalid_exit_destination, String.t(), String.t(), String.t()}
          | {:invalid_exit_direction, String.t(), String.t()}

  @type warning ::
          {:missing_return_exit, String.t(), String.t(), String.t()}

  # Starting room key for BFS — update when world content changes
  @starting_room "awakening_clearing"

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates world connectivity and integrity.

  Options:
  - `:starting_room` - The prototype key to start BFS from (default: "awakening_clearing")
  - `:check_bidirectional` - Whether to warn about missing return exits (default: true)
  - `:check_live_entities` - Also check live entities in DB, not just prototypes (default: false)

  Returns `{:ok, results}` with validation results.
  """
  @spec validate(keyword()) :: {:ok, validation_result()}
  def validate(opts \\ []) do
    starting_room = Keyword.get(opts, :starting_room, @starting_room)
    check_bidirectional = Keyword.get(opts, :check_bidirectional, true)
    check_live = Keyword.get(opts, :check_live_entities, false)

    # Get all room prototypes (excluding templates and drafts)
    all_rooms =
      Entities.find_all(type: :room, is_prototype: true)
      |> Enum.reject(&is_template?/1)
      |> Enum.reject(&draft?/1)

    all_room_keys = MapSet.new(Enum.map(all_rooms, & &1.key))

    # BFS from starting room
    {reachable, exit_errors} = bfs_rooms(starting_room, all_room_keys)

    # Find rooms that are intentionally isolated (tagged with isolated_room)
    isolated_room_keys =
      all_rooms
      |> Enum.filter(&has_tag?(&1, "isolated_room"))
      |> Enum.map(& &1.key)
      |> MapSet.new()

    # Find orphan rooms (excluding intentionally isolated ones)
    orphan_errors =
      all_room_keys
      |> MapSet.difference(reachable)
      |> MapSet.difference(isolated_room_keys)
      |> Enum.map(&{:orphan_room, &1})

    # Check bidirectional exits
    bidirectional_warnings =
      if check_bidirectional do
        check_bidirectional_exits(all_rooms, reachable)
      else
        []
      end

    # Check live entities if requested
    live_errors =
      if check_live do
        validate_live_entities()
      else
        []
      end

    results = %{
      rooms_checked: MapSet.size(all_room_keys),
      rooms_reachable: MapSet.size(reachable),
      errors: exit_errors ++ orphan_errors ++ live_errors,
      warnings: bidirectional_warnings
    }

    Logger.info(
      "WorldValidator: Checked #{results.rooms_checked} rooms, " <>
        "#{results.rooms_reachable} reachable, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Returns true if validation passes (no errors).
  """
  @spec valid?(keyword()) :: boolean()
  def valid?(opts \\ []) do
    {:ok, results} = validate(opts)
    Enum.empty?(results.errors)
  end

  @doc """
  Formats validation results as a human-readable report.
  """
  @spec format_report(validation_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== World Validation Report ===",
      "",
      "Rooms checked: #{results.rooms_checked}",
      "Rooms reachable: #{results.rooms_reachable}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_warning/1) ++
          [""]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ warning_lines ++ status, "\n")
  end

  # =============================================================================
  # Private - BFS Traversal
  # =============================================================================

  defp bfs_rooms(nil, _valid_rooms), do: {MapSet.new(), []}

  defp bfs_rooms(starting_key, valid_rooms) do
    case Entities.find_one(key: starting_key, type: :room) do
      {:error, :not_found} ->
        {MapSet.new(), []}

      {:ok, _} ->
        queue = :queue.from_list([starting_key])
        visited = MapSet.new()
        errors = []

        do_bfs(queue, visited, errors, valid_rooms)
    end
  end

  defp do_bfs(queue, visited, errors, valid_rooms) do
    case :queue.out(queue) do
      {:empty, _} ->
        {visited, errors}

      {{:value, room_key}, queue} ->
        if MapSet.member?(visited, room_key) do
          do_bfs(queue, visited, errors, valid_rooms)
        else
          case Entities.find_one(key: room_key, type: :room) do
            {:error, :not_found} ->
              # This shouldn't happen if we're only queuing valid rooms
              do_bfs(queue, MapSet.put(visited, room_key), errors, valid_rooms)

            {:ok, prototype} ->
              exits = get_exits(prototype)

              # Check each exit destination
              {new_queue, new_errors} =
                Enum.reduce(exits, {queue, errors}, fn {direction, dest_key}, {q, errs} ->
                  cond do
                    # Check for invalid/diagonal directions
                    not Directions.valid?(direction) ->
                      error = {:invalid_exit_direction, room_key, direction}
                      {q, [error | errs]}

                    not MapSet.member?(valid_rooms, dest_key) ->
                      error = {:broken_exit, room_key, direction, dest_key}
                      {q, [error | errs]}

                    MapSet.member?(visited, dest_key) ->
                      {q, errs}

                    true ->
                      {:queue.in(dest_key, q), errs}
                  end
                end)

              do_bfs(new_queue, MapSet.put(visited, room_key), new_errors, valid_rooms)
          end
        end
    end
  end

  # =============================================================================
  # Private - Bidirectional Check
  # =============================================================================

  defp check_bidirectional_exits(rooms, reachable_keys) do
    rooms
    |> Enum.filter(&MapSet.member?(reachable_keys, &1.key))
    |> Enum.flat_map(fn room ->
      exits = get_exits(room)

      Enum.flat_map(exits, fn {direction, dest_key} ->
        case Entities.find_one(key: dest_key) do
          {:error, :not_found} ->
            []

          {:ok, dest_proto} ->
            dest_exits = get_exits(dest_proto)
            reverse_dir = reverse_direction(direction)

            if has_return_exit?(dest_exits, room.key, reverse_dir) do
              []
            else
              [{:missing_return_exit, room.key, direction, dest_key}]
            end
        end
      end)
    end)
  end

  defp has_return_exit?(exits, target_key, expected_dir) do
    Enum.any?(exits, fn {dir, dest} ->
      dest == target_key and (dir == expected_dir or dir == to_string(expected_dir))
    end)
  end

  defp reverse_direction("north"), do: "south"
  defp reverse_direction("south"), do: "north"
  defp reverse_direction("east"), do: "west"
  defp reverse_direction("west"), do: "east"
  defp reverse_direction("up"), do: "down"
  defp reverse_direction("down"), do: "up"
  defp reverse_direction(dir), do: "back_from_#{dir}"

  # =============================================================================
  # Private - Live Entity Validation
  # =============================================================================

  defp validate_live_entities do
    _rooms = Entities.list_entities(type: :room)
    exits = Entities.list_entities(type: :exit)

    # Check that all exit destinations exist
    Enum.flat_map(exits, fn exit ->
      dest_id = get_in(exit.components || %{}, ["exit", "destination_id"])

      if dest_id do
        case Entities.get_entity(dest_id) do
          nil -> [{:invalid_exit_destination, exit.key, exit.location_id, dest_id}]
          _ -> []
        end
      else
        []
      end
    end)
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp get_exits(proto) do
    components = proto.components || %{}
    exits = components["exits"] || %{}

    if is_map(exits) do
      Enum.map(exits, fn
        {dir, dest} when is_binary(dest) -> {to_string(dir), dest}
        {dir, %{"destination" => dest}} -> {to_string(dir), dest}
        {dir, %{destination: dest}} -> {to_string(dir), dest}
        {dir, _} -> {to_string(dir), nil}
      end)
      |> Enum.reject(fn {_, dest} -> is_nil(dest) end)
    else
      []
    end
  end

  # Check if an entity is a draft (should be excluded from validation)
  defp draft?(entity), do: get_in(entity.metadata || %{}, ["draft"]) == true

  # Check if a prototype is a template (should be excluded from validation)
  defp is_template?(proto) do
    components = proto.components || %{}
    is_template = components["is_template"]
    is_template == true or String.starts_with?(proto.key || "", "base_")
  end

  # Check if a prototype has a specific tag
  defp has_tag?(proto, tag) do
    tags = Map.get(proto, :tags) || []
    tag in tags
  end

  defp format_error({:orphan_room, key}) do
    "  - Orphan room: #{key} (not reachable from starting room)"
  end

  defp format_error({:broken_exit, room, dir, dest}) do
    "  - Broken exit: #{room} -> #{dir} -> #{dest} (destination not found)"
  end

  defp format_error({:invalid_exit_destination, exit_key, room_id, dest_id}) do
    "  - Invalid exit destination: #{exit_key} in #{room_id} -> #{dest_id} (entity not found)"
  end

  defp format_error({:invalid_exit_direction, room_key, direction}) do
    "  - Invalid exit direction: #{room_key} -> #{direction} (only north, south, east, west, up, down are allowed)"
  end

  defp format_warning({:missing_return_exit, room, dir, dest}) do
    "  - Missing return exit: #{room} -> #{dir} -> #{dest} (no return path)"
  end

  # =============================================================================
  # Wander Behavior Validation
  # =============================================================================

  @doc """
  Validates wander behavior configurations for NPCs.

  Checks that `allowed_rooms` form a connected subgraph - meaning an NPC
  can reach all allowed rooms from any starting allowed room.

  Returns `{:ok, results}` with validation results including:
  - `:wander_errors` - NPCs with disconnected allowed_rooms
  - `:wander_warnings` - NPCs with non-existent rooms in allowed_rooms

  ## Example

      {:ok, results} = WorldValidator.validate_wander_behaviors()

      # Results structure:
      %{
        npcs_checked: 3,
        errors: [
          {:disconnected_wander_rooms, "temple_cat", ["room_a", "room_c"], ["room_b"]}
        ],
        warnings: [
          {:nonexistent_wander_room, "guard_npc", "missing_room"}
        ]
      }
  """
  @spec validate_wander_behaviors(keyword()) :: {:ok, map()}
  def validate_wander_behaviors(opts \\ []) do
    # Get all NPC prototypes
    all_npcs =
      Entities.find_all(type: :npc, is_prototype: true)
      |> Enum.reject(&is_template?/1)

    # Get all room prototypes for validation
    all_room_keys =
      Entities.find_all(type: :room, is_prototype: true)
      |> Enum.reject(&is_template?/1)
      |> Enum.map(& &1.key)
      |> MapSet.new()

    # Build room adjacency graph
    room_graph = build_room_graph(all_room_keys)

    # Find NPCs with wander behavior
    wander_npcs = Enum.filter(all_npcs, &has_wander_behavior?/1)

    # Validate each NPC's wander config
    {errors, warnings} =
      Enum.reduce(wander_npcs, {[], []}, fn npc, {errs, warns} ->
        allowed_rooms = get_wander_allowed_rooms(npc)

        # Check for non-existent rooms
        nonexistent =
          Enum.reject(allowed_rooms, &MapSet.member?(all_room_keys, &1))

        new_warns =
          Enum.map(nonexistent, &{:nonexistent_wander_room, npc.key, &1}) ++ warns

        # Check connectivity among valid allowed rooms
        valid_allowed = Enum.filter(allowed_rooms, &MapSet.member?(all_room_keys, &1))

        case check_wander_connectivity(valid_allowed, room_graph) do
          :connected ->
            {errs, new_warns}

          {:disconnected, reachable, unreachable} ->
            error = {:disconnected_wander_rooms, npc.key, reachable, unreachable}
            {[error | errs], new_warns}
        end
      end)

    results = %{
      npcs_checked: length(wander_npcs),
      errors: errors,
      warnings: warnings
    }

    if Keyword.get(opts, :log, true) do
      Logger.info(
        "WanderValidator: Checked #{results.npcs_checked} NPCs, " <>
          "#{length(results.errors)} errors, " <>
          "#{length(results.warnings)} warnings"
      )
    end

    {:ok, results}
  end

  @doc """
  Formats wander validation results as a human-readable report.
  """
  @spec format_wander_report(map()) :: String.t()
  def format_wander_report(results) do
    lines = [
      "=== Wander Behavior Validation Report ===",
      "",
      "NPCs checked: #{results.npcs_checked}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_wander_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_wander_warning/1) ++
          [""]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ warning_lines ++ status, "\n")
  end

  # Build adjacency map of room connections
  defp build_room_graph(room_keys) do
    Enum.reduce(room_keys, %{}, fn room_key, graph ->
      case Entities.find_one(key: room_key) do
        {:ok, proto} ->
          exits = get_exits(proto)
          neighbors = Enum.map(exits, fn {_dir, dest} -> dest end)
          Map.put(graph, room_key, neighbors)

        {:error, _} ->
          graph
      end
    end)
  end

  # Check if NPC has wander trait
  defp has_wander_behavior?(npc) do
    traits = npc.traits || []

    Enum.any?(traits, fn t ->
      cond do
        is_map(t) -> Map.get(t, "script") == "wander"
        is_binary(t) -> String.contains?(t, "Wander") || t == "wander"
        is_atom(t) -> Atom.to_string(t) |> String.contains?("Wander")
        true -> false
      end
    end)
  end

  # Get allowed_rooms from wander config
  defp get_wander_allowed_rooms(npc) do
    components = npc.components || %{}
    trait_config = components["trait_config"] || %{}
    wander_config = trait_config["wander"] || %{}
    wander_config["allowed_rooms"] || []
  end

  # Check if allowed_rooms form a connected subgraph
  defp check_wander_connectivity([], _graph), do: :connected
  defp check_wander_connectivity([_single], _graph), do: :connected

  defp check_wander_connectivity(allowed_rooms, room_graph) do
    allowed_set = MapSet.new(allowed_rooms)
    [start | _] = allowed_rooms

    # BFS within allowed rooms only
    reachable = bfs_within_allowed(start, allowed_set, room_graph)

    unreachable =
      allowed_set
      |> MapSet.difference(reachable)
      |> MapSet.to_list()

    if Enum.empty?(unreachable) do
      :connected
    else
      {:disconnected, MapSet.to_list(reachable), unreachable}
    end
  end

  # BFS that only traverses within allowed rooms
  defp bfs_within_allowed(start, allowed_set, room_graph) do
    queue = :queue.from_list([start])
    visited = MapSet.new()
    do_bfs_allowed(queue, visited, allowed_set, room_graph)
  end

  defp do_bfs_allowed(queue, visited, allowed_set, room_graph) do
    case :queue.out(queue) do
      {:empty, _} ->
        visited

      {{:value, room}, queue} ->
        if MapSet.member?(visited, room) do
          do_bfs_allowed(queue, visited, allowed_set, room_graph)
        else
          neighbors = Map.get(room_graph, room, [])

          # Only queue neighbors that are in allowed_set
          valid_neighbors =
            Enum.filter(neighbors, fn n ->
              MapSet.member?(allowed_set, n) and not MapSet.member?(visited, n)
            end)

          new_queue = Enum.reduce(valid_neighbors, queue, &:queue.in(&1, &2))
          do_bfs_allowed(new_queue, MapSet.put(visited, room), allowed_set, room_graph)
        end
    end
  end

  defp format_wander_error({:disconnected_wander_rooms, npc, reachable, unreachable}) do
    "  - #{npc}: allowed_rooms not connected. Reachable: #{inspect(reachable)}, Unreachable: #{inspect(unreachable)}"
  end

  defp format_wander_warning({:nonexistent_wander_room, npc, room}) do
    "  - #{npc}: references non-existent room '#{room}' in allowed_rooms"
  end

  # =============================================================================
  # Entity-Prototype Sync Validation
  # =============================================================================

  @doc """
  Validates that spawned entities are in sync with their prototypes.

  This catches stale entities that were spawned before prototype updates.
  Common issues detected:
  - Missing components (e.g., ambient_actions added to prototype but entity lacks it)
  - Missing behaviors (e.g., new behavior added to prototype)

  Returns `{:ok, results}` with validation results including:
  - `:sync_errors` - Critical mismatches that affect functionality
  - `:sync_warnings` - Non-critical differences

  ## Example

      {:ok, results} = WorldValidator.validate_entity_prototype_sync()

      # Results structure:
      %{
        entities_checked: 15,
        errors: [
          {:missing_component, "thera", "2abc...", "ambient_actions"}
        ],
        warnings: []
      }
  """
  @spec validate_entity_prototype_sync(keyword()) :: {:ok, map()}
  def validate_entity_prototype_sync(opts \\ []) do
    # Components that should be checked for sync
    # These are components that affect runtime behavior
    critical_components =
      Keyword.get(opts, :critical_components, [
        "ambient_actions",
        "combatant",
        "dialogue_tree",
        "shop",
        "merchant",
        "loot"
      ])

    # Get all spawned entities (NPCs, items, and rooms)
    entities =
      Entities.list_entities(type: :npc) ++
        Entities.list_entities(type: :item) ++
        Entities.list_entities(type: :room)

    # Check each entity against its prototype
    {errors, warnings} =
      Enum.reduce(entities, {[], []}, fn entity, {errs, warns} ->
        check_entity_sync(entity, critical_components, errs, warns)
      end)

    results = %{
      entities_checked: length(entities),
      errors: errors,
      warnings: warnings
    }

    if Keyword.get(opts, :log, true) do
      Logger.info(
        "EntitySyncValidator: Checked #{results.entities_checked} entities, " <>
          "#{length(results.errors)} errors, " <>
          "#{length(results.warnings)} warnings"
      )
    end

    {:ok, results}
  end

  defp check_entity_sync(entity, critical_components, errors, warnings) do
    # Get the prototype for this entity (using the entity's key)
    prototype_key = get_prototype_key(entity)

    case Entities.find_one(key: prototype_key) do
      {:error, :not_found} ->
        # Prototype doesn't exist - that's a different kind of error
        {errors, warnings}

      {:ok, prototype} ->
        # Check for missing critical components
        entity_components = entity.components || %{}
        proto_components = prototype.components || %{}

        missing_components =
          critical_components
          |> Enum.filter(fn comp ->
            # Component exists in prototype but not in entity
            has_in_proto =
              Map.has_key?(proto_components, comp) or
                Map.has_key?(proto_components, String.to_atom(comp))

            has_in_entity =
              Map.has_key?(entity_components, comp) or
                Map.has_key?(entity_components, String.to_atom(comp))

            has_in_proto and not has_in_entity
          end)

        new_errors =
          Enum.map(missing_components, fn comp ->
            {:missing_component, entity.key, entity.id, comp, prototype_key}
          end) ++ errors

        {new_errors, warnings}
    end
  end

  # Get the prototype key for an entity
  # First check metadata.prototype_key, then fall back to entity.key
  defp get_prototype_key(entity) do
    metadata = entity.metadata || %{}

    cond do
      is_binary(metadata["prototype_key"]) -> metadata["prototype_key"]
      is_binary(Map.get(metadata, :prototype_key)) -> Map.get(metadata, :prototype_key)
      true -> entity.key
    end
  end

  @doc """
  Formats entity sync validation results as a human-readable report.
  """
  @spec format_entity_sync_report(map()) :: String.t()
  def format_entity_sync_report(results) do
    lines = [
      "=== Entity-Prototype Sync Validation Report ===",
      "",
      "Entities checked: #{results.entities_checked}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_sync_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_sync_warning/1) ++
          [""]
      else
        []
      end

    fix_hint =
      if Enum.any?(results.errors) do
        [
          "FIX: Respawn affected entities to sync with prototype:",
          "  Spawner.despawn(entity_id)",
          "  Spawner.spawn_at(prototype_key, room_id)",
          ""
        ]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ fix_hint ++ warning_lines ++ status, "\n")
  end

  defp format_sync_error({:missing_component, entity_key, entity_id, component, proto_key}) do
    "  - Entity '#{entity_key}' (#{String.slice(entity_id, 0..7)}...) missing '#{component}' component from prototype '#{proto_key}'"
  end

  defp format_sync_warning(warning) do
    "  - #{inspect(warning)}"
  end
end
