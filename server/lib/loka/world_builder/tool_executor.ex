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
    Projects,
    AuditLog,
    ValidationManager
  }

  alias Loka.WorldBuilder.LLM.ObservabilityLogger
  alias Loka.Content.{Zone, Dialogue}

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

    # Get project context from opts
    project_key = opts[:project_key]

    # Normalize tool name - strip wb_ prefix if present for backwards compatibility
    normalized_name = String.replace_prefix(tool_name, "wb_", "")

    result =
      case normalized_name do
        # Project tools
        "create_project" -> execute_create_project(input)
        "load_project" -> execute_load_project(input)
        "list_projects" -> execute_list_projects(input)
        "delete_project" -> execute_delete_project(input)
        # Document tools
        "write_doc" -> execute_write_doc(input, project_key)
        "read_doc" -> execute_read_doc(input, project_key)
        "list_docs" -> execute_list_docs(input, project_key)
        "delete_doc" -> execute_delete_doc(input, project_key)
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
        "list_npcs" -> execute_list_npcs(input)
        "list_items" -> execute_list_items(input)
        # Quest tools
        "create_quest" -> execute_create_quest(input)
        "update_quest" -> execute_update_quest(input)
        "list_quests" -> execute_list_quests(input)
        # Dialogue tools
        "create_dialogue" -> execute_create_dialogue(input)
        "get_dialogue" -> execute_get_dialogue(input)
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

    # Log to audit log if project context exists
    if project_key do
      case result do
        {:ok, _} ->
          AuditLog.log_success(
            project_key,
            opts[:conversation_id],
            tool_name,
            input,
            nil
          )

        {:error, reason} ->
          AuditLog.log_error(
            project_key,
            opts[:conversation_id],
            tool_name,
            input,
            inspect(reason)
          )
      end
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
  # Project Tools
  # =============================================================================

  defp execute_create_project(input) do
    key = input["key"]
    name = input["name"]
    description = input["description"] || ""

    case Projects.create_project(key, name, description) do
      {:ok, _doc} ->
        {:ok,
         %{
           success: true,
           message: "Created project '#{name}' (#{key})",
           project: %{
             key: key,
             name: name
           }
         }}

      {:error, changeset} ->
        {:error, "Failed to create project: #{inspect(changeset.errors)}"}
    end
  end

  defp execute_load_project(input) do
    key = input["key"]

    case Projects.get_project(key) do
      {:ok, project} ->
        doc_summaries =
          Enum.map(project.documents, fn doc ->
            %{
              filename: doc.filename,
              doc_type: doc.doc_type,
              version: doc.version,
              preview: String.slice(doc.content, 0, 200)
            }
          end)

        {:ok,
         %{
           success: true,
           message: "Loaded project '#{key}'",
           project: %{
             key: project.key,
             stats: project.stats,
             documents: doc_summaries
           }
         }}

      {:error, :not_found} ->
        {:error, "Project not found: #{key}"}
    end
  end

  defp execute_list_projects(_input) do
    projects = Projects.list_projects()

    {:ok,
     %{
       success: true,
       message: "Found #{length(projects)} projects",
       projects: projects
     }}
  end

  defp execute_delete_project(input) do
    key = input["key"]

    case Projects.delete_project(key) do
      {:ok, count} ->
        {:ok,
         %{
           success: true,
           message: "Deleted project '#{key}' (#{count} documents removed)"
         }}

      {:error, :not_found} ->
        {:error, "Project not found: #{key}"}
    end
  end

  # =============================================================================
  # Document Tools
  # =============================================================================

  defp execute_write_doc(input, project_key) do
    project_key = input["project_key"] || project_key

    if is_nil(project_key) do
      {:error, "No project loaded. Use create_project or load_project first."}
    else
      filename = input["filename"]
      content = input["content"]
      doc_type = input["doc_type"] || "design"

      case Projects.write_doc(project_key, filename, content, doc_type) do
        {:ok, doc} ->
          {:ok,
           %{
             success: true,
             message: "Saved document '#{filename}' (v#{doc.version})",
             document: %{
               filename: doc.filename,
               doc_type: doc.doc_type,
               version: doc.version
             }
           }}

        {:error, changeset} ->
          {:error, "Failed to save document: #{inspect(changeset.errors)}"}
      end
    end
  end

  defp execute_read_doc(input, project_key) do
    project_key = input["project_key"] || project_key

    if is_nil(project_key) do
      {:error, "No project loaded. Use create_project or load_project first."}
    else
      filename = input["filename"]

      case Projects.get_doc(project_key, filename) do
        {:ok, doc} ->
          {:ok,
           %{
             success: true,
             document: %{
               filename: doc.filename,
               content: doc.content,
               doc_type: doc.doc_type,
               version: doc.version
             }
           }}

        {:error, :not_found} ->
          {:error, "Document not found: #{filename}"}
      end
    end
  end

  defp execute_list_docs(input, project_key) do
    project_key = input["project_key"] || project_key

    if is_nil(project_key) do
      {:error, "No project loaded. Use create_project or load_project first."}
    else
      doc_type = input["doc_type"]
      docs = Projects.list_docs(project_key, doc_type)

      doc_list =
        Enum.map(docs, fn doc ->
          %{
            filename: doc.filename,
            doc_type: doc.doc_type,
            version: doc.version
          }
        end)

      {:ok,
       %{
         success: true,
         message: "Found #{length(doc_list)} documents",
         documents: doc_list
       }}
    end
  end

  defp execute_delete_doc(input, project_key) do
    project_key = input["project_key"] || project_key

    if is_nil(project_key) do
      {:error, "No project loaded. Use create_project or load_project first."}
    else
      filename = input["filename"]

      case Projects.delete_doc(project_key, filename) do
        {:ok, _doc} ->
          {:ok,
           %{
             success: true,
             message: "Deleted document '#{filename}'"
           }}

        {:error, :not_found} ->
          {:error, "Document not found: #{filename}"}
      end
    end
  end

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
    entity_key = input["entity_key"]
    trigger = input["trigger"] || "on_talk"
    entry_node = input["entry_node"]
    nodes = input["nodes"] || %{}

    with :ok <- validate_safe_key(key) do
      ensure_dialogues_dir()
      yaml_path = dialogue_yaml_path(key)

      yaml_content = build_dialogue_yaml(key, entity_key, trigger, entry_node, nodes)

      case File.write(yaml_path, yaml_content) do
        :ok ->
          # Reload the registry
          Loka.Engine.TypedObject.Loader.reload()

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

  defp ensure_dialogues_dir do
    dir = Path.join([:code.priv_dir(:loka), "world", "dialogues"])
    File.mkdir_p!(dir)
  end

  defp build_dialogue_yaml(key, entity_key, trigger, entry_node, nodes) do
    nodes_yaml = build_nodes_yaml(nodes)

    """
    key: #{key}
    type: dialogue
    name: "Dialogue: #{entity_key}"
    data:
      entity_key: #{entity_key}
      trigger: #{trigger}
      entry_node: #{entry_node}
      nodes:
    #{nodes_yaml}
    """
  end

  defp build_nodes_yaml(nodes) when is_map(nodes) do
    nodes
    |> Enum.map(fn {node_id, node_data} ->
      text = node_data["text"] || ""
      choices = node_data["choices"] || []
      choices_yaml = build_choices_yaml(choices)

      """
          #{node_id}:
            text: "#{escape_yaml_string(text)}"
            choices:
      #{choices_yaml}
      """
    end)
    |> Enum.join("")
  end

  defp build_nodes_yaml(_), do: ""

  defp build_choices_yaml(choices) when is_list(choices) do
    choices
    |> Enum.map(fn choice ->
      text = choice["text"] || ""
      next_node = choice["next"] || "end"

      """
              - text: "#{escape_yaml_string(text)}"
                next: #{next_node}
      """
    end)
    |> Enum.join("")
  end

  defp build_choices_yaml(_), do: ""

  defp escape_yaml_string(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_yaml_string(_), do: ""

  defp execute_get_dialogue(input) do
    dialogue_key = input["dialogue_key"]

    case Dialogue.get(dialogue_key) do
      {:ok, dialogue} ->
        {:ok,
         %{
           success: true,
           dialogue: %{
             key: dialogue.key,
             entity_key: get_in(dialogue.data, ["entity_key"]),
             trigger: get_in(dialogue.data, ["trigger"]),
             entry_node: get_in(dialogue.data, ["entry_node"]),
             nodes: get_in(dialogue.data, ["nodes"]) || %{}
           }
         }}

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{dialogue_key}"}
    end
  end

  defp dialogue_yaml_path(key) do
    Path.join([:code.priv_dir(:loka), "world", "dialogues", "#{key}.yml"])
  end

  # =============================================================================
  # Zone Tools
  # =============================================================================

  defp execute_get_zone_info(input) do
    zone_key = input["zone_key"]

    case Zone.get(zone_key) do
      {:ok, zone} ->
        {:ok,
         %{
           success: true,
           zone: %{
             key: zone.key,
             name: zone.name,
             description: zone.description,
             level_range: zone.attributes[:level_range] || zone[:level_range],
             rooms: get_in(zone.data, ["rooms"]) || [],
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
          key: get_safe_field(zone, :key),
          name: get_safe_field(zone, :name),
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
    data = get_safe_field(zone, :data)

    cond do
      is_map(data) && Map.has_key?(data, "rooms") -> data["rooms"] || []
      is_map(data) && Map.has_key?(data, :rooms) -> data[:rooms] || []
      true -> []
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

      all_objects = Loka.Engine.TypedObject.Registry.all()

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
            subtype: obj.subtype,
            name: get_in(obj.data, ["name"]) || obj.key,
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
    type_atom = String.to_existing_atom(type_string)
    Enum.filter(objects, fn obj -> obj.subtype == type_atom or obj.type == type_atom end)
  rescue
    _ -> objects
  end

  defp build_searchable_text(obj) do
    parts = [
      obj.key,
      get_in(obj.data, ["name"]) || "",
      get_in(obj.data, ["description"]) || "",
      get_in(obj.data, ["zone"]) || ""
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
