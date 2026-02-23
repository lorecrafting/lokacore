defmodule Loka.Engine.EntitySeeder do
  @moduledoc """
  Boot-time content seeder that populates the DB from YAML files.

  Reads YAML prototype files and upserts them as entities in SQLite.

  ## Phased Seeding Order

  1. Non-located entities (skills, quests, dialogues, zones, etc.)
  2. Rooms (must exist before exits reference them)
  3. Exits (need room UUIDs for destination_id)
  4. Located entities (NPCs, items — need room UUIDs for location_id)
  5. Room spawn instances (NPCs/items declared in room YAML `spawns:` lists)

  ## Conflict Resolution

  | Scenario                    | Rule                        |
  |-----------------------------|-----------------------------|
  | New entity (key not in DB)  | Insert from YAML            |
  | Prototype exists in DB      | Update from YAML            |
  | Instance (non-prototype)    | Always skip                 |
  """

  use GenServer
  require Logger

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Engine.Constants.{WorldPaths, EntityTypes}

  # YAML fields consumed during seeding (entity struct fields + aliases + transient)
  @consumed_fields MapSet.new(~w(
    key type short_desc long_desc extra_desc keywords primary_keyword mood
    is_prototype prototype_key location_id account_id
    components traits tags scripts metadata
    id name description extra_description
    exits spawns attributes emotes
  ))

  # Types that don't have a location_id (seeded in Phase 1)
  @non_located_types ~w(skill quest dialogue zone storyline cutscene recipe resource status script gathering_node system social)

  @reverse_directions %{
    "north" => "south",
    "south" => "north",
    "east" => "west",
    "west" => "east",
    "up" => "down",
    "down" => "up",
    "northeast" => "southwest",
    "southwest" => "northeast",
    "northwest" => "southeast",
    "southeast" => "northwest"
  }

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc "Triggers a full seed from YAML files."
  def seed(server \\ __MODULE__) do
    GenServer.call(server, :seed, :infinity)
  end

  @doc "Reloads all YAML content (re-seeds from scratch)."
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload, :infinity)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    paths = Keyword.get(opts, :paths, WorldPaths.all_loader_paths())
    seed_on_start = Keyword.get(opts, :seed_on_start, true)

    # Don't seed on start in test mode
    seed_on_start = seed_on_start && Application.get_env(:loka, :env) != :test

    state = %{paths: paths}

    if seed_on_start do
      {:ok, count} = do_seed(paths)
      Logger.info("EntitySeeder: seeded #{count} entities from YAML")
      {:ok, state}
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call(:seed, _from, state) do
    {:reply, do_seed(state.paths), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    {:reply, do_seed(state.paths), state}
  end

  # =============================================================================
  # Core Seeding Logic
  # =============================================================================

  @doc false
  def do_seed(paths) do
    resolved = load_all_yaml_files(paths)

    # Preload all existing entities into a lookup map to avoid N+1 queries.
    # Key: {key, type} → entity. This turns ~350 individual queries into 1.
    existing_map = preload_existing_entities()

    # Phase 1: Non-located entities (no location_id needed)
    non_located_types = Enum.map(@non_located_types, &String.to_atom/1)
    count1 = seed_by_types(resolved, non_located_types, existing_map)

    # Phase 2: Rooms (must exist before exits reference them)
    count2 = seed_by_types(resolved, [:room], existing_map)

    # Refresh map after rooms are seeded — exits need room UUIDs
    existing_map = preload_existing_entities()

    # Phase 3: Exits (need room UUIDs for destination_id)
    count3 = seed_exits(resolved, existing_map)

    # Phase 4: NPCs and items (need room UUIDs for location_id)
    count4 = seed_by_types(resolved, [:npc, :item], existing_map)

    # Refresh map after NPCs/items are seeded — spawn lookup needs prototype UUIDs
    existing_map = preload_existing_entities()

    # Phase 5: Room spawn lists (instantiate NPCs/items declared in room YAML spawns:)
    count5 = seed_room_spawns(existing_map)

    total = count1 + count2 + count3 + count4 + count5
    {:ok, total}
  end

  defp preload_existing_entities do
    # Prefer prototypes over instances: if both share a key+type, the prototype wins.
    # Without this, instances overwrite prototypes in the map and EntitySeeder
    # skips YAML updates (thinking the entity is an instance).
    Entities.find_all([])
    |> Enum.reduce(%{}, fn entity, acc ->
      key = {entity.key, entity.type}

      case Map.get(acc, key) do
        %{is_prototype: true} ->
          # Prototype already in map — don't overwrite with an instance
          acc

        _ ->
          Map.put(acc, key, entity)
      end
    end)
  end

  # =============================================================================
  # YAML Loading
  # =============================================================================

  defp load_all_yaml_files(paths) do
    paths
    |> Enum.flat_map(fn path ->
      full_path = resolve_path(path)

      if File.exists?(full_path) do
        Path.wildcard(Path.join([full_path, "**", "*.{yml,yaml}"]))
      else
        []
      end
    end)
    |> Enum.reduce(%{}, fn file, acc ->
      case parse_yaml_file(file) do
        {:ok, key, data} ->
          Map.put(acc, key, data)

        {:error, reason} ->
          Logger.debug("EntitySeeder: skipping #{file}: #{inspect(reason)}")
          acc
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} when is_map(data) <- YamlElixir.read_from_string(content) do
      data = normalize_key(data)
      data = infer_type_from_path(data, file)
      data = maybe_mark_draft(data, file)

      case data["key"] do
        nil -> {:error, :no_key}
        key -> {:ok, key, data}
      end
    else
      _ -> {:error, :parse_failed}
    end
  end

  defp normalize_key(data) do
    if data["key"] do
      data
    else
      id = data["id"]
      if id, do: Map.put(data, "key", to_string(id)), else: data
    end
  end

  defp infer_type_from_path(data, file) do
    path_parts = file |> Path.split() |> Enum.map(&String.downcase/1)
    current_type = data["type"]

    # If type is already a valid V2 entity type atom name, keep it
    if current_type && EntityTypes.valid?(safe_to_atom(current_type)) do
      data
    else
      inferred =
        cond do
          "npcs" in path_parts -> "npc"
          "rooms" in path_parts -> "room"
          "items" in path_parts -> "item"
          "exits" in path_parts -> "exit"
          "quests" in path_parts -> "quest"
          "dialogues" in path_parts -> "dialogue"
          "scripts" in path_parts -> "script"
          "zones" in path_parts -> "zone"
          "storylines" in path_parts -> "storyline"
          "skills" in path_parts -> "skill"
          "statuses" in path_parts -> "status"
          "resources" in path_parts -> "resource"
          "recipes" in path_parts -> "recipe"
          "nodes" in path_parts -> "resource"
          "_base" in path_parts -> nil
          "_templates" in path_parts -> nil
          true -> nil
        end

      if inferred do
        # For quests, preserve the original type value (e.g., "main", "side")
        data =
          if inferred == "quest" && current_type && current_type != "quest" do
            Map.put(data, "quest_type", current_type)
          else
            data
          end

        Map.put(data, "type", inferred)
      else
        data
      end
    end
  end

  defp maybe_mark_draft(data, file) do
    if file |> Path.split() |> Enum.any?(&(&1 == "drafts")) do
      metadata = data["metadata"] || %{}
      Map.put(data, "metadata", Map.put(metadata, "draft", true))
    else
      data
    end
  end

  # =============================================================================
  # Phased Seeding
  # =============================================================================

  defp seed_by_types(resolved, types, existing_map) do
    type_strings = Enum.map(types, &to_string/1)

    resolved
    |> Enum.filter(fn {_key, data} -> to_string(data["type"]) in type_strings end)
    |> Enum.reduce(0, fn {_key, data}, count ->
      case seed_entity(data, existing_map) do
        {:ok, _} ->
          count + 1

        {:error, reason} ->
          Logger.debug("EntitySeeder: skip #{data["key"]}: #{inspect(reason)}")
          count
      end
    end)
  end

  defp seed_entity(data, existing_map) do
    type = safe_to_atom(data["type"])

    unless EntityTypes.valid?(type) do
      {:error, {:invalid_type, data["type"]}}
    else
      key = data["key"]

      case Map.get(existing_map, {key, type}) do
        %Entity{} = existing ->
          if existing.is_prototype do
            # Prototype exists — update from YAML (YAML is authoritative)
            entity = yaml_to_entity(data, existing.id)
            entity = %{entity | version: existing.version}
            Entities.save(entity)
          else
            # Instance — skip
            {:ok, existing}
          end

        nil ->
          entity = yaml_to_entity(data)
          Entities.save(entity)
      end
    end
  end

  defp seed_exits(resolved, existing_map) do
    rooms =
      Enum.filter(resolved, fn {_k, d} -> to_string(d["type"]) == "room" end)

    # Build key→entity lookup for rooms (avoid per-exit DB queries)
    room_lookup =
      existing_map
      |> Enum.filter(fn {{_key, type}, _entity} -> type == :room end)
      |> Map.new(fn {{key, _type}, entity} -> {key, entity} end)

    # Build seen set from existing exits — threaded through accumulator so
    # reciprocals created mid-seeding don't cause duplicates on the next room.
    seen =
      existing_map
      |> Enum.filter(fn {{_key, type}, _entity} -> type == :exit end)
      |> Enum.map(fn {{key, _type}, _entity} -> key end)
      |> MapSet.new()

    # Build set of all exits explicitly defined in room YAML (format: "room_key_direction").
    # Used to prevent reciprocal auto-creation from overriding explicit exits.
    # Example: if threshold_gate.yml says `south: planet_the_edge`, the reciprocal of
    # `the_edge north: threshold_gate` (which would be threshold_gate_south → the_edge)
    # must NOT be created — the explicit definition takes precedence.
    explicit_exits =
      rooms
      |> Enum.flat_map(fn {room_key, room_data} ->
        exits = room_data["exits"] || %{}
        Enum.map(exits, fn {dir, _dest} -> "#{room_key}_#{to_string(dir)}" end)
      end)
      |> MapSet.new()

    {count, _seen} =
      Enum.reduce(rooms, {0, seen}, fn {room_key, room_data}, {count, seen_acc} ->
        exits = room_data["exits"] || %{}

        Enum.reduce(exits, {count, seen_acc}, fn {direction, destination_key}, {acc, s} ->
          case seed_single_exit(
                 room_key,
                 to_string(direction),
                 to_string(destination_key),
                 room_lookup,
                 s,
                 explicit_exits
               ) do
            {:ok, _entity, updated_seen} -> {acc + 1, updated_seen}
            {:skip, updated_seen} -> {acc, updated_seen}
            {:error, _} -> {acc, s}
          end
        end)
      end)

    count
  end

  defp seed_single_exit(room_key, direction, destination_key, room_lookup, seen, explicit_exits) do
    exit_key = "#{room_key}_#{direction}"

    if MapSet.member?(seen, exit_key) do
      {:skip, seen}
    else
      source = Map.get(room_lookup, room_key)
      dest = Map.get(room_lookup, destination_key)

      if source && dest do
        entity =
          Entity.new(%{
            type: :exit,
            key: exit_key,
            location_id: source.id,
            is_prototype: false,
            components: %{
              "exit" => %{
                "direction" => direction,
                "destination_id" => dest.id,
                "destination_key" => destination_key
              }
            }
          })

        result = Entities.save(entity)
        seen = MapSet.put(seen, exit_key)

        # Create reciprocal only if not already seen AND the destination room doesn't
        # explicitly define its own exit in the reverse direction. This prevents a
        # reciprocal from overriding an explicit cross-zone exit (e.g., the_edge north →
        # threshold_gate creating a reciprocal threshold_gate south → the_edge, which
        # would override the explicit threshold_gate south: planet_the_edge).
        {seen, _} =
          maybe_create_reciprocal(
            destination_key,
            direction,
            room_key,
            dest.id,
            source.id,
            seen,
            explicit_exits
          )

        case result do
          {:ok, _} -> {:ok, entity, seen}
          {:error, _} = err -> err
        end
      else
        Logger.debug("EntitySeeder: skip exit #{exit_key}: room not found")
        {:error, :room_not_found}
      end
    end
  end

  defp maybe_create_reciprocal(
         dest_key,
         direction,
         source_key,
         dest_id,
         source_id,
         seen,
         explicit_exits
       ) do
    reverse_dir = reverse_direction(direction)

    if reverse_dir do
      reverse_key = "#{dest_key}_#{reverse_dir}"

      cond do
        MapSet.member?(seen, reverse_key) ->
          # Already created (explicit or earlier reciprocal) — skip
          {seen, :skipped}

        MapSet.member?(explicit_exits, reverse_key) ->
          # Destination room has an explicit exit in this direction in its YAML.
          # Don't create a reciprocal — the explicit definition will be processed
          # when we reach that room, and it may point to a different destination.
          {seen, :deferred_to_explicit}

        true ->
          entity =
            Entity.new(%{
              type: :exit,
              key: reverse_key,
              location_id: dest_id,
              is_prototype: false,
              components: %{
                "exit" => %{
                  "direction" => reverse_dir,
                  "destination_id" => source_id,
                  "destination_key" => source_key
                }
              }
            })

          Entities.save(entity)
          {MapSet.put(seen, reverse_key), :created}
      end
    else
      {seen, :no_reverse}
    end
  end

  @doc false
  def reverse_direction(direction), do: Map.get(@reverse_directions, direction)

  # =============================================================================
  # Room Spawn Seeding
  # =============================================================================

  # For each room entity in the DB that has a spawns list in components["spawns"],
  # instantiate any missing NPC/item instances in that room.
  # Skips spawns that already have an existing instance (non-prototype) in the room.
  defp seed_room_spawns(existing_map) do
    rooms =
      existing_map
      |> Map.values()
      |> Enum.filter(&(&1.type == :room))

    # Build a set of {key, location_id} pairs for non-prototype instances already in the DB.
    # This must be a fresh DB query — existing_map only contains prototypes (by design, to
    # prevent YAML updates from being skipped). Using existing_map for spawn idempotency
    # would always return false (no instances in map) and accumulate clones across seed runs.
    spawned_set =
      Entities.find_all(is_prototype: false)
      |> Enum.map(fn e -> {e.key, e.location_id} end)
      |> MapSet.new()

    Enum.reduce(rooms, 0, fn room, total ->
      spawns = (room.components || %{})["spawns"] || []
      total + seed_spawns_for_room(room, spawns, spawned_set)
    end)
  end

  defp seed_spawns_for_room(_room, [], _spawned_set), do: 0

  defp seed_spawns_for_room(room, spawns, spawned_set) do
    Enum.reduce(spawns, 0, fn spawn_config, count ->
      prototype_key = spawn_config["prototype"]

      cond do
        is_nil(prototype_key) ->
          Logger.warning("EntitySeeder: spawn config missing 'prototype' key in room #{room.key}")
          count

        MapSet.member?(spawned_set, {prototype_key, room.id}) ->
          count

        true ->
          case Loka.Engine.Spawner.spawn(prototype_key, location_id: room.id) do
            {:ok, _entity} ->
              count + 1

            {:error, reason} ->
              Logger.warning(
                "EntitySeeder: failed to spawn #{prototype_key} in #{room.key}: #{inspect(reason)}"
              )

              count
          end
      end
    end)
  end

  # =============================================================================
  # YAML → Entity Conversion
  # =============================================================================

  @doc """
  Converts a resolved YAML map to an Entity struct.
  """
  def yaml_to_entity(data, id \\ nil) do
    type = safe_to_atom(data["type"])
    metadata = data["metadata"] || %{}

    # Build components from explicit components + extra fields
    components = build_components(data)

    Entity.new(%{
      id: id || Ecto.UUID.generate(),
      type: type,
      key: data["key"],
      short_desc: data["short_desc"] || data["name"],
      long_desc: data["long_desc"] || data["description"],
      extra_desc: data["extra_desc"] || data["extra_description"],
      keywords: data["keywords"] || [],
      primary_keyword: data["primary_keyword"],
      mood: data["mood"],
      is_prototype: Map.get(data, "is_prototype", true),
      prototype_key: data["prototype_key"],
      location_id: data["location_id"],
      account_id: data["account_id"],
      traits: data["traits"] || [],
      tags: data["tags"] || [],
      scripts: data["scripts"] || %{},
      metadata: metadata,
      components: components
    })
  end

  defp build_components(data) do
    # Start with explicit components from YAML
    components = data["components"] || %{}

    # Merge attributes into components
    components =
      case data["attributes"] do
        attrs when is_map(attrs) and map_size(attrs) > 0 ->
          Map.put(components, "attributes", attrs)

        _ ->
          components
      end

    # Merge emotes into components
    components =
      case data["emotes"] do
        emotes when is_map(emotes) and map_size(emotes) > 0 ->
          Map.put(components, "emotes", emotes)

        _ ->
          components
      end

    # Store spawns in components
    components =
      case data["spawns"] do
        [_ | _] = spawns ->
          Map.put(components, "spawns", spawns)

        _ ->
          components
      end

    # Store exits in components for reference
    components =
      case data["exits"] do
        exits when is_map(exits) and map_size(exits) > 0 ->
          Map.put(components, "exits", exits)

        _ ->
          components
      end

    # For content types, extra fields (objectives, rewards, etc.) go into components
    extra_fields =
      data
      |> Map.drop(MapSet.to_list(@consumed_fields))
      |> Map.reject(fn {_k, v} -> is_nil(v) end)

    if map_size(extra_fields) > 0 do
      # Content-specific fields go into components["data"] so that
      # Entity.to_typed_object can find them in the data map.
      existing_data = components["data"] || %{}
      Map.put(components, "data", Map.merge(existing_data, extra_fields))
    else
      components
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp safe_to_atom(value) when is_atom(value), do: value
  defp safe_to_atom(value) when is_binary(value), do: String.to_atom(value)
  defp safe_to_atom(_), do: nil
end
