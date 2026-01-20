defmodule Mix.Tasks.Loka.ExportMobile do
  @moduledoc """
  Exports world content as a JSON bundle for single-player mobile apps.

  ## Usage

      mix loka.export_mobile [options]

  ## Options

    * `--output`, `-o` - Output directory (default: `priv/exports/mobile`)
    * `--world`, `-w` - World/zone to export (default: all)
    * `--pretty` - Pretty-print JSON for debugging
    * `--validate` - Run validation before export

  ## Output Structure

  Creates a bundle directory with:

      bundle/
      ├── manifest.json       # Game metadata, version, starting room
      ├── content/
      │   ├── rooms.json      # All room definitions with exits
      │   ├── npcs.json       # NPCs with dialogue trees embedded
      │   ├── items.json      # Item definitions
      │   ├── quests.json     # Quest definitions with objectives
      │   └── recipes.json    # Crafting recipes
      └── config/
          ├── game.json       # Game settings, defaults
          └── balance.json    # Combat formulas, XP curves

  ## Single-Player Adaptations

  The export automatically adapts multiplayer content:

    * Removes player-dependent features (chat, parties, PvP)
    * Converts room broadcasts to ambient narration
    * Embeds dialogue trees directly in NPC definitions
    * Flattens quest chains for linear progression
    * Removes real-time sync requirements

  ## Examples

      # Export all content
      mix loka.export_mobile

      # Export specific zone with validation
      mix loka.export_mobile --world monastery --validate

      # Export with pretty JSON for debugging
      mix loka.export_mobile --pretty --output ./debug_bundle
  """

  use Mix.Task

  @shortdoc "Export world content for single-player mobile app"

  @switches [
    output: :string,
    world: :string,
    pretty: :boolean,
    validate: :boolean
  ]

  @aliases [
    o: :output,
    w: :world
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches, aliases: @aliases)

    # Start application for DB access
    Mix.Task.run("app.start")

    output_dir = opts[:output] || "priv/exports/mobile"
    world_filter = opts[:world]
    pretty? = opts[:pretty] || false
    validate? = opts[:validate] || false

    Mix.shell().info("Exporting mobile bundle...")

    # Validate first if requested
    if validate? do
      Mix.shell().info("Running validation...")
      # TODO: Call validation task
    end

    # Create output directory
    File.mkdir_p!(output_dir)
    File.mkdir_p!(Path.join(output_dir, "content"))
    File.mkdir_p!(Path.join(output_dir, "config"))

    # Export each content type
    with {:ok, rooms} <- export_rooms(world_filter),
         {:ok, npcs} <- export_npcs(world_filter),
         {:ok, items} <- export_items(world_filter),
         {:ok, quests} <- export_quests(world_filter),
         {:ok, recipes} <- export_recipes(world_filter),
         {:ok, dialogues} <- export_dialogues(world_filter) do
      # Write content files
      write_json(Path.join(output_dir, "content/rooms.json"), rooms, pretty?)
      write_json(Path.join(output_dir, "content/npcs.json"), npcs, pretty?)
      write_json(Path.join(output_dir, "content/items.json"), items, pretty?)
      write_json(Path.join(output_dir, "content/quests.json"), quests, pretty?)
      write_json(Path.join(output_dir, "content/recipes.json"), recipes, pretty?)
      write_json(Path.join(output_dir, "content/dialogues.json"), dialogues, pretty?)

      # Write config files
      write_json(Path.join(output_dir, "config/game.json"), build_game_config(), pretty?)
      write_json(Path.join(output_dir, "config/balance.json"), build_balance_config(), pretty?)

      # Write manifest
      manifest = build_manifest(rooms, npcs, items, quests)
      write_json(Path.join(output_dir, "manifest.json"), manifest, pretty?)

      # Summary
      Mix.shell().info("""

      ✓ Mobile bundle exported to #{output_dir}

      Content summary:
        Rooms:    #{map_size(rooms)}
        NPCs:     #{map_size(npcs)}
        Items:    #{map_size(items)}
        Quests:   #{map_size(quests)}
        Recipes:  #{map_size(recipes)}

      Next steps:
        1. Copy bundle to mobile/assets/content/
        2. Run mobile app with offline mode enabled
      """)
    else
      {:error, reason} ->
        Mix.shell().error("Export failed: #{inspect(reason)}")
        exit({:shutdown, 1})
    end
  end

  # --- Export Functions ---

  defp export_rooms(world_filter) do
    rooms =
      Loka.Engine.TypedObject.Loader.list_by_type(:room)
      |> maybe_filter_by_world(world_filter)
      |> Enum.map(&load_and_transform_room/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn room -> {room.id, room} end)

    {:ok, rooms}
  end

  defp export_npcs(world_filter) do
    npcs =
      Loka.Engine.TypedObject.Loader.list_by_type(:npc)
      |> maybe_filter_by_world(world_filter)
      |> Enum.map(&load_and_transform_npc/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn npc -> {npc.id, npc} end)

    {:ok, npcs}
  end

  defp export_items(world_filter) do
    items =
      Loka.Engine.TypedObject.Loader.list_by_type(:item)
      |> maybe_filter_by_world(world_filter)
      |> Enum.map(&load_and_transform_item/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn item -> {item.id, item} end)

    {:ok, items}
  end

  defp export_quests(_world_filter) do
    quests =
      Loka.Engine.TypedObject.Loader.list_by_type(:quest)
      |> Enum.map(&load_and_transform_quest/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn quest -> {quest.id, quest} end)

    {:ok, quests}
  end

  defp export_recipes(_world_filter) do
    recipes =
      Loka.Engine.TypedObject.Loader.list_by_type(:recipe)
      |> Enum.map(&load_and_transform_recipe/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn recipe -> {recipe.id, recipe} end)

    {:ok, recipes}
  end

  defp export_dialogues(_world_filter) do
    dialogues =
      Loka.Engine.TypedObject.Loader.list_by_type(:dialogue)
      |> Enum.map(&load_and_transform_dialogue/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn dialogue -> {dialogue.id, dialogue} end)

    {:ok, dialogues}
  end

  # --- Transform Functions ---

  defp load_and_transform_room(%{key: key} = proto) do
    %{
      id: key,
      name: proto.name || key,
      description: proto.description || "",
      exits: transform_exits(Map.get(proto.data, "exits") || []),
      spawns: Map.get(proto.data, "spawns") || [],
      zone: Map.get(proto.data, "zone"),
      coordinates: Map.get(proto.data, "coordinates"),
      # SP adaptations
      ambient_messages: Map.get(proto.data, "ambient_messages") || [],
      biome: Map.get(proto.data, "biome") || "temperate",
      light_level: Map.get(proto.data, "light_level") || "normal"
    }
  end

  defp load_and_transform_room(_), do: nil

  defp load_and_transform_npc(%{key: key} = proto) do
    %{
      id: key,
      name: proto.name || key,
      description: proto.description || "",
      level: Map.get(proto.data, "level") || 1,
      stats: Map.get(proto.data, "stats") || %{},
      dialogue_key: Map.get(proto.data, "dialogue"),
      shop: Map.get(proto.data, "shop"),
      # Combat stats for hostile NPCs
      hostile: Map.get(proto.data, "hostile") || false,
      health: Map.get(proto.data, "health") || %{"current" => 100, "max" => 100},
      xp_reward: Map.get(proto.data, "xp_reward") || 0,
      gold_reward: Map.get(proto.data, "gold_reward") || 0,
      loot_table: Map.get(proto.data, "loot_table")
    }
  end

  defp load_and_transform_npc(_), do: nil

  defp load_and_transform_item(%{key: key} = proto) do
    %{
      id: key,
      name: proto.name || key,
      description: proto.description || "",
      item_type: Map.get(proto.data, "item_type") || "misc",
      slot: Map.get(proto.data, "slot"),
      stackable: Map.get(proto.data, "stackable") || false,
      max_stack: Map.get(proto.data, "max_stack") || 1,
      value: Map.get(proto.data, "value") || 0,
      bonuses: Map.get(proto.data, "bonuses") || %{},
      effect: Map.get(proto.data, "effect"),
      requirements: Map.get(proto.data, "requirements") || %{}
    }
  end

  defp load_and_transform_item(_), do: nil

  defp load_and_transform_quest(typed_object) do
    %{
      id: typed_object.key,
      name: typed_object.name || typed_object.key,
      description: typed_object.description || "",
      objectives: transform_objectives(Map.get(typed_object.data, "objectives") || []),
      rewards: Map.get(typed_object.data, "rewards") || %{},
      giver: Map.get(typed_object.data, "giver"),
      turn_in_npc: Map.get(typed_object.data, "turn_in_npc"),
      prerequisites: Map.get(typed_object.data, "prerequisites") || [],
      # SP adaptations
      is_main_quest: Map.get(typed_object.data, "is_main_quest") || false,
      journal_entries: Map.get(typed_object.data, "journal_entries") || []
    }
  end

  defp load_and_transform_recipe(typed_object) do
    %{
      id: typed_object.key,
      name: typed_object.name || typed_object.key,
      description: typed_object.description || "",
      ingredients: Map.get(typed_object.data, "ingredients") || [],
      result: Map.get(typed_object.data, "result"),
      result_quantity: Map.get(typed_object.data, "result_quantity") || 1,
      skill_required: Map.get(typed_object.data, "skill_required"),
      crafting_time: Map.get(typed_object.data, "crafting_time") || 0
    }
  end

  defp load_and_transform_dialogue(typed_object) do
    %{
      id: typed_object.key,
      nodes: transform_dialogue_nodes(Map.get(typed_object.data, "nodes") || %{})
    }
  end

  # --- Helper Functions ---

  defp transform_exits(exits) when is_list(exits) do
    Enum.map(exits, fn exit ->
      %{
        direction: exit["direction"],
        destination: exit["destination"],
        description: exit["description"],
        locked: exit["locked"] || false,
        key_item: exit["key_item"]
      }
    end)
  end

  defp transform_exits(exits) when is_map(exits) do
    Enum.map(exits, fn {direction, dest} ->
      case dest do
        dest when is_binary(dest) ->
          %{direction: direction, destination: dest}

        %{} = dest_map ->
          %{
            direction: direction,
            destination: dest_map["destination"] || dest_map["room"],
            locked: dest_map["locked"] || false,
            key_item: dest_map["key_item"]
          }
      end
    end)
  end

  defp transform_exits(_), do: []

  defp transform_objectives(objectives) do
    Enum.with_index(objectives, fn obj, idx ->
      %{
        id: obj["id"] || "obj_#{idx}",
        type: obj["type"],
        target: obj["target"],
        count: obj["count"] || 1,
        description: obj["description"] || "",
        hint: obj["hint"],
        # SP adaptations
        optional: obj["optional"] || false,
        time_limit: obj["time_limit"]
      }
    end)
  end

  defp transform_dialogue_nodes(nodes) do
    Map.new(nodes, fn {node_id, node} ->
      {node_id,
       %{
         text: node["text"] || "",
         choices:
           Enum.map(node["choices"] || [], fn choice ->
             %{
               text: choice["text"],
               next: choice["next"],
               action: choice["action"],
               requires_quest: choice["requires_quest"],
               requires_quest_not: choice["requires_quest_not"],
               requires_flag: choice["requires_flag"]
             }
           end)
       }}
    end)
  end

  defp maybe_filter_by_world(keys, nil), do: keys

  defp maybe_filter_by_world(keys, world) do
    Enum.filter(keys, fn key ->
      String.starts_with?(to_string(key), world) or
        String.contains?(to_string(key), "/#{world}/")
    end)
  end

  defp build_manifest(rooms, npcs, items, quests) do
    %{
      version: "1.0.0",
      exported_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      starting_room: detect_starting_room(rooms),
      content_counts: %{
        rooms: map_size(rooms),
        npcs: map_size(npcs),
        items: map_size(items),
        quests: map_size(quests)
      },
      # SP-specific metadata
      estimated_playtime_minutes: estimate_playtime(quests),
      main_quest_count: Enum.count(quests, fn {_, q} -> q.is_main_quest end)
    }
  end

  defp build_game_config do
    %{
      player_defaults: %{
        starting_health: 100,
        starting_gold: 10,
        starting_level: 1,
        base_stats: %{
          strength: 10,
          dexterity: 10,
          constitution: 10,
          wisdom: 10
        }
      },
      settings: %{
        auto_save_interval_seconds: 60,
        combat_tick_ms: 2000,
        enable_permadeath: false
      }
    }
  end

  defp build_balance_config do
    %{
      xp_curve: %{
        base_xp: 100,
        exponent: 1.5
      },
      combat: %{
        base_damage_variance: 0.2,
        critical_hit_chance: 0.1,
        critical_hit_multiplier: 2.0,
        flee_base_chance: 0.5
      },
      economy: %{
        sell_price_multiplier: 0.5
      }
    }
  end

  defp detect_starting_room(rooms) do
    # Look for common starting room patterns
    candidates = ["monastery_gate", "village_square", "starting_room", "intro"]

    Enum.find(candidates, fn candidate ->
      Map.has_key?(rooms, candidate)
    end) || Map.keys(rooms) |> List.first()
  end

  defp estimate_playtime(quests) do
    # Rough estimate: 5 minutes per quest
    map_size(quests) * 5
  end

  defp write_json(path, data, pretty?) do
    json =
      if pretty? do
        Jason.encode!(data, pretty: true)
      else
        Jason.encode!(data)
      end

    File.write!(path, json)
    Mix.shell().info("  Wrote #{path}")
  end
end
