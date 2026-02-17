defmodule LokaWeb.Channels.BuilderCommands.AI do
  @moduledoc """
  AI command handlers for the builder terminal.

  Manages `/ai <prompt>`, `chat` mode toggle, `/ai clear` commands.
  Uses Loka.AI.Conversation engine for streaming responses.
  """

  require Logger

  import Phoenix.Socket, only: [assign: 3]
  import Phoenix.Channel, only: [push: 3]

  alias Loka.AI.Conversation
  alias Loka.Engine.{Entity, Entities}
  alias Loka.WorldBuilder.{AnthropicClient, ToolExecutor}

  @max_desc_length 300

  @max_retries 3

  # Cache system prompt at compile time to avoid reading from disk on every AI call
  @system_prompt_path Path.join(:code.priv_dir(:loka), "world_builder/system_prompt.md")
  @external_resource @system_prompt_path
  @cached_system_prompt (case File.read(@system_prompt_path) do
                           {:ok, content} -> content
                           {:error, _} -> nil
                         end)

  # AI streaming timeout (2 minutes)
  @ai_timeout_ms 120_000

  @doc """
  Handle `/ai <prompt>` — send a one-shot prompt to the AI.
  """
  def execute(:ai, %{prompt: prompt}, socket) do
    socket = ensure_conversation(socket)
    stash_character(socket)
    conversation = socket.assigns.ai_conversation

    conversation = Conversation.send_message(conversation, prompt, build_context(socket))

    # Set a timeout to auto-cancel hung streams
    timer_ref = Process.send_after(self(), :ai_timeout, @ai_timeout_ms)

    socket =
      socket
      |> assign(:ai_conversation, conversation)
      |> assign(:ai_streaming, true)
      |> assign(:ai_timeout_ref, timer_ref)

    {:ok, socket}
  end

  # Handle `/ai clear` — reset conversation history.
  def execute(:ai_clear, _params, socket) do
    socket = cancel_ai_timeout(socket)

    socket =
      if socket.assigns[:ai_conversation] do
        conversation = Conversation.clear_history(socket.assigns.ai_conversation)
        assign(socket, :ai_conversation, conversation)
      else
        socket
      end

    push(socket, "output", %{text: "[BUILDER] AI conversation history cleared."})
    {:ok, socket}
  end

  # Handle `/ai cancel` — cancel in-progress AI streaming.
  def execute(:ai_cancel, _params, socket) do
    if socket.assigns[:ai_streaming] do
      socket = cancel_ai_streaming(socket)
      push(socket, "output", %{text: "[BUILDER] AI request cancelled."})
      {:ok, socket}
    else
      push(socket, "output", %{text: "[BUILDER] No AI request in progress."})
      {:ok, socket}
    end
  end

  # Handle `chat` — enter chat mode.
  def execute(:chat_mode, _params, socket) do
    socket =
      socket
      |> assign(:chat_mode, true)
      |> ensure_conversation()

    push(socket, "chat_mode_changed", %{mode: "chat"})

    push(socket, "output", %{
      text: "[BUILDER] Entered chat mode. Type 'exit' or '/exit' to leave."
    })

    {:ok, socket}
  end

  # Handle `exit` / `/exit` — leave chat mode.
  def execute(:exit_chat, _params, socket) do
    socket = assign(socket, :chat_mode, false)

    push(socket, "chat_mode_changed", %{mode: "normal"})
    push(socket, "output", %{text: "[BUILDER] Left chat mode."})
    {:ok, socket}
  end

  @doc """
  Handle chat mode input — route plain text to AI.
  """
  def handle_chat_input(text, socket) do
    # Check for exit commands
    trimmed = String.trim(text)

    if trimmed in ["exit", "/exit"] do
      execute(:exit_chat, %{}, socket)
    else
      socket = ensure_conversation(socket)
      stash_character(socket)
      conversation = socket.assigns.ai_conversation

      conversation = Conversation.send_message(conversation, trimmed, build_context(socket))

      # Set streaming timeout (same as /ai command)
      timer_ref = Process.send_after(self(), :ai_timeout, @ai_timeout_ms)

      socket =
        socket
        |> assign(:ai_conversation, conversation)
        |> assign(:ai_streaming, true)
        |> assign(:ai_timeout_ref, timer_ref)

      {:ok, socket}
    end
  end

  @doc """
  Handle AI streaming events from the Conversation engine.
  Called by game_channel handle_info clauses.
  """
  def handle_ai_event({:ai_text_delta, text}, socket) do
    push(socket, "ai_stream_delta", %{text: text})
    {:noreply, socket}
  end

  def handle_ai_event({:ai_tool_use_raw, name, id, input}, socket) do
    conversation = socket.assigns[:ai_conversation]

    if conversation do
      conversation = Conversation.handle_tool_use(conversation, name, id, input)
      socket = assign(socket, :ai_conversation, conversation)

      # Push tool event to client
      summary = format_tool_summary(name, input)
      push(socket, "ai_stream_tool", %{name: name, summary: summary})

      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  def handle_ai_event({:ai_done_raw, response}, socket) do
    conversation = socket.assigns[:ai_conversation]

    if conversation do
      conversation = Conversation.handle_done(conversation, response)
      socket = assign(socket, :ai_conversation, conversation)
      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  def handle_ai_event({:ai_done}, socket) do
    socket = finish_ai_streaming(socket)
    push(socket, "ai_stream_done", %{})
    {:noreply, socket}
  end

  def handle_ai_event({:ai_error, reason}, socket) do
    retries = socket.assigns[:ai_retry_count] || 0

    if rate_limited?(reason) and retries < @max_retries do
      backoff_ms = 2_000 * Integer.pow(2, retries)

      Logger.warning(
        "[BuilderAI] Rate limited (429), retry #{retries + 1}/#{@max_retries} after #{backoff_ms}ms"
      )

      push(socket, "ai_stream_text", %{
        text: "\n[Rate limited, retrying in #{div(backoff_ms, 1000)}s...]\n"
      })

      Process.send_after(self(), :ai_retry, backoff_ms)
      {:noreply, assign(socket, :ai_retry_count, retries + 1)}
    else
      socket = finish_ai_streaming(socket)
      socket = assign(socket, :ai_retry_count, 0)
      push(socket, "ai_stream_error", %{error: reason})
      {:noreply, socket}
    end
  end

  def handle_ai_event({:ai_tool_use, _name, _id, _input, _result}, socket) do
    # Verbose mode tool completion — already pushed during handle_tool_use_raw
    {:noreply, socket}
  end

  def handle_ai_event(:ai_timeout, socket) do
    if socket.assigns[:ai_streaming] do
      socket = cancel_ai_streaming(socket)
      push(socket, "ai_stream_error", %{error: "AI request timed out after 2 minutes."})
      push(socket, "ai_stream_done", %{})
      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp ensure_conversation(socket) do
    if socket.assigns[:ai_conversation] do
      socket
    else
      config = %{
        tools: AnthropicClient.get_tools(:builder),
        system_prompt_fn: &build_system_prompt/1,
        tool_executor_fn: fn name, input, _opts ->
          # Defer reloads — a single reload happens when the conversation turn ends
          Process.put(:loka_defer_reload, true)
          # Read fresh character from process dictionary (stashed before each send_message)
          character = Process.get(:loka_ai_character)
          ToolExecutor.execute(name, input, character: character, mode: :builder)
        end,
        verbosity: :verbose,
        caller_pid: self(),
        model: "claude-sonnet-4-6",
        max_tokens: 4096
      }

      assign(socket, :ai_conversation, Conversation.new(config))
    end
  end

  # Stash the latest character in the process dictionary so the tool executor
  # closure always sees current state (not a stale snapshot from conversation init).
  defp stash_character(socket) do
    Process.put(:loka_ai_character, socket.assigns[:character])
  end

  defp build_context(socket) do
    character = socket.assigns[:character]

    # Always load fresh room from the character's current location to avoid stale data.
    # socket.assigns[:room] is only set at join time and by builder commands.
    {room, room_key} = load_fresh_room(character)

    %{
      room_key: room_key,
      room: room,
      character: character
    }
  end

  defp load_fresh_room(nil), do: {nil, "unknown"}

  defp load_fresh_room(character) do
    alias LokaWeb.Channels.RoomHelpers
    {room, _} = RoomHelpers.load_room_for_character(character)
    {room, Map.get(room, :key, "unknown")}
  end

  defp build_system_prompt(context) do
    version = context[:prompt_version]
    base = load_system_prompt(version)

    game_context = format_game_context(context)

    terminal_context = """

    ## Terminal Formatting

    Format responses for a monospace terminal:
    - Keep lines under 80 characters
    - Use plain text, newlines for structure
    - No markdown headers (use CAPS or dashes for emphasis)
    - Indent with 2 spaces for hierarchy
    """

    base <> game_context <> terminal_context
  end

  defp format_game_context(context) do
    parts =
      [
        format_room_context(context[:room]),
        format_character_context(context[:character])
      ]
      |> Enum.reject(&is_nil/1)

    case parts do
      [] -> ""
      _ -> "\n\n## Current Game State\n\n" <> Enum.join(parts, "\n\n")
    end
  end

  defp format_room_context(nil), do: nil

  defp format_room_context(room) do
    exits =
      (room[:exits] || [])
      |> Enum.map(fn e -> "  #{e[:direction]} -> #{e[:destination] || e[:destination_id]}" end)
      |> Enum.join("\n")

    npcs =
      (room[:entities] || [])
      |> Enum.map(fn e -> "  #{e[:key]} (#{e[:name]})" end)
      |> Enum.join("\n")

    items =
      (room[:items] || [])
      |> Enum.map(fn i ->
        count = i[:count] || 1

        if count > 1,
          do: "  #{i[:key]} x#{count} (#{i[:name]})",
          else: "  #{i[:key]} (#{i[:name]})"
      end)
      |> Enum.join("\n")

    desc = truncate(to_string(room[:description]), @max_desc_length)

    lines = [
      "CURRENT ROOM: #{room[:key]}",
      "  Title: #{room[:title]}",
      "  Description: #{desc}",
      if(exits != "", do: "  Exits:\n#{exits}"),
      if(npcs != "", do: "  NPCs present:\n#{npcs}"),
      if(items != "", do: "  Items on ground:\n#{items}")
    ]

    lines |> Enum.reject(&is_nil/1) |> Enum.join("\n")
  end

  defp format_character_context(nil), do: nil

  defp format_character_context(character) do
    combatant = Entity.get_component(character, "combatant") || %{}
    resources = Entity.get_component(character, "resources") || %{}
    stats = Entity.get_component(character, "stats") || %{}
    wallet = Entity.get_component(character, "wallet") || %{}
    inventory = Entity.get_component(character, "inventory") || []
    equipment = Entity.get_component(character, "equipment") || %{}
    quest_progress = Entity.get_component(character, "quest_progress") || %{}
    flags = Entity.get_component(character, "flags") || %{}

    health = get_in(resources, ["health", "current"]) || combatant["health"]
    max_health = get_in(resources, ["health", "max"]) || combatant["max_health"]
    mana_current = get_in(resources, ["mana", "current"])
    mana_max = get_in(resources, ["mana", "max"])

    stat_line =
      stats
      |> Enum.map(fn {k, v} -> "#{k}:#{v}" end)
      |> Enum.join(" ")

    # Batch-resolve all entity names in one pass to avoid N+1 queries
    all_item_ids =
      (inventory ++ Map.values(equipment))
      |> Enum.reject(fn v -> is_nil(v) or v == "" end)
      |> Enum.uniq()

    name_map = resolve_entity_names(all_item_ids)

    inv_line = format_inventory(inventory, name_map)
    equip_line = format_equipment(equipment, name_map)
    quest_line = format_active_quests(quest_progress["active"] || %{})
    completed_quests = quest_progress["completed"] || []

    flag_line =
      flags
      |> Enum.map(fn {k, v} -> "  #{k}: #{inspect(v)}" end)
      |> Enum.join("\n")

    lines = [
      "CHARACTER: #{character.short_desc || character.key}",
      "  Level: #{combatant["level"] || 1}  XP: #{combatant["xp"] || 0}  Gold: #{wallet["gold"] || 0}",
      if(health, do: "  Health: #{health}/#{max_health}"),
      if(mana_current, do: "  Mana: #{mana_current}/#{mana_max}"),
      if(stat_line != "", do: "  Stats: #{stat_line}"),
      if(inv_line != "", do: "  Inventory:\n#{inv_line}"),
      if(equip_line != "", do: "  Equipment:\n#{equip_line}"),
      if(quest_line != "", do: "  Active Quests:\n#{quest_line}"),
      if(completed_quests != [], do: "  Completed Quests: #{Enum.join(completed_quests, ", ")}"),
      if(flag_line != "", do: "  Flags:\n#{flag_line}")
    ]

    lines |> Enum.reject(&is_nil/1) |> Enum.join("\n")
  end

  defp format_inventory(inventory, name_map) do
    inventory
    |> Enum.frequencies()
    |> Enum.map(fn {id, count} ->
      label = format_item_label(id, name_map)
      if count > 1, do: "  #{label} x#{count}", else: "  #{label}"
    end)
    |> Enum.join("\n")
  end

  defp format_equipment(equipment, name_map) do
    equipment
    |> Enum.reject(fn {_slot, v} -> is_nil(v) or v == "" end)
    |> Enum.map(fn {slot, item_id} ->
      "  #{slot}: #{format_item_label(item_id, name_map)}"
    end)
    |> Enum.join("\n")
  end

  defp format_item_label(id, name_map) do
    case Map.get(name_map, id) do
      nil -> id
      name when name == id -> id
      name -> "#{name} (#{id})"
    end
  end

  defp format_active_quests(active_quests) do
    active_quests
    |> Enum.map(fn {qkey, qdata} ->
      status = qdata["status"] || "active"
      objectives = format_quest_objectives(qdata["objectives"])

      if objectives != "" do
        "  #{qkey} (#{status})\n#{objectives}"
      else
        "  #{qkey} (#{status})"
      end
    end)
    |> Enum.join("\n")
  end

  defp format_quest_objectives(nil), do: ""

  defp format_quest_objectives(objectives) when is_map(objectives) do
    objectives
    |> Enum.map(fn {obj_id, obj_data} ->
      desc = obj_data["description"] || obj_id
      current = obj_data["current"] || obj_data["count"] || 0
      target = obj_data["target"] || obj_data["required"] || 1
      done = obj_data["completed"] || false
      marker = if done, do: "[x]", else: "[ ]"
      "    #{marker} #{desc} (#{current}/#{target})"
    end)
    |> Enum.join("\n")
  end

  defp format_quest_objectives(_), do: ""

  # Batch-resolve entity keys to display names in a single pass.
  # Returns %{id => name}. Called once per AI message, not per-item.
  defp resolve_entity_names(ids) do
    Enum.reduce(ids, %{}, fn id, acc ->
      try do
        case Entities.find_one(key: id) do
          {:ok, entity} -> Map.put(acc, id, entity.short_desc)
          _ -> acc
        end
      rescue
        _ -> acc
      end
    end)
  end

  defp truncate(str, max) when byte_size(str) <= max, do: str
  defp truncate(str, max), do: String.slice(str, 0, max) <> "..."

  @doc false
  @spec load_system_prompt(String.t() | nil) :: String.t()
  def load_system_prompt(version \\ nil) do
    case version do
      nil ->
        @cached_system_prompt || default_system_prompt()

      ver ->
        path = Path.join([:code.priv_dir(:loka), "world_builder", "prompts", "#{ver}.md"])

        case File.read(path) do
          {:ok, content} -> content
          {:error, _} -> @cached_system_prompt || default_system_prompt()
        end
    end
  end

  defp default_system_prompt do
    """
    # World Builder Assistant

    You are a creative writing and game design assistant specialized in building
    MUD (Multi-User Dungeon) worlds. You help create rich, interconnected game
    worlds with compelling narratives, memorable characters, and engaging quests.

    You have access to tools for managing rooms, NPCs, items, quests, dialogues,
    scripts, zones, and design documents.
    """
  end

  @doc "Handle retry after rate limit backoff."
  @spec handle_ai_retry(Phoenix.Socket.t()) :: {:noreply, Phoenix.Socket.t()}
  def handle_ai_retry(socket) do
    conversation = socket.assigns[:ai_conversation]

    if conversation && socket.assigns[:ai_streaming] do
      Logger.info("[BuilderAI] Retrying after rate limit...")
      conversation = Conversation.resend(conversation, %{})
      {:noreply, assign(socket, :ai_conversation, conversation)}
    else
      {:noreply, socket}
    end
  end

  defp rate_limited?(reason) when is_binary(reason), do: String.contains?(reason, "429")
  defp rate_limited?(_), do: false

  defp finish_ai_streaming(socket) do
    socket
    |> cancel_ai_timeout()
    |> assign(:ai_streaming, false)
  end

  defp cancel_ai_streaming(socket) do
    socket
    |> cancel_ai_timeout()
    |> assign(:ai_streaming, false)
  end

  defp cancel_ai_timeout(socket) do
    case socket.assigns[:ai_timeout_ref] do
      ref when is_reference(ref) ->
        Process.cancel_timer(ref)
        assign(socket, :ai_timeout_ref, nil)

      _ ->
        socket
    end
  end

  defp format_tool_summary(name, input) do
    case name do
      "wb_create_room" -> "Creating room: #{input["name"] || input["key"]}"
      "wb_update_room" -> "Updating room: #{input["key"]}"
      "wb_create_npc" -> "Creating NPC: #{input["name"] || input["key"]}"
      "wb_create_item" -> "Creating item: #{input["name"] || input["key"]}"
      "wb_create_exit" -> "Exit: #{input["from"]} -> #{input["direction"]} -> #{input["to"]}"
      "wb_delete_room" -> "Deleting room: #{input["key"]}"
      "wb_delete_npc" -> "Deleting NPC: #{input["key"]}"
      "wb_list_rooms" -> "Listing rooms..."
      "wb_list_npcs" -> "Listing NPCs..."
      "wb_list_items" -> "Listing items..."
      "wb_get_room" -> "Reading room: #{input["key"]}"
      "wb_get_npc" -> "Reading NPC: #{input["key"]}"
      "wb_get_entity" -> "Reading entity: #{input["key"]}"
      "wb_query_entities" -> "Querying #{input["type"]} entities..."
      "wb_get_player_state" -> "Reading player state..."
      _ -> name
    end
  end
end
