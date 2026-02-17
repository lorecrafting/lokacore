defmodule Loka.WorldBuilder.ToolExecutor do
  @moduledoc """
  Executes LLM tool calls in the World Builder.

  Dispatches to domain-specific modules:
  - `ToolExecutor.Rooms` — room and exit CRUD
  - `ToolExecutor.Entities` — NPC and item CRUD
  - `ToolExecutor.Quests` — quest CRUD
  - `ToolExecutor.Dialogues` — dialogue CRUD
  - `ToolExecutor.Zones` — zone, cutscene, and storyline CRUD
  - `ToolExecutor.Scripts` — script CRUD, templates, attach/detach
  - `ToolExecutor.Analysis` — search, validation, guides
  - `ToolExecutor.GameQueries` — read-only entity/player state queries (builder vs player modes)
  """
  require Logger

  alias Loka.WorldBuilder.AuditLog
  alias Loka.WorldBuilder.LLM.ObservabilityLogger

  alias Loka.WorldBuilder.ToolExecutor.{
    Rooms,
    Entities,
    Quests,
    Dialogues,
    Zones,
    Scripts,
    Analysis,
    GameQueries
  }

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

    # Enforce mode — player mode can only use read-only tools
    result =
      if opts[:mode] == :player and not player_allowed?(normalized_name) do
        {:error, "Tool '#{tool_name}' is not available in player mode"}
      else
        dispatch(normalized_name, input, opts)
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

  # =============================================================================
  # Dispatch
  # =============================================================================

  defp dispatch(name, input, opts) do
    case name do
      # Guidance
      "read_guide" -> Analysis.execute_read_guide(input)
      # Room tools
      "create_room" -> Rooms.execute_create_room(input)
      "update_room" -> Rooms.execute_update_room(input)
      "delete_room" -> Rooms.execute_delete_room(input)
      "create_exit" -> Rooms.execute_create_exit(input)
      "remove_exit" -> Rooms.execute_remove_exit(input)
      "batch_create_rooms" -> Rooms.execute_batch_create_rooms(input)
      "get_room_info" -> Rooms.execute_get_room_info(input)
      "list_rooms" -> Rooms.execute_list_rooms(input)
      # Entity tools
      "create_npc" -> Entities.execute_create_npc(input)
      "create_item" -> Entities.execute_create_item(input)
      "update_npc" -> Entities.execute_update_entity(:npc, input)
      "update_item" -> Entities.execute_update_entity(:item, input)
      "delete_npc" -> Entities.execute_delete_entity(:npc, input)
      "delete_item" -> Entities.execute_delete_entity(:item, input)
      "list_npcs" -> Entities.execute_list_npcs(input)
      "list_items" -> Entities.execute_list_items(input)
      # Quest tools
      "create_quest" -> Quests.execute_create_quest(input)
      "update_quest" -> Quests.execute_update_quest(input)
      "delete_quest" -> Quests.execute_delete_quest(input)
      "list_quests" -> Quests.execute_list_quests(input)
      # Dialogue tools
      "create_dialogue" -> Dialogues.execute_create_dialogue(input)
      "get_dialogue" -> Dialogues.execute_get_dialogue(input)
      "update_dialogue" -> Dialogues.execute_update_dialogue(input)
      "delete_dialogue" -> Dialogues.execute_delete_dialogue(input)
      "list_dialogues" -> Dialogues.execute_list_dialogues(input)
      # Zone tools
      "create_zone" -> Zones.execute_create_zone(input)
      "update_zone" -> Zones.execute_update_zone(input)
      "delete_zone" -> Zones.execute_delete_zone(input)
      "get_zone_info" -> Zones.execute_get_zone_info(input)
      "list_zones" -> Zones.execute_list_zones(input)
      # Cutscene tools
      "create_cutscene" -> Zones.execute_create_cutscene(input)
      "update_cutscene" -> Zones.execute_update_cutscene(input)
      "delete_cutscene" -> Zones.execute_delete_cutscene(input)
      "get_cutscene" -> Zones.execute_get_cutscene(input)
      "list_cutscenes" -> Zones.execute_list_cutscenes(input)
      # Storyline tools
      "create_storyline" -> Zones.execute_create_storyline(input)
      "update_storyline" -> Zones.execute_update_storyline(input)
      "delete_storyline" -> Zones.execute_delete_storyline(input)
      "list_storylines" -> Zones.execute_list_storylines(input)
      # Script tools
      "create_script" -> Scripts.execute_create_script(input)
      "update_script" -> Scripts.execute_update_script(input)
      "delete_script" -> Scripts.execute_delete_script(input)
      "get_script" -> Scripts.execute_get_script(input)
      "list_scripts" -> Scripts.execute_list_scripts(input)
      "validate_script" -> Scripts.execute_validate_script(input)
      "create_script_from_template" -> Scripts.execute_create_script_from_template(input)
      "attach_script" -> Scripts.execute_attach_script(input)
      "detach_script" -> Scripts.execute_detach_script(input)
      # Analysis tools
      "validate_world" -> Analysis.execute_validate_world(input)
      "search_content" -> Analysis.execute_search_content(input)
      # Game query tools (read-only, mode-aware)
      "get_entity" -> GameQueries.execute_get_entity(input, opts)
      "query_entities" -> GameQueries.execute_query_entities(input, opts)
      "get_player_state" -> GameQueries.execute_get_player_state(opts)
      _ -> {:error, "Unknown tool: #{name}"}
    end
  end

  # Tools allowed in :player mode (read-only, no world mutation)
  @player_tools ~w(get_entity query_entities get_player_state)
  defp player_allowed?(name), do: name in @player_tools

  defp result_preview({:ok, data}) when is_map(data) do
    data[:message] || "success"
  end

  defp result_preview({:error, reason}), do: inspect(reason)
  defp result_preview(_), do: "unknown"
end
