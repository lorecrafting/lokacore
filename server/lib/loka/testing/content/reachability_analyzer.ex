defmodule Loka.Testing.Content.ReachabilityAnalyzer do
  @moduledoc """
  Analyzes content reachability to find orphaned or unobtainable content.

  Identifies content that exists but can never be encountered by players:
  - NPCs in unreachable rooms
  - Items that cannot be obtained (not in shops, quests, drops, or world spawns)
  - Quest givers that are inaccessible
  - Gathering nodes in unreachable areas

  ## Usage

      {:ok, results} = ReachabilityAnalyzer.analyze()

      # Get detailed report
      report = ReachabilityAnalyzer.format_report(results)

  ## Result Structure

      %{
        analysis_complete: true,
        errors: [
          {:unreachable_npc, "goblin_king", "hidden_cave"},
          {:unobtainable_item, "legendary_sword"},
          {:unreachable_quest_giver, "hermit", "lost_valley"}
        ],
        warnings: [
          {:item_only_from_quest, "magic_key", "dungeon_quest"},
          {:npc_only_in_instance, "boss", "dungeon_instance"}
        ],
        stats: %{
          total_npcs: 30,
          reachable_npcs: 28,
          total_items: 50,
          obtainable_items: 45,
          ...
        }
      }
  """

  require Logger

  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader
  alias Loka.Framework.Quest.QuestRegistry
  alias Loka.Framework.Crafting.CraftingRegistry

  @type analysis_result :: %{
          analysis_complete: boolean(),
          errors: [error()],
          warnings: [warning()],
          stats: map()
        }

  @type error ::
          {:unreachable_npc, String.t(), String.t()}
          | {:unobtainable_item, String.t()}
          | {:unreachable_quest_giver, String.t(), String.t()}
          | {:unreachable_gathering_node, String.t(), String.t()}

  @type warning ::
          {:item_only_from_quest, String.t(), String.t()}
          | {:item_only_from_craft, String.t(), String.t()}
          | {:item_only_from_drop, String.t(), String.t()}
          | {:npc_in_single_room, String.t(), String.t()}

  @starting_room "monastery_gate"

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Analyzes content reachability across the entire world.

  Returns `{:ok, results}` with analysis results.
  """
  @spec analyze() :: {:ok, analysis_result()}
  def analyze do
    # Step 1: Find all reachable rooms
    reachable_rooms = find_reachable_rooms()

    # Step 2: Check NPC reachability
    {npc_errors, npc_warnings, npc_stats} = analyze_npc_reachability(reachable_rooms)

    # Step 3: Check item obtainability
    {item_errors, item_warnings, item_stats} = analyze_item_obtainability(reachable_rooms)

    # Step 4: Check quest giver accessibility
    {quest_errors, quest_warnings, quest_stats} =
      analyze_quest_giver_accessibility(reachable_rooms)

    # Step 5: Check gathering node accessibility
    {gathering_errors, gathering_warnings, gathering_stats} =
      analyze_gathering_accessibility(reachable_rooms)

    results = %{
      analysis_complete: true,
      errors: npc_errors ++ item_errors ++ quest_errors ++ gathering_errors,
      warnings: npc_warnings ++ item_warnings ++ quest_warnings ++ gathering_warnings,
      stats:
        Map.merge(npc_stats, item_stats)
        |> Map.merge(quest_stats)
        |> Map.merge(gathering_stats)
        |> Map.put(:reachable_rooms, MapSet.size(reachable_rooms))
    }

    Logger.info(
      "ReachabilityAnalyzer: #{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Returns true if analysis passes (no errors).
  """
  @spec valid?() :: boolean()
  def valid? do
    {:ok, results} = analyze()
    Enum.empty?(results.errors)
  end

  @doc """
  Formats analysis results as a human-readable report.
  """
  @spec format_report(analysis_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== Reachability Analysis Report ===",
      "",
      "Stats:",
      "  Reachable rooms: #{results.stats[:reachable_rooms]}",
      "  NPCs: #{results.stats[:reachable_npcs]}/#{results.stats[:total_npcs]} reachable",
      "  Items: #{results.stats[:obtainable_items]}/#{results.stats[:total_items]} obtainable",
      "  Quest givers: #{results.stats[:accessible_quest_givers]}/#{results.stats[:total_quest_givers]} accessible",
      "",
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
  # Private - Room Reachability
  # =============================================================================

  defp find_reachable_rooms do
    all_rooms =
      TypedObjectLoader.list_by_type(:entity, :room)
      |> Enum.reject(&is_template?/1)

    all_room_keys = MapSet.new(Enum.map(all_rooms, & &1.key))

    # BFS from starting room
    case TypedObjectLoader.get(@starting_room) do
      {:error, :not_found} ->
        MapSet.new()

      {:ok, _} ->
        queue = :queue.from_list([@starting_room])
        visited = MapSet.new()
        bfs_rooms(queue, visited, all_room_keys)
    end
  end

  defp bfs_rooms(queue, visited, valid_rooms) do
    case :queue.out(queue) do
      {:empty, _} ->
        visited

      {{:value, room_key}, queue} ->
        if MapSet.member?(visited, room_key) do
          bfs_rooms(queue, visited, valid_rooms)
        else
          case TypedObjectLoader.get(room_key) do
            {:error, :not_found} ->
              bfs_rooms(queue, MapSet.put(visited, room_key), valid_rooms)

            {:ok, prototype} ->
              exits = get_exits(prototype)

              new_queue =
                Enum.reduce(exits, queue, fn {_dir, dest_key}, q ->
                  if MapSet.member?(valid_rooms, dest_key) and
                       not MapSet.member?(visited, dest_key) do
                    :queue.in(dest_key, q)
                  else
                    q
                  end
                end)

              bfs_rooms(new_queue, MapSet.put(visited, room_key), valid_rooms)
          end
        end
    end
  end

  # =============================================================================
  # Private - NPC Reachability
  # =============================================================================

  defp analyze_npc_reachability(reachable_rooms) do
    npcs =
      TypedObjectLoader.list_by_type(:entity, :npc)
      |> Enum.reject(&is_template?/1)

    # Build map of NPC -> rooms where they spawn
    npc_locations = build_npc_location_map()

    errors = []
    warnings = []
    reachable_count = 0

    {errors, warnings, reachable_count} =
      Enum.reduce(npcs, {errors, warnings, reachable_count}, fn npc, {errs, warns, count} ->
        locations = Map.get(npc_locations, npc.key, [])

        cond do
          # NPC has no spawn location defined (might be spawned dynamically)
          Enum.empty?(locations) ->
            # Check if NPC is spawned by another system (quests, combat, etc)
            if spawned_by_system?(npc) do
              {errs, warns, count + 1}
            else
              # Warn but don't error - might be spawned programmatically
              {errs, warns, count}
            end

          # All spawn locations are unreachable
          Enum.all?(locations, &(not MapSet.member?(reachable_rooms, &1))) ->
            first_location = List.first(locations)
            {[{:unreachable_npc, npc.key, first_location} | errs], warns, count}

          # Some locations are reachable
          true ->
            reachable_locs = Enum.filter(locations, &MapSet.member?(reachable_rooms, &1))

            warns =
              if length(reachable_locs) == 1 do
                [{:npc_in_single_room, npc.key, List.first(reachable_locs)} | warns]
              else
                warns
              end

            {errs, warns, count + 1}
        end
      end)

    stats = %{
      total_npcs: length(npcs),
      reachable_npcs: reachable_count
    }

    {errors, warnings, stats}
  end

  defp build_npc_location_map do
    # Find all rooms and their spawned NPCs
    rooms = TypedObjectLoader.list_by_type(:entity, :room)

    Enum.reduce(rooms, %{}, fn room, acc ->
      npcs_in_room = get_npcs_in_room(room)

      Enum.reduce(npcs_in_room, acc, fn npc_key, inner_acc ->
        Map.update(inner_acc, npc_key, [room.key], &[room.key | &1])
      end)
    end)
  end

  defp get_npcs_in_room(room) do
    # Check spawns list in room prototype (rooms use `spawns` not `entities`)
    spawns = get_in(room, [Access.key(:data, %{}), "spawns"]) || []

    spawns
    |> Enum.filter(fn spawn ->
      case spawn do
        %{"type" => "npc"} -> true
        %{type: :npc} -> true
        %{"prototype" => key} -> npc_key?(key)
        %{prototype: key} -> npc_key?(key)
        key when is_binary(key) -> npc_key?(key)
        _ -> false
      end
    end)
    |> Enum.map(fn spawn ->
      case spawn do
        %{"prototype" => key} -> key
        %{prototype: key} -> key
        %{"key" => key} -> key
        %{key: key} -> key
        key when is_binary(key) -> key
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp npc_key?(key) do
    case TypedObjectLoader.get(key) do
      {:ok, proto} -> proto.subtype == :npc
      _ -> false
    end
  end

  defp spawned_by_system?(npc) do
    # Check if NPC is spawned by combat, quests, or other systems
    components = npc.components || %{}

    # Has boss component (likely spawned in dungeon)
    has_boss = Map.has_key?(components, "boss") or Map.has_key?(components, :boss)

    # Has spawner component
    has_spawner = Map.has_key?(components, "spawner") or Map.has_key?(components, :spawner)

    has_boss or has_spawner
  end

  # =============================================================================
  # Private - Item Obtainability
  # =============================================================================

  defp analyze_item_obtainability(reachable_rooms) do
    items =
      TypedObjectLoader.list_by_type(:entity, :item)
      |> Enum.reject(&is_template?/1)

    # Build sources for each item
    item_sources = build_item_source_map(reachable_rooms)

    errors = []
    warnings = []
    obtainable_count = 0

    {errors, warnings, obtainable_count} =
      Enum.reduce(items, {errors, warnings, obtainable_count}, fn item, {errs, warns, count} ->
        sources = Map.get(item_sources, item.key, [])

        cond do
          Enum.empty?(sources) ->
            # Item has no known source - might be unobtainable
            {[{:unobtainable_item, item.key} | errs], warns, count}

          length(sources) == 1 ->
            # Single source - warn for awareness
            source = List.first(sources)

            warns =
              case source do
                {:quest, quest_id} ->
                  [{:item_only_from_quest, item.key, quest_id} | warns]

                {:craft, recipe_id} ->
                  [{:item_only_from_craft, item.key, recipe_id} | warns]

                {:drop, npc_key} ->
                  [{:item_only_from_drop, item.key, npc_key} | warns]

                _ ->
                  warns
              end

            {errs, warns, count + 1}

          true ->
            {errs, warns, count + 1}
        end
      end)

    stats = %{
      total_items: length(items),
      obtainable_items: obtainable_count
    }

    {errors, warnings, stats}
  end

  defp build_item_source_map(reachable_rooms) do
    sources = %{}

    # Source 1: Quest rewards
    sources = add_quest_reward_sources(sources)

    # Source 2: Crafting outputs
    sources = add_crafting_sources(sources)

    # Source 3: NPC drops (loot tables)
    sources = add_drop_sources(sources)

    # Source 4: World spawns (items in reachable rooms)
    sources = add_world_spawn_sources(sources, reachable_rooms)

    # Source 5: Shop inventories
    sources = add_shop_sources(sources, reachable_rooms)

    # Source 6: Dialogue rewards (give_item actions)
    sources = add_dialogue_sources(sources)

    # Source 7: Time-locked items in rooms
    sources = add_time_locked_sources(sources, reachable_rooms)

    # Source 8: Gathering node yields
    sources = add_gathering_node_sources(sources, reachable_rooms)

    # Source 9: NPC gives_items component
    sources = add_npc_gives_items_sources(sources, reachable_rooms)

    sources
  end

  defp add_quest_reward_sources(sources) do
    if Process.whereis(QuestRegistry) do
      quests = QuestRegistry.all()

      Enum.reduce(quests, sources, fn quest, acc ->
        reward_items = get_quest_reward_items(quest)

        Enum.reduce(reward_items, acc, fn item_key, inner_acc ->
          Map.update(inner_acc, item_key, [{:quest, quest.id}], &[{:quest, quest.id} | &1])
        end)
      end)
    else
      sources
    end
  end

  defp get_quest_reward_items(quest) do
    rewards = quest.rewards || %{}
    items = Map.get(rewards, :items) || Map.get(rewards, "items") || []
    List.wrap(items) |> List.flatten()
  end

  defp add_crafting_sources(sources) do
    if Process.whereis(CraftingRegistry) do
      recipes = CraftingRegistry.all()

      Enum.reduce(recipes, sources, fn recipe, acc ->
        # Recipe output can be a list of items with chances
        outputs = recipe.output || recipe.result || []

        Enum.reduce(List.wrap(outputs), acc, fn output_entry, inner_acc ->
          item_key =
            case output_entry do
              %{item: key} -> key
              %{"item" => key} -> key
              key when is_binary(key) -> key
              _ -> nil
            end

          if item_key do
            recipe_key = recipe.key || recipe.id || "unknown_recipe"
            Map.update(inner_acc, item_key, [{:craft, recipe_key}], &[{:craft, recipe_key} | &1])
          else
            inner_acc
          end
        end)
      end)
    else
      sources
    end
  end

  defp add_drop_sources(sources) do
    npcs = TypedObjectLoader.list_by_type(:entity, :npc)

    Enum.reduce(npcs, sources, fn npc, acc ->
      components = npc.components || %{}
      loot = Map.get(components, "loot") || Map.get(components, :loot) || %{}

      # Check both "items" and "drops" keys (different formats in YAML)
      items =
        Map.get(loot, "items") || Map.get(loot, :items) ||
          Map.get(loot, "drops") || Map.get(loot, :drops) || []

      Enum.reduce(items, acc, fn item_entry, inner_acc ->
        item_key =
          case item_entry do
            %{"key" => k} -> k
            %{key: k} -> k
            %{"item" => k} -> k
            %{item: k} -> k
            k when is_binary(k) -> k
            _ -> nil
          end

        if item_key do
          Map.update(inner_acc, item_key, [{:drop, npc.key}], &[{:drop, npc.key} | &1])
        else
          inner_acc
        end
      end)
    end)
  end

  defp add_world_spawn_sources(sources, reachable_rooms) do
    rooms =
      TypedObjectLoader.list_by_type(:entity, :room)
      |> Enum.filter(&MapSet.member?(reachable_rooms, &1.key))

    Enum.reduce(rooms, sources, fn room, acc ->
      items_in_room = get_items_in_room(room)

      Enum.reduce(items_in_room, acc, fn item_key, inner_acc ->
        Map.update(inner_acc, item_key, [{:world, room.key}], &[{:world, room.key} | &1])
      end)
    end)
  end

  defp get_items_in_room(room) do
    # Check spawns list in room prototype
    spawns = get_in(room, [Access.key(:data, %{}), "spawns"]) || []

    spawns
    |> Enum.filter(fn spawn ->
      case spawn do
        %{"type" => "item"} -> true
        %{type: :item} -> true
        %{"prototype" => key} -> item_key?(key)
        %{prototype: key} -> item_key?(key)
        key when is_binary(key) -> item_key?(key)
        _ -> false
      end
    end)
    |> Enum.map(fn spawn ->
      case spawn do
        %{"prototype" => key} -> key
        %{prototype: key} -> key
        %{"key" => key} -> key
        %{key: key} -> key
        key when is_binary(key) -> key
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp item_key?(key) do
    case TypedObjectLoader.get(key) do
      {:ok, proto} -> proto.subtype == :item
      _ -> false
    end
  end

  defp add_shop_sources(sources, reachable_rooms) do
    npcs = TypedObjectLoader.list_by_type(:entity, :npc)

    # Only consider NPCs in reachable rooms
    npc_locations = build_npc_location_map()

    Enum.reduce(npcs, sources, fn npc, acc ->
      locations = Map.get(npc_locations, npc.key, [])
      in_reachable = Enum.any?(locations, &MapSet.member?(reachable_rooms, &1))

      if in_reachable do
        components = npc.components || %{}
        shop = Map.get(components, "shop") || Map.get(components, :shop) || %{}

        # Check both "items" and "sells" keys (different formats in YAML)
        items =
          Map.get(shop, "items") || Map.get(shop, :items) ||
            Map.get(shop, "sells") || Map.get(shop, :sells) || []

        Enum.reduce(items, acc, fn item_entry, inner_acc ->
          item_key =
            case item_entry do
              %{"key" => k} -> k
              %{key: k} -> k
              k when is_binary(k) -> k
              _ -> nil
            end

          if item_key do
            Map.update(inner_acc, item_key, [{:shop, npc.key}], &[{:shop, npc.key} | &1])
          else
            inner_acc
          end
        end)
      else
        acc
      end
    end)
  end

  defp add_dialogue_sources(sources) do
    npcs = TypedObjectLoader.list_by_type(:entity, :npc)

    Enum.reduce(npcs, sources, fn npc, acc ->
      components = npc.components || %{}

      dialogue_tree =
        Map.get(components, "dialogue_tree") ||
          Map.get(components, :dialogue_tree) ||
          %{}

      # Find all give_item actions in dialogue
      items_given = extract_dialogue_items(dialogue_tree)

      Enum.reduce(items_given, acc, fn item_key, inner_acc ->
        Map.update(inner_acc, item_key, [{:dialogue, npc.key}], &[{:dialogue, npc.key} | &1])
      end)
    end)
  end

  defp extract_dialogue_items(dialogue_tree) when is_map(dialogue_tree) do
    Enum.flat_map(dialogue_tree, fn {_node_id, node} ->
      extract_node_items(node)
    end)
  end

  defp extract_dialogue_items(_), do: []

  defp extract_node_items(node) when is_map(node) do
    choices = Map.get(node, "choices") || Map.get(node, :choices) || []
    options = Map.get(node, "options") || Map.get(node, :options) || []

    # Check node-level action
    node_action = Map.get(node, "action") || Map.get(node, :action)

    node_items =
      case node_action do
        ["give_item", item_key | _] -> [item_key]
        [:give_item, item_key | _] -> [item_key]
        _ -> []
      end

    # Check choice-level actions
    choice_items =
      Enum.flat_map(choices ++ options, fn choice ->
        action = Map.get(choice, "action") || Map.get(choice, :action)

        case action do
          ["give_item", item_key | _] -> [item_key]
          [:give_item, item_key | _] -> [item_key]
          _ -> []
        end
      end)

    node_items ++ choice_items
  end

  defp extract_node_items(_), do: []

  defp add_time_locked_sources(sources, reachable_rooms) do
    rooms =
      TypedObjectLoader.list_by_type(:entity, :room)
      |> Enum.filter(&MapSet.member?(reachable_rooms, &1.key))

    Enum.reduce(rooms, sources, fn room, acc ->
      components = room.components || %{}

      time_locked_items =
        Map.get(components, "time_locked_items") ||
          Map.get(components, :time_locked_items) ||
          []

      Enum.reduce(time_locked_items, acc, fn item_entry, inner_acc ->
        item_key =
          case item_entry do
            %{"item" => k} -> k
            %{item: k} -> k
            _ -> nil
          end

        if item_key do
          Map.update(
            inner_acc,
            item_key,
            [{:time_locked, room.key}],
            &[{:time_locked, room.key} | &1]
          )
        else
          inner_acc
        end
      end)
    end)
  end

  defp add_gathering_node_sources(sources, reachable_rooms) do
    # Load gathering nodes from YAML files in priv/world/nodes/
    node_files = Path.wildcard("priv/world/nodes/**/*.yml")

    # Build a map of room -> gathering_nodes for reachable rooms
    rooms =
      TypedObjectLoader.list_by_type(:entity, :room)
      |> Enum.filter(&MapSet.member?(reachable_rooms, &1.key))

    room_nodes =
      Enum.reduce(rooms, %{}, fn room, acc ->
        components = room.components || %{}

        gathering_nodes =
          Map.get(components, "gathering_nodes") ||
            Map.get(components, :gathering_nodes) ||
            %{}

        if map_size(gathering_nodes) > 0 do
          Enum.reduce(gathering_nodes, acc, fn {node_key, _config}, inner_acc ->
            Map.update(inner_acc, to_string(node_key), [room.key], &[room.key | &1])
          end)
        else
          acc
        end
      end)

    # For each node file, extract yields and add sources
    Enum.reduce(node_files, sources, fn file_path, acc ->
      case YamlElixir.read_from_file(file_path) do
        {:ok, node_data} ->
          node_key = node_data["key"]
          yields = node_data["yields"] || []

          # Only add source if node is in a reachable room
          if Map.has_key?(room_nodes, node_key) do
            Enum.reduce(yields, acc, fn yield_entry, inner_acc ->
              item_key =
                case yield_entry do
                  %{"item" => k} -> k
                  %{item: k} -> k
                  _ -> nil
                end

              if item_key do
                Map.update(
                  inner_acc,
                  item_key,
                  [{:gathering, node_key}],
                  &[{:gathering, node_key} | &1]
                )
              else
                inner_acc
              end
            end)
          else
            acc
          end

        {:error, _} ->
          acc
      end
    end)
  end

  defp add_npc_gives_items_sources(sources, reachable_rooms) do
    npcs = TypedObjectLoader.list_by_type(:entity, :npc)
    npc_locations = build_npc_location_map()

    Enum.reduce(npcs, sources, fn npc, acc ->
      locations = Map.get(npc_locations, npc.key, [])
      in_reachable = Enum.any?(locations, &MapSet.member?(reachable_rooms, &1))

      if in_reachable do
        # Check both root level and components level for gives_items
        components = npc.components || %{}

        gives_items =
          get_in(npc.data || %{}, ["gives_items"]) ||
            Map.get(components, "gives_items") ||
            Map.get(components, :gives_items) ||
            []

        Enum.reduce(gives_items, acc, fn item_key, inner_acc ->
          key = if is_binary(item_key), do: item_key, else: to_string(item_key)
          Map.update(inner_acc, key, [{:npc_gift, npc.key}], &[{:npc_gift, npc.key} | &1])
        end)
      else
        acc
      end
    end)
  end

  # =============================================================================
  # Private - Quest Giver Accessibility
  # =============================================================================

  defp analyze_quest_giver_accessibility(reachable_rooms) do
    quests =
      if Process.whereis(QuestRegistry) do
        QuestRegistry.all()
      else
        []
      end

    npc_locations = build_npc_location_map()

    errors = []
    accessible_count = 0

    {errors, accessible_count} =
      Enum.reduce(quests, {errors, accessible_count}, fn quest, {errs, count} ->
        giver = quest.giver

        if is_nil(giver) or giver == "" or giver == "system" do
          # No giver specified or system-granted - quest is auto-granted
          {errs, count + 1}
        else
          locations = Map.get(npc_locations, giver, [])

          cond do
            Enum.empty?(locations) ->
              # Giver has no spawn location
              {[{:unreachable_quest_giver, giver, "no_spawn_location"} | errs], count}

            Enum.all?(locations, &(not MapSet.member?(reachable_rooms, &1))) ->
              first_loc = List.first(locations)
              {[{:unreachable_quest_giver, giver, first_loc} | errs], count}

            true ->
              {errs, count + 1}
          end
        end
      end)

    stats = %{
      total_quest_givers: length(quests),
      accessible_quest_givers: accessible_count
    }

    {errors, [], stats}
  end

  # =============================================================================
  # Private - Gathering Node Accessibility
  # =============================================================================

  defp analyze_gathering_accessibility(reachable_rooms) do
    rooms =
      TypedObjectLoader.list_by_type(:entity, :room)
      |> Enum.reject(&is_template?/1)

    errors = []
    total_nodes = 0
    accessible_nodes = 0

    {errors, total_nodes, accessible_nodes} =
      Enum.reduce(rooms, {errors, total_nodes, accessible_nodes}, fn room, {errs, total, acc} ->
        gathering_node =
          get_in(room.data || %{}, ["gathering_node"]) ||
            get_in(room.components || %{}, ["gathering_node"]) ||
            get_in(room.components || %{}, [:gathering_node])

        if gathering_node do
          node_key =
            case gathering_node do
              %{"key" => k} -> k
              %{key: k} -> k
              k when is_binary(k) -> k
              _ -> nil
            end

          if node_key do
            if MapSet.member?(reachable_rooms, room.key) do
              {errs, total + 1, acc + 1}
            else
              {[{:unreachable_gathering_node, node_key, room.key} | errs], total + 1, acc}
            end
          else
            {errs, total, acc}
          end
        else
          {errs, total, acc}
        end
      end)

    stats = %{
      total_gathering_nodes: total_nodes,
      accessible_gathering_nodes: accessible_nodes
    }

    {errors, [], stats}
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp get_exits(%{data: %{"exits" => exits}}) when is_map(exits) do
    Enum.map(exits, fn
      {dir, dest} when is_binary(dest) -> {to_string(dir), dest}
      {dir, %{"destination" => dest}} -> {to_string(dir), dest}
      {dir, %{destination: dest}} -> {to_string(dir), dest}
      {dir, _} -> {to_string(dir), nil}
    end)
    |> Enum.reject(fn {_, dest} -> is_nil(dest) end)
  end

  defp get_exits(_), do: []

  defp is_template?(proto) do
    is_tmpl =
      Map.get(proto.data, :is_template) || Map.get(proto.data, "is_template")

    is_tmpl == true or String.starts_with?(proto.key || "", "base_")
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:unreachable_npc, npc, room}) do
    "  - NPC '#{npc}' is in unreachable room '#{room}'"
  end

  defp format_error({:unobtainable_item, item}) do
    "  - Item '#{item}' has no known source (quest, craft, drop, shop, or world)"
  end

  defp format_error({:unreachable_quest_giver, npc, room}) do
    "  - Quest giver '#{npc}' is in unreachable room '#{room}'"
  end

  defp format_error({:unreachable_gathering_node, node, room}) do
    "  - Gathering node '#{node}' is in unreachable room '#{room}'"
  end

  defp format_warning({:item_only_from_quest, item, quest}) do
    "  - Item '#{item}' only obtainable from quest '#{quest}'"
  end

  defp format_warning({:item_only_from_craft, item, recipe}) do
    "  - Item '#{item}' only obtainable from crafting recipe '#{recipe}'"
  end

  defp format_warning({:item_only_from_drop, item, npc}) do
    "  - Item '#{item}' only obtainable as drop from '#{npc}'"
  end

  defp format_warning({:npc_in_single_room, npc, room}) do
    "  - NPC '#{npc}' only appears in room '#{room}'"
  end
end
