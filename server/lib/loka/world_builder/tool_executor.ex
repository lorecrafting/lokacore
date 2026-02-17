defmodule Loka.WorldBuilder.ToolExecutor do
  @moduledoc """
  Executes LLM tool calls in the World Builder.

  Handles tool calls from Claude by:
  1. Validating tool parameters
  2. Executing via appropriate Manager
  3. Returning results for display and Claude continuation
  """
  require Logger

  alias Loka.WorldBuilder.{
    RoomManager,
    EntityManager,
    QuestManager,
    DialogueManager,
    AuditLog,
    ValidationManager,
    YamlBuilder
  }

  alias Loka.WorldBuilder.LLM.ObservabilityLogger
  alias Loka.Content.{Zone, Dialogue}
  alias Loka.Engine.{Entity, Entities}

  @doc """
  Execute a tool call and return the result.

  ## Parameters
    - tool_name: Name of the tool (string)
    - input: Tool input parameters (map)

  ## Returns
    - {:ok, result} on success
    - {:error, reason} on failure
  """
  def execute(tool_name, input, opts \\ [])

  def execute(tool_name, input, opts) when is_binary(tool_name) and is_map(input) do
    Logger.info("[ToolExecutor] Executing tool: #{tool_name}")
    session_id = opts[:session_id] || "unknown"
    start_time = System.monotonic_time(:millisecond)

    # Normalize tool name - strip wb_ prefix if present for backwards compatibility
    normalized_name = String.replace_prefix(tool_name, "wb_", "")

    result =
      case normalized_name do
        # Guidance tools
        "read_guide" -> execute_read_guide(input)
        # Room tools
        "create_room" -> execute_create_room(input)
        "update_room" -> execute_update_room(input)
        "delete_room" -> execute_delete_room(input)
        "create_exit" -> execute_create_exit(input)
        "remove_exit" -> execute_remove_exit(input)
        "batch_create_rooms" -> execute_batch_create_rooms(input)
        # Entity tools
        "create_npc" -> execute_create_npc(input)
        "create_item" -> execute_create_item(input)
        "update_npc" -> execute_update_entity(:npc, input)
        "update_item" -> execute_update_entity(:item, input)
        "delete_npc" -> execute_delete_entity(:npc, input)
        "delete_item" -> execute_delete_entity(:item, input)
        "list_npcs" -> execute_list_npcs(input)
        "list_items" -> execute_list_items(input)
        # Quest tools
        "create_quest" -> execute_create_quest(input)
        "update_quest" -> execute_update_quest(input)
        "delete_quest" -> execute_delete_quest(input)
        "list_quests" -> execute_list_quests(input)
        # Dialogue tools
        "create_dialogue" -> execute_create_dialogue(input)
        "get_dialogue" -> execute_get_dialogue(input)
        "update_dialogue" -> execute_update_dialogue(input)
        "delete_dialogue" -> execute_delete_dialogue(input)
        "list_dialogues" -> execute_list_dialogues(input)
        # Zone tools
        "create_zone" -> execute_create_zone_tool(input)
        "update_zone" -> execute_update_zone(input)
        "delete_zone" -> execute_delete_zone_tool(input)
        # Cutscene tools
        "create_cutscene" -> execute_create_cutscene(input)
        "update_cutscene" -> execute_update_cutscene(input)
        "delete_cutscene" -> execute_delete_cutscene(input)
        "get_cutscene" -> execute_get_cutscene(input)
        "list_cutscenes" -> execute_list_cutscenes(input)
        # Storyline tools
        "create_storyline" -> execute_create_storyline(input)
        "update_storyline" -> execute_update_storyline(input)
        "delete_storyline" -> execute_delete_storyline(input)
        "list_storylines" -> execute_list_storylines(input)
        # Script tools
        "create_script" -> execute_create_script(input)
        "update_script" -> execute_update_script(input)
        "delete_script" -> execute_delete_script(input)
        "get_script" -> execute_get_script(input)
        "list_scripts" -> execute_list_scripts(input)
        "validate_script" -> execute_validate_script(input)
        "create_script_from_template" -> execute_create_script_from_template(input)
        "attach_script" -> execute_attach_script(input)
        "detach_script" -> execute_detach_script(input)
        # Query tools
        "get_room_info" -> execute_get_room_info(input)
        "list_rooms" -> execute_list_rooms(input)
        "get_zone_info" -> execute_get_zone_info(input)
        "list_zones" -> execute_list_zones(input)
        # Analysis tools
        "validate_world" -> execute_validate_world(input)
        "search_content" -> execute_search_content(input)
        _ -> {:error, "Unknown tool: #{tool_name}"}
      end

    # Log to audit log
    case result do
      {:ok, _} ->
        AuditLog.log_success(opts[:conversation_id], tool_name, input)

      {:error, reason} ->
        AuditLog.log_error(opts[:conversation_id], tool_name, input, inspect(reason))
    end

    # Log the tool call with timing
    duration = System.monotonic_time(:millisecond) - start_time

    ObservabilityLogger.log_tool_call(session_id, tool_name, input, %{
      success: match?({:ok, _}, result),
      duration_ms: duration,
      result_preview: result_preview(result)
    })

    result
  end

  # Catch-all for invalid tool calls
  def execute(tool_name, _input, _opts) do
    {:error, "Invalid tool call: #{inspect(tool_name)}"}
  end

  defp result_preview({:ok, data}) when is_map(data) do
    data[:message] || "success"
  end

  defp result_preview({:error, reason}), do: inspect(reason)
  defp result_preview(_), do: "unknown"

  # =============================================================================
  # Guidance Tools
  # =============================================================================

  @guide_topics %{
    "world_design_process" => "world_design_process.md",
    "narrative_style" => "narrative_style.md",
    "story_structure" => "story_structure.md",
    "weaving_patterns" => "weaving_patterns.md",
    "entity_patterns" => "entity_patterns.md",
    "dialogue_patterns" => "dialogue_patterns.md",
    "quest_patterns" => "quest_patterns.md",
    "npc_behaviors" => "npc_behaviors.md"
  }

  defp execute_read_guide(input) do
    topic = input["topic"]

    case Map.get(@guide_topics, topic) do
      nil ->
        available = Map.keys(@guide_topics) |> Enum.join(", ")
        {:error, "Unknown topic '#{topic}'. Available: #{available}"}

      filename ->
        guide_path =
          Path.join([:code.priv_dir(:loka), "world_builder", "guides", filename])

        case File.read(guide_path) do
          {:ok, content} ->
            {:ok,
             %{
               success: true,
               topic: topic,
               content: content
             }}

          {:error, reason} ->
            {:error, "Failed to read guide: #{inspect(reason)}"}
        end
    end
  end

  # =============================================================================
  # Room Tools
  # =============================================================================

  defp execute_create_room(input) do
    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      x: input["x"] || 0,
      y: input["y"] || 0,
      z: input["z"] || 0,
      tags: input["tags"] || []
    }

    case RoomManager.create_room(attrs) do
      {:ok, room} ->
        {:ok,
         %{
           success: true,
           message: "Created room '#{room.name}' (#{room.key})",
           room: %{
             key: room.key,
             name: room.name,
             description: room.description,
             x: room.x,
             y: room.y,
             z: room.z
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create room: #{inspect(reason)}"}
    end
  end

  defp execute_update_room(input) do
    room_key = input["room_key"]

    updates =
      input
      |> Map.take(["name", "description", "x", "y", "z", "tags"])
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    case RoomManager.update_room(room_key, updates) do
      {:ok, room} ->
        {:ok,
         %{
           success: true,
           message: "Updated room '#{room.name}'",
           room: %{
             key: room.key,
             name: room.name,
             description: room.description,
             x: room.x,
             y: room.y,
             z: room.z
           }
         }}

      {:error, reason} ->
        {:error, "Failed to update room: #{inspect(reason)}"}
    end
  end

  defp execute_delete_room(input) do
    room_key = input["room_key"]

    case RoomManager.delete_room(room_key) do
      {:ok, _deleted_room} ->
        {:ok,
         %{
           success: true,
           message: "Deleted room '#{room_key}'"
         }}

      {:error, reason} ->
        {:error, "Failed to delete room: #{inspect(reason)}"}
    end
  end

  defp execute_create_exit(input) do
    from_room = input["from_room"]
    direction = input["direction"]
    to_room = input["to_room"]

    case RoomManager.add_exit(from_room, direction, to_room) do
      {:ok, _room} ->
        {:ok,
         %{
           success: true,
           message: "Created exit from #{from_room} #{direction} to #{to_room}"
         }}

      {:error, reason} ->
        {:error, "Failed to create exit: #{inspect(reason)}"}
    end
  end

  defp execute_remove_exit(input) do
    from_room = input["from_room"]
    direction = input["direction"]

    case RoomManager.remove_exit(from_room, direction) do
      {:ok, _room} ->
        {:ok,
         %{
           success: true,
           message: "Removed exit from #{from_room} #{direction}"
         }}

      {:error, reason} ->
        {:error, "Failed to remove exit: #{inspect(reason)}"}
    end
  end

  # =============================================================================
  # Entity Tools
  # =============================================================================

  defp execute_create_npc(input) do
    level = input["level"] || 1

    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      level: level,
      tags: input["tags"] || [],
      parent_key: input["room_key"]
    }

    case EntityManager.create_entity(:npc, attrs) do
      {:ok, npc} ->
        # Level is stored in components, extract it safely
        npc_level = get_in(npc.components, ["npc_data", "level"]) || level

        {:ok,
         %{
           success: true,
           message: "Created NPC '#{npc.name}' (#{npc.key})",
           npc: %{
             key: npc.key,
             name: npc.name,
             description: npc.description,
             level: npc_level
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create NPC: #{inspect(reason)}"}
    end
  end

  defp execute_create_item(input) do
    item_type = input["item_type"] || "misc"

    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      item_type: item_type,
      tags: input["tags"] || [],
      parent_key: input["room_key"]
    }

    case EntityManager.create_entity(:item, attrs) do
      {:ok, item} ->
        # Item type is stored in components, extract it safely
        stored_item_type = get_in(item.components, ["item", "item_type"]) || item_type

        {:ok,
         %{
           success: true,
           message: "Created item '#{item.name}' (#{item.key})",
           item: %{
             key: item.key,
             name: item.name,
             description: item.description,
             item_type: stored_item_type
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create item: #{inspect(reason)}"}
    end
  end

  defp execute_list_npcs(input) do
    npcs = EntityManager.list_entities(:npc)

    filtered_npcs =
      cond do
        room_key = input["room_key"] ->
          Enum.filter(npcs, fn npc ->
            get_safe_field(npc, :parent_key) == room_key
          end)

        tag = input["tag"] ->
          Enum.filter(npcs, fn npc ->
            tags = get_safe_field(npc, :tags) || []
            tag in tags
          end)

        true ->
          npcs
      end

    npc_list =
      Enum.map(filtered_npcs, fn npc ->
        %{
          key: get_safe_field(npc, :key),
          name: get_safe_field(npc, :name),
          level:
            get_in(npc, [:components, "npc_data", "level"]) || get_safe_field(npc, :level) || 1,
          room_key: get_safe_field(npc, :parent_key)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(npc_list)} NPCs",
       npcs: npc_list
     }}
  end

  defp execute_list_items(input) do
    items = EntityManager.list_entities(:item)

    filtered_items =
      cond do
        room_key = input["room_key"] ->
          Enum.filter(items, fn item ->
            get_safe_field(item, :parent_key) == room_key
          end)

        item_type = input["item_type"] ->
          Enum.filter(items, fn item ->
            get_item_type(item) == item_type
          end)

        true ->
          items
      end

    item_list =
      Enum.map(filtered_items, fn item ->
        %{
          key: get_safe_field(item, :key),
          name: get_safe_field(item, :name),
          item_type: get_item_type(item) || "misc",
          room_key: get_safe_field(item, :parent_key)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(item_list)} items",
       items: item_list
     }}
  end

  defp execute_update_entity(subtype, input) do
    key = input["key"]

    updates =
      input
      |> Map.drop(["key"])
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    entities = EntityManager.list_entities(subtype)

    case Enum.find(entities, fn e -> get_safe_field(e, :key) == key end) do
      nil ->
        {:error, "#{subtype} '#{key}' not found"}

      entity ->
        case EntityManager.update_entity(entity.id, updates) do
          {:ok, updated} ->
            {:ok,
             %{
               success: true,
               message: "Updated #{subtype} '#{key}'",
               entity: %{
                 key: get_safe_field(updated, :key),
                 name: get_safe_field(updated, :name)
               }
             }}

          {:error, reason} ->
            {:error, "Failed to update #{subtype}: #{inspect(reason)}"}
        end
    end
  end

  defp execute_delete_entity(subtype, input) do
    key = input["key"]
    entities = EntityManager.list_entities(subtype)

    case Enum.find(entities, fn e -> get_safe_field(e, :key) == key end) do
      nil ->
        {:error, "#{subtype} '#{key}' not found"}

      entity ->
        case EntityManager.delete_entity(entity.id) do
          :ok ->
            {:ok,
             %{
               success: true,
               message: "Deleted #{subtype} '#{key}'"
             }}

          {:error, reason} ->
            {:error, "Failed to delete #{subtype}: #{inspect(reason)}"}
        end
    end
  end

  # Safe field accessor that works with both maps and structs
  defp get_safe_field(data, key) when is_map(data) do
    Map.get(data, key) || Map.get(data, to_string(key))
  end

  defp get_item_type(item) do
    get_safe_field(item, :item_type) ||
      get_in(item, [:components, "item", "item_type"]) ||
      get_in(item, [:components, :item, :item_type])
  end

  # =============================================================================
  # Quest Tools
  # =============================================================================

  defp execute_create_quest(input) do
    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      quest_type: input["quest_type"] || "side",
      giver_key: input["giver_key"],
      objectives: input["objectives"] || [],
      rewards: input["rewards"] || %{},
      prerequisites: input["prerequisites"] || [],
      level_range: input["level_range"],
      tags: input["tags"] || []
    }

    case QuestManager.create_quest(attrs) do
      {:ok, quest} ->
        {:ok,
         %{
           success: true,
           message: "Created quest '#{quest.name}' (#{quest.key})",
           quest: %{
             key: quest.key,
             name: quest.name,
             quest_type: attrs.quest_type,
             giver_key: attrs.giver_key
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create quest: #{inspect(reason)}"}
    end
  end

  defp execute_update_quest(input) do
    quest_key = input["quest_key"]

    updates =
      input
      |> Map.take(["name", "description", "objectives", "rewards", "prerequisites"])
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    case QuestManager.update_quest(quest_key, updates) do
      {:ok, quest} ->
        {:ok,
         %{
           success: true,
           message: "Updated quest '#{quest.name}'",
           quest: %{
             key: quest.key,
             name: quest.name
           }
         }}

      {:error, reason} ->
        {:error, "Failed to update quest: #{inspect(reason)}"}
    end
  end

  defp execute_list_quests(input) do
    quests = QuestManager.list_quests()

    filtered_quests =
      cond do
        quest_type = input["quest_type"] ->
          Enum.filter(quests, fn quest ->
            get_quest_type(quest) == quest_type
          end)

        giver_key = input["giver_key"] ->
          Enum.filter(quests, fn quest ->
            get_quest_giver(quest) == giver_key
          end)

        true ->
          quests
      end

    quest_list =
      Enum.map(filtered_quests, fn quest ->
        %{
          key: quest.key || quest[:key],
          name: quest.name || quest[:name],
          quest_type: get_quest_type(quest) || "side",
          giver_key: get_quest_giver(quest)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(quest_list)} quests",
       quests: quest_list
     }}
  end

  defp execute_delete_quest(input) do
    key = input["key"]

    case QuestManager.delete_quest(key) do
      :ok ->
        {:ok, %{success: true, message: "Deleted quest '#{key}'"}}

      {:error, :not_found} ->
        {:error, "Quest not found: #{key}"}

      {:error, reason} ->
        {:error, "Failed to delete quest: #{inspect(reason)}"}
    end
  end

  defp get_quest_type(quest) do
    quest[:quest_type] ||
      quest.quest_type ||
      get_in(quest, [:data, "quest_type"]) ||
      get_in(quest, [:data, :quest_type])
  end

  defp get_quest_giver(quest) do
    quest[:giver_key] ||
      quest.giver_key ||
      get_in(quest, [:data, "giver_key"]) ||
      get_in(quest, [:data, :giver_key])
  end

  # =============================================================================
  # Dialogue Tools
  # =============================================================================

  defp execute_create_dialogue(input) do
    key = input["key"]
    entity_key = input["npc"] || input["entity_key"]
    trigger = input["trigger"] || "on_talk"
    raw_nodes = input["nodes"] || []

    # Convert array format from schema [{id, text, choices}] to map format {id => {text, choices}}
    nodes =
      if is_list(raw_nodes) do
        Map.new(raw_nodes, fn node -> {node["id"], Map.drop(node, ["id"])} end)
      else
        raw_nodes
      end

    entry_node =
      input["entry_node"] ||
        if is_list(raw_nodes) and raw_nodes != [], do: hd(raw_nodes)["id"], else: "start"

    with :ok <- validate_safe_key(key) do
      data = %{
        "entity_key" => entity_key,
        "trigger" => trigger,
        "entry_node" => entry_node,
        "nodes" => nodes
      }

      entity =
        Entity.new(
          type: :dialogue,
          key: key,
          short_desc: "Dialogue: #{entity_key}",
          is_prototype: true,
          components: %{"data" => data},
          metadata: %{"draft" => true}
        )

      case Entities.save(entity) do
        {:ok, _} ->
          {:ok,
           %{
             success: true,
             message: "Created dialogue '#{key}' for #{entity_key}",
             dialogue: %{
               key: key,
               entity_key: entity_key,
               entry_node: entry_node
             }
           }}

        {:error, reason} ->
          {:error, "Failed to save dialogue: #{inspect(reason)}"}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp validate_safe_key(key) when is_binary(key) do
    if String.match?(key, ~r/^[a-z0-9_]+$/) do
      :ok
    else
      {:error, "Invalid key format. Use only lowercase letters, numbers, and underscores."}
    end
  end

  defp validate_safe_key(_), do: {:error, "Key must be a string"}

  defp execute_get_dialogue(input) do
    dialogue_key = input["dialogue_key"]

    case Dialogue.get(dialogue_key) do
      {:ok, dialogue} ->
        data = (dialogue.components || %{})["data"] || %{}

        {:ok,
         %{
           success: true,
           dialogue: %{
             key: dialogue.key,
             entity_key: data["entity_key"],
             trigger: data["trigger"],
             entry_node: data["entry_node"],
             nodes: data["nodes"] || %{}
           }
         }}

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{dialogue_key}"}
    end
  end

  defp execute_update_dialogue(input) do
    key = input["key"]
    raw_nodes = input["nodes"] || []

    case Dialogue.get(key) do
      {:ok, existing} ->
        nodes =
          if is_list(raw_nodes) do
            Map.new(raw_nodes, fn node -> {node["id"], Map.drop(node, ["id"])} end)
          else
            raw_nodes
          end

        existing_data = (existing.components || %{})["data"] || %{}
        updated_data = Map.put(existing_data, "nodes", nodes)
        updated_components = Map.put(existing.components || %{}, "data", updated_data)

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{components: updated_components}) do
              {:ok, _} ->
                {:ok,
                 %{
                   success: true,
                   message: "Updated dialogue '#{key}' (#{map_size(nodes)} nodes)",
                   dialogue: %{key: key, node_count: map_size(nodes)}
                 }}

              {:error, reason} ->
                {:error, "Failed to save dialogue: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Dialogue not found in DB: #{key}"}
        end

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{key}"}
    end
  end

  defp execute_delete_dialogue(input) do
    key = input["key"]

    case DialogueManager.delete_dialogue(key) do
      :ok ->
        {:ok, %{success: true, message: "Deleted dialogue '#{key}'"}}

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{key}"}

      {:error, reason} ->
        {:error, "Failed to delete dialogue: #{inspect(reason)}"}
    end
  end

  defp execute_list_dialogues(input) do
    dialogues = Dialogue.all()

    filtered =
      if npc = input["npc"] do
        Enum.filter(dialogues, fn d ->
          data = (d.components || %{})["data"] || %{}
          (data["entity_key"] || "") == npc
        end)
      else
        dialogues
      end

    list =
      Enum.map(filtered, fn d ->
        data = (d.components || %{})["data"] || %{}

        %{
          key: d.key,
          entity_key: data["entity_key"],
          node_count: map_size(data["nodes"] || %{})
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(list)} dialogues",
       dialogues: list
     }}
  end

  # =============================================================================
  # Zone Tools
  # =============================================================================

  defp execute_get_zone_info(input) do
    zone_key = input["zone_key"]

    case Zone.get(zone_key) do
      {:ok, zone} ->
        data = (zone.components || %{})["data"] || %{}

        {:ok,
         %{
           success: true,
           zone: %{
             key: zone.key,
             name: zone.short_desc,
             description: zone.extra_desc,
             level_range: data["level_range"],
             rooms: data["rooms"] || [],
             tags: zone.tags || []
           }
         }}

      {:error, :not_found} ->
        {:error, "Zone not found: #{zone_key}"}
    end
  end

  defp execute_list_zones(_input) do
    zones = Zone.all()

    zone_list =
      Enum.map(zones, fn zone ->
        rooms = get_zone_rooms(zone)

        %{
          key: zone.key,
          name: zone.short_desc || zone.key,
          room_count: length(rooms)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(zone_list)} zones",
       zones: zone_list
     }}
  end

  defp get_zone_rooms(zone) do
    data = (get_safe_field(zone, :components) || %{})["data"] || %{}
    data["rooms"] || []
  end

  # =============================================================================
  # Zone CRUD Tools
  # =============================================================================

  defp execute_create_zone_tool(input) do
    key = input["key"]
    name = input["name"]
    rooms = input["rooms"] || []
    reset_mode = input["reset_mode"] || "empty"

    entity =
      Entity.new(
        type: :zone,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{
          "data" => %{
            "rooms" => rooms,
            "reset_mode" => reset_mode,
            "lifespan_minutes" => 0
          }
        },
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, warnings} = YamlBuilder.validate_references(:zone, %{rooms: rooms})
        message = "Created zone '#{name}' (#{key})"

        message =
          if warnings != [],
            do: message <> "\nWarnings: " <> Enum.join(warnings, "; "),
            else: message

        {:ok,
         %{
           success: true,
           message: message,
           zone: %{key: key, name: name}
         }}

      {:error, reason} ->
        {:error, "Failed to create zone: #{inspect(reason)}"}
    end
  end

  defp execute_update_zone(input) do
    key = input["key"]

    case Zone.get(key) do
      {:ok, zone} ->
        updates = Map.drop(input, ["key"])
        zone_data = (zone.components || %{})["data"] || %{}
        updated_data = Enum.reduce(updates, zone_data, fn {k, v}, acc -> Map.put(acc, k, v) end)

        name = updates["name"] || zone.short_desc || key
        updated_components = Map.put(zone.components || %{}, "data", updated_data)

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated zone '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update zone: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Zone not found in DB: #{key}"}
        end

      {:error, :not_found} ->
        {:error, "Zone not found: #{key}"}
    end
  end

  defp execute_delete_zone_tool(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :zone} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted zone '#{key}'"}}

      _ ->
        {:error, "Zone not found: #{key}"}
    end
  end

  # =============================================================================
  # Cutscene CRUD Tools
  # =============================================================================

  defp execute_create_cutscene(input) do
    key = input["key"]
    name = input["name"]
    trigger = input["trigger"] || "manual"

    scenes =
      input["scenes"] ||
        [%{"type" => "narration", "text" => "A new scene begins...", "delay" => 2000}]

    entity =
      Entity.new(
        type: :cutscene,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{"data" => %{"trigger" => trigger, "scenes" => scenes}},
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, warnings} = YamlBuilder.validate_references(:cutscene, %{scenes: scenes})
        message = "Created cutscene '#{name}' (#{key})"

        message =
          if warnings != [],
            do: message <> "\nWarnings: " <> Enum.join(warnings, "; "),
            else: message

        {:ok, %{success: true, message: message}}

      {:error, reason} ->
        {:error, "Failed to create cutscene: #{inspect(reason)}"}
    end
  end

  defp execute_update_cutscene(input) do
    key = input["key"]

    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, cs} ->
        cs_data = (cs.components || %{})["data"] || %{}
        name = input["name"] || cs.short_desc || key
        trigger = input["trigger"] || cs_data["trigger"] || "manual"
        scenes = input["scenes"] || cs_data["scenes"] || []

        updated_components =
          Map.put(cs.components || %{}, "data", %{
            "trigger" => trigger,
            "scenes" => scenes
          })

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated cutscene '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update cutscene: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Cutscene not found in DB: #{key}"}
        end

      _ ->
        {:error, "Cutscene not found: #{key}"}
    end
  end

  defp execute_delete_cutscene(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :cutscene} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted cutscene '#{key}'"}}

      _ ->
        {:error, "Cutscene not found: #{key}"}
    end
  end

  defp execute_get_cutscene(input) do
    key = input["key"]

    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, cs} ->
        cs_data = (cs.components || %{})["data"] || %{}

        {:ok,
         %{
           success: true,
           cutscene: %{
             key: cs.key,
             name: cs.short_desc,
             trigger: cs_data["trigger"],
             scenes: cs_data["scenes"] || []
           }
         }}

      _ ->
        {:error, "Cutscene not found: #{key}"}
    end
  end

  defp execute_list_cutscenes(_input) do
    cutscenes = Entities.find_all(type: :cutscene, is_prototype: true)

    list =
      Enum.map(cutscenes, fn c ->
        c_data = (c.components || %{})["data"] || %{}
        scenes = c_data["scenes"] || []
        %{key: c.key, name: c.short_desc || c.key, scene_count: length(scenes)}
      end)

    {:ok, %{success: true, message: "Found #{length(list)} cutscenes", cutscenes: list}}
  end

  # =============================================================================
  # Storyline CRUD Tools
  # =============================================================================

  defp execute_create_storyline(input) do
    key = input["key"]
    name = input["name"]
    main_quests = input["main_quests"] || []
    side_quests = input["side_quests"] || []

    entity =
      Entity.new(
        type: :storyline,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{
          "data" => %{
            "main_quests" => main_quests,
            "side_quests" => side_quests
          }
        },
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, warnings} =
          YamlBuilder.validate_references(:storyline, %{
            main_quests: main_quests,
            side_quests: side_quests
          })

        message = "Created storyline '#{name}' (#{key})"

        message =
          if warnings != [],
            do: message <> "\nWarnings: " <> Enum.join(warnings, "; "),
            else: message

        {:ok, %{success: true, message: message}}

      {:error, reason} ->
        {:error, "Failed to create storyline: #{inspect(reason)}"}
    end
  end

  defp execute_update_storyline(input) do
    key = input["key"]

    case Entities.find_one(key: key, type: :storyline) do
      {:ok, sl} ->
        sl_data = (sl.components || %{})["data"] || %{}
        name = input["name"] || sl.short_desc || key
        main_quests = input["main_quests"] || sl_data["main_quests"] || []
        side_quests = input["side_quests"] || sl_data["side_quests"] || []

        updated_components =
          Map.put(sl.components || %{}, "data", %{
            "main_quests" => main_quests,
            "side_quests" => side_quests
          })

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated storyline '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update storyline: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Storyline not found in DB: #{key}"}
        end

      _ ->
        {:error, "Storyline not found: #{key}"}
    end
  end

  defp execute_delete_storyline(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :storyline} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted storyline '#{key}'"}}

      _ ->
        {:error, "Storyline not found: #{key}"}
    end
  end

  defp execute_list_storylines(_input) do
    storylines = Entities.find_all(type: :storyline, is_prototype: true)

    list =
      Enum.map(storylines, fn s ->
        s_data = (s.components || %{})["data"] || %{}
        main = s_data["main_quests"] || []
        side = s_data["side_quests"] || []

        %{
          key: s.key,
          name: s.short_desc || s.key,
          main_quest_count: length(main),
          side_quest_count: length(side)
        }
      end)

    {:ok, %{success: true, message: "Found #{length(list)} storylines", storylines: list}}
  end

  # =============================================================================
  # Script CRUD Tools
  # =============================================================================

  alias Loka.Content.Script

  defp execute_create_script(input) do
    key = input["key"]
    hook = input["hook"]
    source = input["source"]
    name = input["name"] || "Script: #{key}"

    entity =
      Entity.new(
        type: :script,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{
          "data" => %{
            "hook" => hook,
            "source" => source,
            "timeout_ms" => 5000
          }
        },
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, %{success: true, message: "Created script '#{key}' (hook: #{hook})"}}

      {:error, reason} ->
        {:error, "Failed to create script: #{inspect(reason)}"}
    end
  end

  defp execute_update_script(input) do
    key = input["key"]

    case Script.get(key) do
      {:ok, script} ->
        hook = input["hook"] || Script.hook(script) || "on_enter"
        source = input["source"] || Script.source(script) || "continue.()"
        name = input["name"] || script.short_desc || "Script: #{key}"

        updated_data = %{
          "hook" => hook,
          "source" => source,
          "timeout_ms" => Script.timeout_ms(script) || 5000
        }

        updated_components = Map.put(script.components || %{}, "data", updated_data)

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated script '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update script: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Script not found in DB: #{key}"}
        end

      {:error, :not_found} ->
        {:error, "Script not found: #{key}"}
    end
  end

  defp execute_delete_script(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :script} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted script '#{key}'"}}

      _ ->
        {:error, "Script not found: #{key}"}
    end
  end

  defp execute_get_script(input) do
    key = input["key"]

    case Script.get(key) do
      {:ok, script} ->
        {:ok,
         %{
           success: true,
           script: %{
             key: script.key,
             name: script.short_desc,
             hook: Script.hook(script),
             source: Script.source(script),
             timeout_ms: Script.timeout_ms(script)
           }
         }}

      {:error, :not_found} ->
        {:error, "Script not found: #{key}"}
    end
  end

  defp execute_list_scripts(input) do
    scripts =
      if hook = input["hook"] do
        Script.for_hook(String.to_atom(hook))
      else
        Script.all()
      end

    list =
      Enum.map(scripts, fn s ->
        %{key: s.key, name: s.short_desc || s.key, hook: to_string(Script.hook(s) || "")}
      end)

    {:ok, %{success: true, message: "Found #{length(list)} scripts", scripts: list}}
  end

  defp execute_validate_script(input) do
    key = input["key"]

    case Script.get(key) do
      {:ok, script} ->
        case Script.validate(script) do
          :ok ->
            {:ok, %{success: true, message: "Script '#{key}' is valid"}}

          {:error, errors} ->
            {:ok, %{success: false, message: "Validation errors", errors: errors}}
        end

      {:error, :not_found} ->
        {:error, "Script not found: #{key}"}
    end
  end

  defp execute_create_script_from_template(input) do
    key = input["key"]
    template_id = input["template_id"]
    config = input["config"] || %{}

    config_str =
      config
      |> Enum.map(fn {k, v} -> "#{k}=#{v}" end)
      |> Enum.join(" ")

    case LokaWeb.Channels.BuilderCommands.Scripts.generate_template_data(
           key,
           template_id,
           config_str
         ) do
      {:ok, name, hook, source} ->
        entity =
          Entity.new(
            type: :script,
            key: key,
            short_desc: name,
            is_prototype: true,
            components: %{
              "data" => %{
                "hook" => hook,
                "source" => source,
                "timeout_ms" => 5000,
                "template_id" => template_id
              }
            },
            metadata: %{"draft" => true}
          )

        case Entities.save(entity) do
          {:ok, _} ->
            {:ok,
             %{success: true, message: "Created script '#{key}' from template '#{template_id}'"}}

          {:error, reason} ->
            {:error, "Failed to create script: #{inspect(reason)}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp execute_attach_script(input) do
    script_key = input["script_key"]
    entity_key = input["entity_key"]

    case Script.get(script_key) do
      {:ok, _} ->
        case Entities.find_one(key: entity_key) do
          {:ok, entity} ->
            data = (entity.components || %{})["data"] || %{}
            scripts = data["scripts"] || []

            if script_key in scripts do
              {:ok, %{success: true, message: "Script already attached"}}
            else
              updated_data = Map.put(data, "scripts", scripts ++ [script_key])
              updated_components = Map.put(entity.components || %{}, "data", updated_data)

              case Entities.get_entity_by_key(entity_key) do
                %{} = schema ->
                  Entities.update_entity(schema, %{components: updated_components})

                  {:ok,
                   %{
                     success: true,
                     message: "Attached script '#{script_key}' to '#{entity_key}'"
                   }}

                nil ->
                  {:error, "Entity not found in DB: #{entity_key}"}
              end
            end

          _ ->
            {:error, "Entity not found: #{entity_key}"}
        end

      {:error, :not_found} ->
        {:error, "Script not found: #{script_key}"}
    end
  end

  defp execute_detach_script(input) do
    script_key = input["script_key"]
    entity_key = input["entity_key"]

    case Entities.find_one(key: entity_key) do
      {:ok, entity} ->
        data = (entity.components || %{})["data"] || %{}
        scripts = data["scripts"] || []

        if script_key in scripts do
          updated_data = Map.put(data, "scripts", List.delete(scripts, script_key))
          updated_components = Map.put(entity.components || %{}, "data", updated_data)

          case Entities.get_entity_by_key(entity_key) do
            %{} = schema ->
              Entities.update_entity(schema, %{components: updated_components})

              {:ok,
               %{
                 success: true,
                 message: "Detached script '#{script_key}' from '#{entity_key}'"
               }}

            nil ->
              {:error, "Entity not found in DB: #{entity_key}"}
          end
        else
          {:error, "Script '#{script_key}' not attached to '#{entity_key}'"}
        end

      _ ->
        {:error, "Entity not found: #{entity_key}"}
    end
  end

  # =============================================================================
  # Query Tools
  # =============================================================================

  defp execute_get_room_info(input) do
    room_key = input["room_key"]

    case RoomManager.get_room(room_key) do
      {:ok, room} ->
        {:ok,
         %{
           success: true,
           room: %{
             key: room.key,
             name: room.name,
             description: room.description,
             x: room.x,
             y: room.y,
             z: room.z,
             exits: room.exits || %{},
             tags: room.tags || []
           }
         }}

      {:error, reason} ->
        {:error, "Room not found: #{inspect(reason)}"}
    end
  end

  defp execute_list_rooms(input) do
    filter_tag = input["filter_tag"]
    rooms = RoomManager.list_rooms()

    filtered_rooms =
      if filter_tag do
        Enum.filter(rooms, fn r -> filter_tag in (r.tags || []) end)
      else
        rooms
      end

    room_list =
      Enum.map(filtered_rooms, fn r ->
        %{
          key: r.key,
          name: r.name,
          x: r.x,
          y: r.y,
          z: r.z,
          exit_count: r.exits |> Map.keys() |> length()
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(room_list)} rooms",
       rooms: room_list
     }}
  end

  defp execute_batch_create_rooms(input) do
    rooms = input["rooms"] || []

    results =
      Enum.map(rooms, fn room_input ->
        execute_create_room(room_input)
      end)

    successful = Enum.count(results, fn r -> match?({:ok, _}, r) end)
    failed = Enum.count(results, fn r -> match?({:error, _}, r) end)

    if failed > 0 do
      errors = Enum.filter(results, fn r -> match?({:error, _}, r) end)
      {:error, "Created #{successful} rooms, #{failed} failed. Errors: #{inspect(errors)}"}
    else
      {:ok,
       %{
         success: true,
         message: "Created #{successful} rooms"
       }}
    end
  end

  # =============================================================================
  # Analysis Tools
  # =============================================================================

  defp execute_validate_world(_input) do
    results = ValidationManager.validate_all()

    summary = %{
      total_errors: results.total_errors,
      total_warnings: results.total_warnings,
      rooms: %{
        errors: length(results.rooms.errors),
        warnings: length(results.rooms.warnings),
        valid: results.rooms.valid
      }
    }

    details = %{
      room_errors:
        results.rooms.errors
        |> Enum.flat_map(fn r -> Enum.map(r.errors, &"#{r.room_key}: #{&1}") end)
        |> Enum.take(20),
      room_warnings:
        results.rooms.warnings
        |> Enum.flat_map(fn r -> Enum.map(r.warnings, &"#{r.room_key}: #{&1}") end)
        |> Enum.take(20),
      quest_errors: Map.get(results.quests, :errors, []) |> Enum.map(&inspect/1) |> Enum.take(10),
      quest_warnings:
        Map.get(results.quests, :warnings, []) |> Enum.map(&inspect/1) |> Enum.take(10),
      cutscene_errors:
        Map.get(results.cutscenes, :errors, []) |> Enum.map(&inspect/1) |> Enum.take(10),
      cutscene_warnings:
        Map.get(results.cutscenes, :warnings, []) |> Enum.map(&inspect/1) |> Enum.take(10)
    }

    if results.total_errors == 0 and results.total_warnings == 0 do
      {:ok, %{success: true, message: "All content validates successfully!", summary: summary}}
    else
      {:ok,
       %{
         success: true,
         message: "Found #{results.total_errors} errors and #{results.total_warnings} warnings",
         summary: summary,
         details: details
       }}
    end
  end

  defp execute_search_content(input) do
    query = input["query"] || ""
    type_filter = input["type"]

    if String.trim(query) == "" do
      {:error, "Search query cannot be empty"}
    else
      query_lower = String.downcase(query)

      all_objects = Entities.find_all(is_prototype: true)

      matches =
        all_objects
        |> maybe_filter_by_type(type_filter)
        |> Enum.filter(fn obj ->
          searchable = build_searchable_text(obj)
          String.contains?(String.downcase(searchable), query_lower)
        end)
        |> Enum.take(20)
        |> Enum.map(fn obj ->
          %{
            key: obj.key,
            type: obj.type,
            subtype: obj.type,
            name: obj.short_desc || obj.key,
            snippet: build_snippet(obj, query_lower)
          }
        end)

      {:ok,
       %{
         success: true,
         message: "Found #{length(matches)} results for \"#{query}\"",
         results: matches
       }}
    end
  end

  defp maybe_filter_by_type(objects, nil), do: objects

  defp maybe_filter_by_type(objects, type_string) do
    type_atom = String.to_atom(type_string)
    Enum.filter(objects, fn obj -> obj.type == type_atom end)
  end

  defp build_searchable_text(obj) do
    data = (obj.components || %{})["data"] || %{}

    parts = [
      obj.key,
      obj.short_desc || "",
      obj.extra_desc || "",
      data["zone"] || ""
    ]

    Enum.join(parts, " ")
  end

  defp build_snippet(obj, query_lower) do
    text = build_searchable_text(obj)
    text_lower = String.downcase(text)

    # Find match position using grapheme-safe string operations
    case string_find_index(text_lower, query_lower) do
      nil ->
        String.slice(text, 0, 100)

      pos ->
        start = max(0, pos - 40)
        String.slice(text, start, 100)
    end
  end

  defp string_find_index(haystack, needle) do
    case String.split(haystack, needle, parts: 2) do
      [before, _] -> String.length(before)
      _ -> nil
    end
  end

  # =============================================================================
  # Result Formatting
  # =============================================================================

  @doc """
  Format a tool result for display in the chat UI.
  """
  def format_result({:ok, result}) do
    %{
      status: "success",
      message: result[:message] || "Operation completed",
      data: Map.drop(result, [:success, :message])
    }
  end

  def format_result({:error, reason}) when is_binary(reason) do
    %{
      status: "error",
      message: reason,
      data: nil
    }
  end

  def format_result({:error, reason}) do
    %{
      status: "error",
      message: inspect(reason),
      data: nil
    }
  end
end
