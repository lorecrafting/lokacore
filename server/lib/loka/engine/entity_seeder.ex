defmodule Loka.Engine.EntitySeeder do
  @moduledoc """
  Boot-time content seeder that populates the DB from YAML files.

  Replaces TypedObject.Loader as the V2 content loading system.
  Key difference: Loader populated ETS; Seeder populates SQLite DB.

  ## Phased Seeding Order

  1. Non-located entities (skills, quests, dialogues, zones, etc.)
  2. Rooms (must exist before exits reference them)
  3. Exits (need room UUIDs for destination_id)
  4. Located entities (NPCs, items — need room UUIDs for location_id)

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
  alias Loka.Utils.MapHelpers

  # YAML fields consumed during seeding (entity struct fields + aliases + transient)
  @consumed_fields MapSet.new(~w(
    key type short_desc long_desc extra_desc keywords primary_keyword mood
    is_prototype prototype_key location_id account_id
    components traits tags scripts metadata
    parent parent_key id name description extra_description
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
    yamls = load_all_yaml_files(paths)
    resolved = resolve_inheritance(yamls)

    # Phase 1: Non-located entities (no location_id needed)
    non_located_types = Enum.map(@non_located_types, &String.to_atom/1)
    count1 = seed_by_types(resolved, non_located_types)

    # Phase 2: Rooms (must exist before exits reference them)
    count2 = seed_by_types(resolved, [:room])

    # Phase 3: Exits (need room UUIDs for destination_id)
    count3 = seed_exits(resolved)

    # Phase 4: NPCs and items (need room UUIDs for location_id)
    count4 = seed_by_types(resolved, [:npc, :item])

    total = count1 + count2 + count3 + count4
    {:ok, total}
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
  # Inheritance Resolution
  # =============================================================================

  @doc """
  Resolves parent inheritance chains via topological sort + deep merge.

  Parents are resolved first, then children deep-merge over them.
  """
  def resolve_inheritance(raw_objects) do
    case build_resolution_order(raw_objects) do
      {:ok, order} ->
        Enum.reduce(order, %{}, fn key, acc ->
          raw = Map.fetch!(raw_objects, key)
          parent_key = raw["parent"] || raw["parent_key"]

          resolved =
            case parent_key && Map.get(acc, parent_key) do
              nil -> raw
              parent -> deep_merge_yaml(parent, raw)
            end

          Map.put(acc, key, resolved)
        end)

      {:error, _} ->
        raw_objects
    end
  end

  defp build_resolution_order(raw_objects) do
    keys = Map.keys(raw_objects)
    do_topological_sort(keys, raw_objects, [], MapSet.new())
  end

  defp do_topological_sort([], _raw, sorted, _visited) do
    {:ok, Enum.reverse(sorted)}
  end

  defp do_topological_sort(remaining, raw, sorted, visited) do
    {ready, not_ready} =
      Enum.split_with(remaining, fn key ->
        obj = Map.get(raw, key)
        parent = obj["parent"] || obj["parent_key"]
        parent == nil or MapSet.member?(visited, parent)
      end)

    cond do
      Enum.empty?(ready) and Enum.empty?(not_ready) ->
        {:ok, Enum.reverse(sorted)}

      Enum.empty?(ready) ->
        Logger.warning("EntitySeeder: broken parent refs: #{inspect(not_ready)}")
        {:ok, Enum.reverse(sorted) ++ not_ready}

      true ->
        new_visited = Enum.reduce(ready, visited, &MapSet.put(&2, &1))
        do_topological_sort(not_ready, raw, ready ++ sorted, new_visited)
    end
  end

  defp deep_merge_yaml(parent, child) do
    # Don't inherit identity fields from parent
    parent_cleaned = Map.drop(parent, ["key", "parent", "parent_key", "is_prototype", "id"])
    MapHelpers.deep_merge(parent_cleaned, child)
  end

  # =============================================================================
  # Phased Seeding
  # =============================================================================

  defp seed_by_types(resolved, types) do
    type_strings = Enum.map(types, &to_string/1)

    resolved
    |> Enum.filter(fn {_key, data} -> to_string(data["type"]) in type_strings end)
    |> Enum.reduce(0, fn {_key, data}, count ->
      case seed_entity(data) do
        {:ok, _} ->
          count + 1

        {:error, reason} ->
          Logger.debug("EntitySeeder: skip #{data["key"]}: #{inspect(reason)}")
          count
      end
    end)
  end

  defp seed_entity(data) do
    type = safe_to_atom(data["type"])

    unless EntityTypes.valid?(type) do
      {:error, {:invalid_type, data["type"]}}
    else
      key = data["key"]

      case Entities.find_one(key: key, type: type) do
        {:ok, existing} ->
          if existing.is_prototype do
            # Prototype exists — update from YAML (YAML is authoritative)
            entity = yaml_to_entity(data, existing.id)
            entity = %{entity | version: existing.version}
            Entities.save(entity)
          else
            # Instance — skip
            {:ok, existing}
          end

        {:error, :not_found} ->
          entity = yaml_to_entity(data)
          Entities.save(entity)
      end
    end
  end

  defp seed_exits(resolved) do
    rooms =
      Enum.filter(resolved, fn {_k, d} -> to_string(d["type"]) == "room" end)

    Enum.reduce(rooms, 0, fn {room_key, room_data}, count ->
      exits = room_data["exits"] || %{}

      Enum.reduce(exits, count, fn {direction, destination_key}, acc ->
        case seed_single_exit(room_key, to_string(direction), to_string(destination_key)) do
          {:ok, _} -> acc + 1
          {:error, _} -> acc
        end
      end)
    end)
  end

  defp seed_single_exit(room_key, direction, destination_key) do
    exit_key = "#{room_key}_#{direction}"

    # Skip if already exists
    case Entities.find_one(key: exit_key, type: :exit) do
      {:ok, existing} ->
        {:ok, existing}

      {:error, :not_found} ->
        with {:ok, source} <- Entities.find_one(key: room_key, type: :room),
             {:ok, dest} <- Entities.find_one(key: destination_key, type: :room) do
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

          # Create reciprocal exit if it doesn't exist
          maybe_create_reciprocal(destination_key, direction, room_key, dest.id, source.id)

          result
        else
          {:error, reason} ->
            Logger.debug("EntitySeeder: skip exit #{exit_key}: #{inspect(reason)}")

            {:error, reason}
        end
    end
  end

  defp maybe_create_reciprocal(dest_key, direction, source_key, dest_id, source_id) do
    reverse_dir = reverse_direction(direction)

    if reverse_dir do
      reverse_key = "#{dest_key}_#{reverse_dir}"

      case Entities.find_one(key: reverse_key, type: :exit) do
        {:ok, _} ->
          :ok

        {:error, :not_found} ->
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
      end
    end
  end

  @doc false
  def reverse_direction(direction), do: Map.get(@reverse_directions, direction)

  # =============================================================================
  # YAML → Entity Conversion
  # =============================================================================

  @doc """
  Converts a resolved YAML map to an Entity struct.
  """
  def yaml_to_entity(data, id \\ nil) do
    type = safe_to_atom(data["type"])
    parent_key = data["parent"] || data["parent_key"]

    # Build metadata with parent_key
    metadata = data["metadata"] || %{}

    metadata =
      if parent_key do
        Map.put(metadata, "parent_key", parent_key)
      else
        metadata
      end

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
        spawns when is_list(spawns) and length(spawns) > 0 ->
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
