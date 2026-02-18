defmodule LokaWeb.GameChannel do
  @moduledoc """
  Phoenix Channel for game clients (web text MUD and mobile touch UI).

  This channel serves as the primary transport for all game interactions,
  supporting both structured mobile events and text-based MUD commands.

  ## Client Types

  - **Web (text)**: Sends `command` events with raw text input (e.g., "north", "look monk")
  - **Mobile (touch)**: Sends structured events (e.g., `navigate`, `click_entity`)

  Both receive the same events back and render appropriately.

  ## Events Received from Client

  ### Navigation & Room
  - `navigate` - `%{"direction" => "north"}` - Move in a direction
  - `click_entity` - `%{"entity_id" => id}` - Interact with room entity (opens context menu)

  ### Combat
  - `action: attack` - `%{"action" => "attack", "entity_id" => id}` - Start combat with entity
  - `combat_action: flee` - `%{"action" => "flee"}` - Attempt to flee from combat

  ### Inventory
  - `action: get` - `%{"action" => "get", "entity_id" => id}` - Pick up item from room
  - `inventory: drop` - `%{"action" => "drop", "item_id" => id}` - Drop item in room
  - `inventory: equip` - `%{"action" => "equip", "item_id" => id}` - Equip item
  - `inventory: unequip` - `%{"action" => "unequip", "slot" => slot}` - Unequip from slot
  - `use_item` - `%{"item_id" => id}` - Use consumable item

  ### Shop
  - `action: shop` - `%{"action" => "shop", "entity_id" => id}` - Open shop with merchant
  - `shop: buy` - `%{"action" => "buy", "item_key" => key, "npc_id" => id}` - Purchase item
  - `shop: sell` - `%{"action" => "sell", "item_id" => id, "npc_id" => id}` - Sell item
  - `shop: close` - `%{"action" => "close"}` - Close shop interface

  ### Containers
  - `action: open` - `%{"action" => "open", "entity_id" => id}` - Open container
  - `container: take` - `%{"action" => "take", "index" => idx}` - Take item from container
  - `container: close` - `%{"action" => "close"}` - Close container

  ### Gathering & Crafting
  - `gather` - `%{"node_type" => type}` - Gather from resource node
  - `craft` - `%{"recipe_key" => key, "tool_id" => id}` - Craft item from recipe

  ### Dialogue
  - `action: talk` - `%{"action" => "talk", "entity_id" => id}` - Start dialogue with NPC
  - `dialogue_choice` - `%{"choice_index" => idx}` - Select dialogue option

  ### Social
  - `emote` - `%{"emote_key" => key}` - Perform emote (no target)
  - `emote` - `%{"emote_key" => key, "target_id" => id}` - Perform emote at target
  - `social: set_mood` - `%{"action" => "set_mood", "mood" => mood}` - Set character mood
  - `social: set_pose` - `%{"action" => "set_pose", "pose" => text}` - Set character pose

  ### Chat
  - `say` - `%{"message" => text}` - Say to room
  - `shout` - `%{"message" => text}` - Shout to adjacent rooms
  - `yell` - `%{"message" => text}` - Yell to wider area

  ### Death & Respawn
  - `resurrect` - `%{"method" => "shrine"|"healer"}` - Resurrect from ghost state

  ### Text Commands (MUD-style)
  - `command` - `%{"text" => "look"}` - Parse and execute text command

  ## Events Pushed to Client

  ### State Updates
  - `game_state` - Full game state on join (character entity + room + quests + inventory)
  - `room_update` - Room changed (navigation, entity changes)
  - `inventory_update` - Inventory contents changed
  - `stats_update` - Player stats changed

  ### Combat
  - `combat_start` - Combat initiated with enemy data
  - `combat_update` - Combat state changed (HP, effects)
  - `combat_end` - Combat finished (victory/defeat/fled)

  ### Dialogue
  - `dialogue_start` - NPC dialogue started
  - `dialogue_update` - New dialogue node with choices
  - `dialogue_end` - Dialogue finished

  ### Shop & Container
  - `shop_open` - Shop interface opened with items/prices
  - `shop_close` - Shop interface closed
  - `container_open` - Container contents displayed
  - `container_close` - Container interface closed

  ### Ghost (Death)
  - `ghost_enter` - Player died and became a ghost
  - `ghost_exit` - Player resurrected from ghost state

  ### Notifications
  - `event` - Game event (combat result, chat message, rewards, etc.)
  - `output` - Text output for MUD clients (room descriptions, etc.)
  - `quest_update` - Quest progress changed
  """
  use Phoenix.Channel

  require Logger

  alias Loka.Framework.{Inventory, Equipment, Quest}
  alias Loka.Framework.World.Atmosphere
  alias Loka.Components.ResourcePools
  alias Loka.Engine.{Entities, Entity, EntityRegistry}
  alias Loka.Session
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers
  alias LokaWeb.Channels.GameChannel.ActionBridge
  alias LokaWeb.Channels.VersionCompatibility
  alias LokaWeb.Channels.ChannelRateLimiter
  alias LokaWeb.Channels.CommandParser
  alias LokaWeb.Channels.BuilderCommands
  alias LokaWeb.Channels.BuilderCommands.AI, as: BuilderAI

  # =============================================================================
  # Configuration Constants
  # =============================================================================

  # NOTE: Death and social configuration moved to Loka.Game.Actions.Death and Loka.Game.Actions.Social

  # =============================================================================
  # Channel Callbacks
  # =============================================================================

  @impl true
  def join("game:lobby", params, socket) do
    player = socket.assigns.player

    # Validate client version (if provided)
    socket =
      case VersionCompatibility.validate_client(params) do
        {:ok, version_info} ->
          Logger.info("Client connected with version #{inspect(version_info.client_version)}")
          assign(socket, :client_version, version_info)

        {:error, :update_required, info} ->
          # Reject outdated clients
          throw({:error, %{reason: "update_required", min_version: info.min_version}})

        {:error, :version_missing} ->
          # Allow legacy clients without version (for backwards compatibility)
          # Log for monitoring - can make this stricter later
          Logger.debug("Client connected without version info")
          assign(socket, :client_version, nil)
      end

    # V2: Look up character entity by account_id
    case find_or_create_character(player) do
      {:ok, character} ->
        # Start character's EntityServer
        EntityRegistry.get_or_start(character.id)
        Entities.add_tag(character.id, "online")

        send(self(), :after_join)

        {:ok, assign(socket, :character, character)}

      {:error, :no_name} ->
        Logger.warning("Character creation failed: player has no name (player_id=#{player.id})")

        {:error, %{reason: "character_not_created", detail: "no_name"}}

      {:error, :name_taken} ->
        Logger.warning("Character creation failed: name already taken (player_id=#{player.id})")

        {:error,
         %{
           reason: "character_not_created",
           detail: "name_taken",
           message: "That character name is already taken. Please choose a different name."
         }}

      {:error, reason} ->
        Logger.warning("Character creation failed: #{inspect(reason)} (player_id=#{player.id})")

        {:error, %{reason: "character_not_created", detail: inspect(reason)}}
    end
  catch
    {:error, error_map} -> {:error, error_map}
  end

  def join("game:" <> _other, _params, _socket) do
    {:error, %{reason: "invalid_topic"}}
  end

  # Auto-create a character for mobile guests who have a name but no character
  # In dev mode: directly set character name (skip validation for quick testing)
  # In prod mode: use proper validation
  # Sanitize name to only allow letters (character name validation)
  defp sanitize_character_name(name) do
    name
    |> String.replace(~r/[^A-Za-z]/, "")
    |> String.slice(0, 20)
    |> case do
      "" -> "Traveler"
      sanitized -> sanitized
    end
  end

  # =============================================================================
  # V2 Character Entity Helpers
  # =============================================================================

  # Find existing character entity or auto-create one
  defp find_or_create_character(player) do
    case Entities.find_one(account_id: player.id) do
      {:ok, character} ->
        {:ok, character}

      {:error, :not_found} ->
        auto_create_character_entity(player)
    end
  end

  # Auto-create a character entity for a new player
  defp auto_create_character_entity(player) do
    base_name =
      player.name || (player.email && player.email |> String.split("@") |> hd()) || "Traveler"

    character_name = sanitize_character_name(base_name)

    # Find unique name
    name = find_available_name(character_name, 0)

    starting_room_id = Loka.Framework.World.Room.get_starting_room_id()

    entity =
      Entity.new(
        type: :character,
        key: "player_#{String.downcase(name)}",
        short_desc: name,
        account_id: player.id,
        location_id: starting_room_id,
        components: %{
          "player" => %{
            "settings" => %{},
            "gender" => "they/them",
            "background" => "pilgrim"
          },
          "combatant" => %{"health" => 100, "max_health" => 100},
          "stats" => %{},
          "quest_progress" => %{},
          "resources" => %{"health" => %{"current" => 100, "max" => 100}},
          "skills" => %{},
          "equipment" => %{},
          "inventory" => [],
          "flags" => %{}
        },
        tags: ["playable"],
        keywords: [String.downcase(name)]
      )

    case Entities.save(entity) do
      {:ok, saved} ->
        Entities.add_tag(saved.id, "playable")
        Logger.info("[GameChannel] Auto-created character '#{name}' for player #{player.id}")
        {:ok, %{saved | tags: ["playable"]}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Find an available character name by appending numbers if taken
  defp find_available_name(base_name, attempt) when attempt > 99 do
    base_name <> Integer.to_string(:rand.uniform(9999))
  end

  defp find_available_name(base_name, attempt) do
    import Ecto.Query

    name = if attempt == 0, do: base_name, else: "#{base_name}#{attempt}"
    key = "player_#{String.downcase(name)}"

    exists? =
      Loka.Repo.exists?(
        from e in Loka.Engine.Schema.EntitySchema,
          where: e.key == ^key and e.type == :character
      )

    if exists? do
      find_available_name(base_name, attempt + 1)
    else
      name
    end
  end

  # =============================================================================
  # Character Creation
  # =============================================================================

  @impl true
  def handle_in("create_character", params, socket) do
    player = socket.assigns.player
    character = socket.assigns.character

    # Extract character data from params
    character_name = sanitize_character_name(Map.get(params, "name", player.name))
    gender = Map.get(params, "gender", "they/them")
    background = Map.get(params, "background", "pilgrim")
    stats = Map.get(params, "stats", %{})

    # Update character entity with creation data
    player_component = Entity.get_component(character, "player") || %{}

    updated_character =
      character
      |> Map.put(:short_desc, character_name)
      |> Map.put(:key, "player_#{String.downcase(character_name)}")
      |> Map.put(:keywords, [String.downcase(character_name)])
      |> Entity.add_component(
        "player",
        Map.merge(player_component, %{
          "gender" => gender,
          "background" => background
        })
      )

    # Apply stats if provided
    updated_character =
      if map_size(stats) > 0 do
        current_stats = Entity.get_component(updated_character, "stats") || %{}
        Entity.add_component(updated_character, "stats", Map.merge(current_stats, stats))
      else
        updated_character
      end

    case Entities.save(updated_character) do
      {:ok, saved} ->
        Logger.info("[GameChannel] Character created: #{character_name}")
        socket = assign(socket, :character, saved)

        push(socket, "character_created", %{
          success: true,
          character_name: character_name
        })

        {:reply, {:ok, %{character_name: character_name}}, socket}

      {:error, _reason} ->
        {:reply, {:error, %{reason: "Failed to create character"}}, socket}
    end
  end

  # =============================================================================
  # Navigation
  # =============================================================================

  @impl true
  def handle_in("navigate", %{"direction" => direction}, socket) do
    with_rate_limit(socket, fn ->
      dispatch_action(socket, :navigate, %{direction: direction})
    end)
  end

  # =============================================================================
  # Entity Interactions
  # =============================================================================

  def handle_in("click_entity", %{"id" => id, "type" => type}, socket) do
    dispatch_action(socket, :click_entity, %{entity_id: id, entity_type: type})
  end

  # Mobile app sends entity_id without type - auto-detect from room contents
  def handle_in("click_entity", %{"entity_id" => entity_id}, socket) do
    dispatch_action(socket, :click_entity, %{entity_id: entity_id, entity_type: "auto"})
  end

  def handle_in("action", %{"action" => "talk", "entity_id" => entity_id}, socket) do
    dispatch_action(socket, :talk, %{entity_id: entity_id})
  end

  def handle_in("dialogue_select", %{"choice_index" => choice_index}, socket) do
    case ActionBridge.execute(socket, :dialogue_choice, %{choice_index: choice_index}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, {:error, %{reason: "dialogue_error"}}, socket}
    end
  end

  # NOTE: Dialogue action handlers moved to Loka.Game.Actions.Dialogue

  # =============================================================================
  # Combat
  # =============================================================================

  def handle_in("action", %{"action" => "attack", "entity_id" => entity_id}, socket) do
    room = socket.assigns.room
    entity = find_entity(room, entity_id, "npc")

    if entity do
      dispatch_action(socket, :attack, %{entity_id: entity_id, entity: entity})
    else
      push(socket, "event", %{text: "You don't see that here."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("combat_action", %{"action" => "flee"}, socket) do
    dispatch_action(socket, :flee, %{})
  end

  # =============================================================================
  # Inventory - Item Pickup/Drop/Equip
  # =============================================================================

  def handle_in("action", %{"action" => "get", "entity_id" => entity_id}, socket) do
    dispatch_action(socket, :get_item, %{entity_id: entity_id})
  end

  def handle_in("inventory", %{"action" => "drop", "item_id" => item_id}, socket) do
    dispatch_action(socket, :drop_item, %{item_id: item_id})
  end

  def handle_in("inventory", %{"action" => "equip", "item_id" => item_id}, socket) do
    dispatch_action(socket, :equip_item, %{item_id: item_id})
  end

  def handle_in("inventory", %{"action" => "unequip", "slot" => slot}, socket) do
    dispatch_action(socket, :unequip_item, %{slot: slot})
  end

  # =============================================================================
  # Shop
  # =============================================================================

  def handle_in("action", %{"action" => "shop", "entity_id" => entity_id}, socket) do
    room = socket.assigns.room
    entity = find_entity(room, entity_id, "npc")

    if entity do
      dispatch_action(socket, :open_shop, %{entity_id: entity_id, entity: entity})
    else
      push(socket, "event", %{text: "You don't see a merchant here."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("shop", %{"action" => "buy", "item_key" => item_key, "npc_id" => npc_id}, socket) do
    room = socket.assigns.room
    npc = find_entity(room, npc_id, "npc")

    if npc do
      dispatch_action(socket, :buy_item, %{npc_id: npc_id, item_key: item_key, npc_entity: npc})
    else
      push(socket, "event", %{text: "You're not at a shop."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("shop", %{"action" => "sell", "item_id" => item_id, "npc_id" => npc_id}, socket) do
    room = socket.assigns.room
    npc = find_entity(room, npc_id, "npc")

    if npc do
      dispatch_action(socket, :sell_item, %{npc_id: npc_id, item_id: item_id, npc_entity: npc})
    else
      push(socket, "event", %{text: "You're not at a shop."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("shop", %{"action" => "close"}, socket) do
    dispatch_action(socket, :close_shop, %{})
  end

  # =============================================================================
  # Containers
  # =============================================================================

  def handle_in("action", %{"action" => "open", "entity_id" => entity_id}, socket) do
    dispatch_action(socket, :open_container, %{entity_id: entity_id})
  end

  def handle_in("container", %{"action" => "take", "index" => index}, socket) do
    dispatch_action(socket, :take_from_container, %{index: index})
  end

  def handle_in("container", %{"action" => "close"}, socket) do
    dispatch_action(socket, :close_container, %{})
  end

  # =============================================================================
  # Gathering
  # =============================================================================

  def handle_in("gather", %{"node_type" => node_type}, socket) do
    dispatch_action(socket, :gather, %{node_type: node_type})
  end

  # =============================================================================
  # Crafting
  # =============================================================================

  def handle_in("craft", %{"recipe_key" => recipe_key, "tool_id" => tool_id}, socket) do
    dispatch_action(socket, :craft, %{recipe_key: recipe_key, tool_id: tool_id})
  end

  # =============================================================================
  # Emotes
  # =============================================================================

  # Targeted emote - more specific pattern must come first
  def handle_in("emote", %{"emote_key" => emote_key, "target_id" => target_id}, socket) do
    dispatch_action(socket, :emote, %{emote_key: emote_key, target_id: target_id})
  end

  # No-target emote
  def handle_in("emote", %{"emote_key" => emote_key}, socket) do
    dispatch_action(socket, :emote, %{emote_key: emote_key})
  end

  # =============================================================================
  # Social (Mood/Pose)
  # =============================================================================

  def handle_in("social", %{"action" => "set_mood", "mood" => mood_str}, socket) do
    dispatch_action(socket, :set_mood, %{mood: mood_str})
  end

  def handle_in("social", %{"action" => "set_pose", "pose" => pose_text}, socket) do
    dispatch_action(socket, :set_pose, %{pose: pose_text})
  end

  # =============================================================================
  # Resurrection
  # =============================================================================

  def handle_in("resurrect", %{"method" => method}, socket) do
    method_atom = if method in ["shrine", "healer"], do: String.to_atom(method), else: :shrine

    dispatch_action(socket, :resurrect, %{method: method_atom})
  end

  # =============================================================================
  # Chat
  # =============================================================================

  def handle_in("chat", %{"mode" => "say", "message" => message}, socket) do
    with_rate_limit(socket, fn ->
      player = socket.assigns.player
      room = socket.assigns.room
      player_name = player_display_name(player)
      is_ghost = Loka.Game.Actions.Death.ghost?(socket.assigns.character)

      if is_ghost do
        # Ghosts whisper — broadcast as emote (raw text, no wrapping)
        ghostly = "The ghost of #{player_name} whispers, \"#{message}\""

        Phoenix.PubSub.broadcast(
          Loka.PubSub,
          "location:#{room.id}",
          {:player_emotes, player.id, player_name, ghostly}
        )

        push(socket, "event", %{text: "You whisper, \"#{message}\""})
      else
        Phoenix.PubSub.broadcast(
          Loka.PubSub,
          "location:#{room.id}",
          {:player_says, player.id, player_name, message}
        )

        push(socket, "event", %{text: "You say, \"#{message}\""})
      end

      {:reply, :ok, socket}
    end)
  end

  def handle_in("chat", %{"mode" => "shout", "message" => message}, socket) do
    with_rate_limit(socket, fn ->
      if Loka.Game.Actions.Death.ghost?(socket.assigns.character) do
        push(socket, "event", %{text: "You try to shout, but only a faint moan escapes."})
        {:reply, :ok, socket}
      else
        player = socket.assigns.player
        room = socket.assigns.room
        player_name = player_display_name(player)

        # Broadcast to current room and adjacent rooms
        Phoenix.PubSub.broadcast(
          Loka.PubSub,
          "location:#{room.id}",
          {:player_shouts, player.id, player_name, message}
        )

        # TODO: Broadcast to adjacent rooms

        push(socket, "event", %{text: "You shout, \"#{message}\""})

        {:reply, :ok, socket}
      end
    end)
  end

  def handle_in("spark", %{"action" => "status"}, socket) do
    dispatch_action(socket, :spark_status, %{})
  end

  def handle_in("spark", %{"action" => "updates"}, socket) do
    dispatch_action(socket, :spark_updates, %{})
  end

  def handle_in("spark", %{"action" => "dismiss"}, socket) do
    dispatch_action(socket, :spark_dismiss_updates, %{})
  end

  def handle_in("spark", %{"action" => "ask", "question" => question}, socket) do
    dispatch_action(socket, :spark_ask, %{question: question})
  end

  # =============================================================================
  # Text Command Handler (MUD-style text input)
  # =============================================================================

  def handle_in("command", %{"input" => text}, socket) do
    # In chat mode, route all input to AI (except exit commands)
    if socket.assigns[:chat_mode] && not command_prefix?(text) do
      execute_ai_command(:chat_input, text, socket)
    else
      dispatch_parsed_command(CommandParser.parse(text), socket)
    end
  end

  # Catch-all for unhandled events - log instead of crashing
  def handle_in(event, payload, socket) do
    Logger.warning(
      "Unhandled channel event: #{event} with payload: #{inspect(payload, limit: 200)}"
    )

    {:reply, {:error, %{reason: "unknown_event", event: event}}, socket}
  end

  # Check if text starts with a command prefix (/, or known commands)
  defp command_prefix?(text) do
    trimmed = String.trim(text)
    String.starts_with?(trimmed, "/") || trimmed in ~w(clear help look who)
  end

  defp dispatch_parsed_command(parsed, socket) do
    case parsed do
      # AI commands (admin-gated, separate from builder dispatch)
      {:builder_ai, params} ->
        execute_ai_command(:ai, params, socket)

      {:builder_ai_clear, params} ->
        execute_ai_command(:ai_clear, params, socket)

      {:builder_ai_cancel, params} ->
        execute_ai_command(:ai_cancel, params, socket)

      {:builder_ai_toggle, params} ->
        execute_ai_command(:ai_toggle, params, socket)

      {:builder_exit_chat, params} ->
        execute_ai_command(:exit_chat, params, socket)

      # Spark (available to all players)
      {:spark, _params} ->
        push(socket, "output", %{text: "Spark companion coming soon."})
        {:reply, :ok, socket}

      # Help with topic
      {:help, %{topic: topic}} ->
        execute_builder_command(:help, %{topic: topic}, socket)

      # Clear terminal (client-side operation)
      {:clear, %{}} ->
        push(socket, "clear_terminal", %{})
        {:reply, :ok, socket}

      # Navigation
      {:navigate, %{direction: direction}} ->
        dispatch_action(socket, :navigate, %{direction: direction})

      # Look (re-push current room)
      {:look, %{target: target}} ->
        dispatch_action(socket, :click_entity, %{entity_id: target, entity_type: "auto"})

      {:look, %{}} ->
        push_current_room(socket)
        {:reply, :ok, socket}

      # Talk
      {:talk, %{target: target}} ->
        case find_entity_by_keyword(socket, target) do
          {:ok, entity_id} ->
            dispatch_action(socket, :talk, %{entity_id: entity_id})

          :error ->
            push(socket, "output", %{text: "You don't see '#{target}' here."})
            {:reply, :ok, socket}
        end

      # Inventory
      {:inventory, %{}} ->
        push_inventory(socket)
        {:reply, :ok, socket}

      # Get item
      {:get_item, %{target: target}} ->
        case find_entity_by_keyword(socket, target) do
          {:ok, entity_id} ->
            dispatch_action(socket, :get_item, %{entity_id: entity_id})

          :error ->
            push(socket, "output", %{text: "You don't see '#{target}' here."})
            {:reply, :ok, socket}
        end

      # Drop item
      {:drop_item, %{target: target}} ->
        case find_inventory_item_by_keyword(socket, target) do
          {:ok, item_id} ->
            dispatch_action(socket, :drop_item, %{item_id: item_id})

          :error ->
            push(socket, "output", %{text: "You don't have '#{target}'."})
            {:reply, :ok, socket}
        end

      # Say
      {:say, %{message: message}} ->
        dispatch_action(socket, :chat, %{mode: :say, message: message})

      # Combat
      {:attack, %{target: target}} ->
        case find_entity_by_keyword(socket, target) do
          {:ok, entity_id} ->
            character = socket.assigns.character
            {room, _} = RoomHelpers.load_room_for_character(character)

            entity =
              Enum.find(room.entities || [], fn e ->
                to_string(e.id) == to_string(entity_id)
              end)

            dispatch_action(socket, :attack, %{entity_id: entity_id, entity: entity})

          :error ->
            push(socket, "output", %{text: "You don't see '#{target}' here."})
            {:reply, :ok, socket}
        end

      {:flee, %{}} ->
        dispatch_action(socket, :flee, %{})

      # Equip/Unequip
      {:equip, %{target: target}} ->
        case find_inventory_item_by_keyword(socket, target) do
          {:ok, item_id} ->
            dispatch_action(socket, :equip_item, %{item_id: item_id})

          :error ->
            push(socket, "output", %{text: "You don't have '#{target}'."})
            {:reply, :ok, socket}
        end

      {:unequip, %{target: target}} ->
        dispatch_action(socket, :unequip_item, %{slot: target})

      # Use item (on self or on target)
      {:use_item, %{item: item_keyword} = params} ->
        case find_inventory_item_by_keyword(socket, item_keyword) do
          {:ok, item_id} ->
            target_context =
              case Map.get(params, :target) do
                nil ->
                  %{}

                target_keyword ->
                  case find_entity_by_keyword(socket, target_keyword) do
                    {:ok, target_id} -> %{target_id: target_id}
                    :error -> %{target_keyword: target_keyword}
                  end
              end

            dispatch_action(socket, :use_item, Map.merge(%{item_id: item_id}, target_context))

          :error ->
            push(socket, "output", %{text: "You don't have '#{item_keyword}'."})
            {:reply, :ok, socket}
        end

      # Who
      {:who, %{}} ->
        push_who(socket)
        {:reply, :ok, socket}

      # Help
      {:help, %{}} ->
        push_help(socket)
        {:reply, :ok, socket}

      # Bare integer dialogue choice (player typed "1", "2", etc.)
      {:dialogue_choice, %{choice_index: choice_index}} ->
        dispatch_action(socket, :dialogue_choice, %{choice_index: choice_index})

      # Builder admin commands - dynamic dispatch strips :builder_ prefix
      {cmd, params} when is_atom(cmd) ->
        case strip_builder_prefix(cmd) do
          {:ok, builder_cmd} ->
            execute_builder_command(builder_cmd, params, socket)

          :not_builder ->
            push(socket, "output", %{text: "Unknown command. Type 'help' for commands."})
            {:reply, :ok, socket}
        end
    end
  end

  @builder_prefix "builder_"

  defp strip_builder_prefix(cmd) do
    str = Atom.to_string(cmd)

    if String.starts_with?(str, @builder_prefix) do
      # Use String.to_atom/1 because BuilderCommands may not be loaded yet
      # (lazy module loading), so atoms from its @command lists may not exist.
      # Safety: cmd already comes from CommandParser atoms, not user input.
      {:ok, str |> String.replace_prefix(@builder_prefix, "") |> String.to_atom()}
    else
      :not_builder
    end
  end

  # Silent rejection for non-admin players - identical to unknown command
  defp execute_builder_command(cmd, params, socket) do
    if socket.assigns.player.is_admin do
      BuilderCommands.execute(cmd, params, socket)
    else
      push(socket, "output", %{text: "Unknown command. Type 'help' for commands."})
      {:reply, :ok, socket}
    end
  end

  # AI command execution (admin-gated, except chat_input which checks internally)
  defp execute_ai_command(:chat_input, text, socket) do
    if socket.assigns.player.is_admin do
      try do
        {:ok, socket} = BuilderAI.handle_chat_input(text, socket)
        {:reply, :ok, socket}
      rescue
        e ->
          Logger.error(
            "[BUILDER AI] Chat failed: #{Exception.message(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}"
          )

          push(socket, "output", %{
            text: "[BUILDER] AI command failed. Check server logs for details."
          })

          {:reply, :ok, socket}
      end
    else
      push(socket, "output", %{text: "Unknown command. Type 'help' for commands."})
      {:reply, :ok, socket}
    end
  end

  defp execute_ai_command(cmd, params, socket) do
    if socket.assigns.player.is_admin do
      try do
        {:ok, socket} = BuilderAI.execute(cmd, params, socket)
        {:reply, :ok, socket}
      rescue
        e ->
          Logger.error(
            "[BUILDER AI] Command #{cmd} failed: #{Exception.message(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}"
          )

          push(socket, "output", %{
            text: "[BUILDER] AI command failed. Check server logs for details."
          })

          {:reply, :ok, socket}
      end
    else
      push(socket, "output", %{text: "Unknown command. Type 'help' for commands."})
      {:reply, :ok, socket}
    end
  end

  defp push_current_room(socket) do
    character = socket.assigns.character
    {room, _} = RoomHelpers.load_room_for_character(character)
    atmosphere = Atmosphere.describe_for_room(room)

    push(socket, "room_update", %{
      room: Serializers.serialize_room(room),
      atmosphere: atmosphere
    })
  end

  defp push_inventory(socket) do
    character = socket.assigns.character
    items = Inventory.list_items(character)

    if items == [] do
      push(socket, "output", %{text: "You are carrying nothing."})
    else
      lines =
        Enum.map(items, fn item ->
          name = Map.get(item, :name, Map.get(item, "name", "unknown"))
          "  #{name}"
        end)
        |> Enum.join("\n")

      push(socket, "output", %{text: "Inventory:\n#{lines}"})
    end
  end

  defp push_who(socket) do
    player = socket.assigns.player
    character = socket.assigns.character
    room_id = character.location_id

    players = RoomHelpers.load_other_players(room_id, player.id)

    if players == [] do
      push(socket, "output", %{text: "You are alone here."})
    else
      names = Enum.map(players, fn p -> "  #{p.name}" end) |> Enum.join("\n")
      push(socket, "output", %{text: "Players here:\n#{names}"})
    end
  end

  defp push_help(socket) do
    alias LokaWeb.Channels.BuilderCommands.Help

    text =
      if socket.assigns.player.is_admin do
        Help.full_help()
      else
        """
        Available Commands:
          Movement:   north, south, east, west, up, down (or n,s,e,w,u,d)
          Look:       look, look <target>
          Talk:       talk <npc>
          Inventory:  inventory (or i), get <item>, drop <item>, equip, unequip
          Chat:       say <message>
          Combat:     attack <target>, flee
          Other:      who, help, clear\
        """
      end

    push(socket, "output", %{text: text})
  end

  defp find_entity_by_keyword(socket, keyword) do
    character = socket.assigns.character
    {room, _} = RoomHelpers.load_room_for_character(character)

    keyword_lower = String.downcase(keyword)

    entity =
      (room.entities ++ (room.items || []))
      |> Enum.find(fn e ->
        name = Map.get(e, :name, "") |> to_string() |> String.downcase()
        key = Map.get(e, :key, "") |> to_string() |> String.downcase()
        pk = Map.get(e, :primary_keyword, "") |> to_string() |> String.downcase()

        name == keyword_lower || key == keyword_lower || pk == keyword_lower ||
          String.contains?(name, keyword_lower)
      end)

    case entity do
      nil -> :error
      e -> {:ok, e.id}
    end
  end

  defp find_inventory_item_by_keyword(socket, keyword) do
    character = socket.assigns.character
    items = Inventory.list_items(character)
    keyword_lower = String.downcase(keyword)

    item =
      Enum.find(items, fn item ->
        name = Map.get(item, :name, "") |> to_string() |> String.downcase()
        key = Map.get(item, :key, "") |> to_string() |> String.downcase()
        name == keyword_lower || key == keyword_lower || String.contains?(name, keyword_lower)
      end)

    case item do
      nil -> :error
      i -> {:ok, i.id}
    end
  end

  # =============================================================================
  # PubSub Handlers
  # =============================================================================

  @impl true
  def handle_info(:after_join, socket) do
    player = socket.assigns.player
    character = socket.assigns.character

    # V2: Load room using character entity's location_id
    {room, character} = RoomHelpers.load_room_for_character(character)

    # Subscribe to PubSub topics
    Phoenix.PubSub.subscribe(Loka.PubSub, "location:#{room.id}")
    Phoenix.PubSub.subscribe(Loka.PubSub, "entity:#{player.id}")
    Phoenix.PubSub.subscribe(Loka.PubSub, "world:atmosphere")
    Phoenix.PubSub.subscribe(Loka.PubSub, "debug:screenshot")

    # Initialize resource pools on character entity
    stats = Entity.get_component(character, "stats") || %{}
    resource_pools = ResourcePools.init_pools(stats)
    character = ResourcePools.put(character, resource_pools)

    # Register with session system
    {:ok, _session_pid, session_id} = Session.connect(player, :mobile, self())
    Logger.metadata(session_id: session_id, player_id: player.id)
    Session.update_room(player.id, room.id)

    # Broadcast player entered
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "location:#{room.id}",
      {:player_entered, player.id, player_display_name(player)}
    )

    # Load game data (V2: use character entity)
    inventory_items = Inventory.list_items(character)
    equipped_items = Equipment.get_equipped(character)
    active_quests = Quest.Progress.get_active_quests(character)
    other_players = RoomHelpers.load_other_players(room.id, player.id)
    atmosphere = Atmosphere.describe_for_room(room)
    resources = ResourcePools.get(character)
    active_timers = Loka.Timers.get_active(player.id)

    # Get visual state for environmental effects
    player_compat = %{equipped: Entity.get_component(character, "equipment") || %{}}
    visual_state = Serializers.serialize_visual_state(room: room, player: player_compat)

    # Get sound state for ambient audio
    sound_state = Serializers.serialize_sound_state(room: room, player: player_compat)

    # Send full game state to client (including server capabilities for version negotiation)
    push(socket, "game_state", %{
      room: Serializers.serialize_room(room),
      atmosphere: atmosphere,
      calendar: nil,
      visual_state: visual_state,
      sound_state: sound_state,
      other_players: Serializers.serialize_players(other_players),
      inventory: Serializers.serialize_inventory(inventory_items),
      equipped: Serializers.serialize_equipped(equipped_items),
      quests: Serializers.serialize_quests(active_quests),
      stats: stats,
      # Health from character entity resources component
      health: get_character_health(character),
      resources: Serializers.serialize_resources(resources),
      timers: Serializers.serialize_timers(active_timers),
      spark: nil,
      player: %{
        id: player.id,
        name: player_display_name(player)
      },
      # Server capabilities for version negotiation
      server: VersionCompatibility.server_capabilities()
    })

    # Deliver any timers that completed while offline
    deliver_offline_timers(socket, player.id)

    socket =
      socket
      |> assign(:character, character)
      |> assign(:room, room)
      |> assign(:seen_ambient, MapSet.new())

    {:noreply, socket}
  end

  def handle_info({:player_entered, player_id, player_name}, socket) do
    if player_id != socket.assigns.player.id do
      push(socket, "event", %{text: "#{player_name} arrives."})
      # Refresh other players list
      room = socket.assigns.room
      other_players = RoomHelpers.load_other_players(room.id, socket.assigns.player.id)
      push(socket, "players_update", %{players: Serializers.serialize_players(other_players)})
    end

    {:noreply, socket}
  end

  def handle_info({:player_left, player_id, player_name, direction}, socket) do
    if player_id != socket.assigns.player.id do
      push(socket, "event", %{text: "#{player_name} leaves #{direction}."})
      room = socket.assigns.room
      other_players = RoomHelpers.load_other_players(room.id, socket.assigns.player.id)
      push(socket, "players_update", %{players: Serializers.serialize_players(other_players)})
    end

    {:noreply, socket}
  end

  def handle_info({:player_says, player_id, player_name, message}, socket) do
    if player_id != socket.assigns.player.id do
      push(socket, "event", %{text: "#{player_name} says, \"#{message}\""})
    end

    {:noreply, socket}
  end

  def handle_info({:player_shouts, player_id, player_name, message}, socket) do
    if player_id != socket.assigns.player.id do
      push(socket, "event", %{text: "#{player_name} shouts, \"#{message}\""})
    end

    {:noreply, socket}
  end

  def handle_info({:atmosphere_changed, _}, socket) do
    room = socket.assigns.room
    character = socket.assigns.character
    atmosphere = Atmosphere.describe_for_room(room)
    player_compat = %{equipped: Entity.get_component(character, "equipment") || %{}}
    visual_state = Serializers.serialize_visual_state(room: room, player: player_compat)
    sound_state = Serializers.serialize_sound_state(room: room, player: player_compat)

    push(socket, "atmosphere_update", %{
      atmosphere: atmosphere,
      calendar: nil,
      visual_state: visual_state,
      sound_state: sound_state
    })

    {:noreply, socket}
  end

  # NPC and Room ambient messages (deduplicated per room visit)
  def handle_info({:ambient_message, text}, socket) do
    seen = socket.assigns[:seen_ambient] || MapSet.new()

    if MapSet.member?(seen, text) do
      # Already seen this message in current room, skip it
      {:noreply, socket}
    else
      push(socket, "event", %{text: text, type: "ambient"})
      {:noreply, assign(socket, :seen_ambient, MapSet.put(seen, text))}
    end
  end

  def handle_info({:resources_updated, pools}, socket) do
    push(socket, "resources_update", %{resources: Serializers.serialize_resources(pools)})
    {:noreply, socket}
  end

  def handle_info({:session_message, {:room_message, text}}, socket) do
    push(socket, "event", %{text: text})
    {:noreply, socket}
  end

  def handle_info({:session_message, {:announcement, text}}, socket) do
    push(socket, "event", %{text: "[Announcement] #{text}"})
    {:noreply, socket}
  end

  def handle_info({:session_message, {:force_disconnect, reason}}, socket) do
    push(socket, "force_disconnect", %{reason: reason})
    {:stop, :normal, socket}
  end

  def handle_info({:session_message, {:timer_completed, data}}, socket) do
    push(socket, "timer_completed", data)
    {:noreply, socket}
  end

  def handle_info({:session_message, {:broadcast_message, text, type}}, socket) do
    push(socket, "broadcast", %{text: text, type: Atom.to_string(type)})
    {:noreply, socket}
  end

  # =============================================================================
  # Combat Tick Handler
  # =============================================================================

  def handle_info(:combat_tick, socket) do
    case ActionBridge.execute(socket, :combat_tick, %{}) do
      {:ok, socket} -> {:noreply, socket}
      {:error, _reason, socket} -> {:noreply, socket}
    end
  end

  # =============================================================================
  # Death Handlers
  # =============================================================================

  def handle_info({:die, killer_name}, socket) do
    case ActionBridge.execute(socket, :die, %{killer_name: killer_name}) do
      {:ok, socket} -> {:noreply, socket}
      {:error, _reason, socket} -> {:noreply, socket}
    end
  end

  def handle_info({:player_emotes, player_id, _player_name, text}, socket) do
    if player_id != socket.assigns.player.id do
      push(socket, "event", %{text: text})
    end

    {:noreply, socket}
  end

  def handle_info({:player_emotes_at, player_id, _target_id, _player_name, text}, socket) do
    if player_id != socket.assigns.player.id do
      push(socket, "event", %{text: text})
    end

    {:noreply, socket}
  end

  # Debug screenshot request - forward to client
  def handle_info(:capture_screenshot, socket) do
    Logger.info("[Screenshot] Pushing capture_screenshot event to client")
    push(socket, "capture_screenshot", %{})
    {:noreply, socket}
  end

  # =============================================================================
  # AI Streaming Events (from Loka.AI.Conversation engine)
  # =============================================================================

  def handle_info({:ai_text_delta, _text} = event, socket) do
    BuilderAI.handle_ai_event(event, socket)
  end

  def handle_info({:ai_tool_use_raw, _name, _id, _input} = event, socket) do
    BuilderAI.handle_ai_event(event, socket)
  end

  def handle_info({:ai_done_raw, _response} = event, socket) do
    BuilderAI.handle_ai_event(event, socket)
  end

  def handle_info({:ai_done} = event, socket) do
    BuilderAI.handle_ai_event(event, socket)
  end

  def handle_info({:ai_error, _reason} = event, socket) do
    BuilderAI.handle_ai_event(event, socket)
  end

  def handle_info({:ai_tool_use, _name, _id, _input, _result} = event, socket) do
    BuilderAI.handle_ai_event(event, socket)
  end

  def handle_info(:ai_timeout, socket) do
    BuilderAI.handle_ai_event(:ai_timeout, socket)
  end

  def handle_info(:ai_retry, socket) do
    BuilderAI.handle_ai_retry(socket)
  end

  # Catch-all for unhandled messages
  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  # =============================================================================
  # Terminate
  # =============================================================================

  @impl true
  def terminate(_reason, socket) do
    player = socket.assigns[:player]
    character = socket.assigns[:character]
    room = socket.assigns[:room]

    # V2: Remove "online" tag from character entity
    if character do
      Entities.remove_tag(character.id, "online")
    end

    if player && room && room.id do
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "location:#{room.id}",
        {:player_left, player.id, player_display_name(player), "away"}
      )

      # Resource pools live on the character entity — no separate cleanup needed
    end

    :ok
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  # NOTE: Navigation, inventory, equipment logic moved to Loka.Game.Actions
  # GameChannel now uses ActionBridge.execute/3 for these actions

  defp dispatch_action(socket, action, params) do
    case ActionBridge.execute(socket, action, params) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  defp find_entity(room, id, "npc") do
    Enum.find(room.entities, fn e -> e.id == id end)
  end

  defp find_entity(room, id, "item") do
    Enum.find(room.items, fn i -> i.id == id end)
  end

  defp find_entity(_room, _id, _type), do: nil

  # V2: Extract health from character entity's resources component
  defp get_character_health(character) do
    resources = Entity.get_component(character, "resources") || %{}

    case resources["health"] do
      %{"current" => current, "max" => max} -> %{"current" => current, "max" => max}
      _ -> %{"current" => 100, "max" => 100}
    end
  end

  defp player_display_name(player) when is_map(player) do
    player.name || player.email || "Unknown"
  end

  # Rate limiting wrapper for channel handlers
  defp with_rate_limit(socket, handler_fn) do
    case ChannelRateLimiter.check(socket) do
      :ok ->
        result = handler_fn.()
        update_result_socket_for_rate_limit(result)

      {:error, :rate_limited} ->
        push(socket, "event", %{text: "Slow down! You're sending messages too quickly."})
        {:reply, {:error, %{reason: "rate_limited"}}, socket}
    end
  end

  # Update socket in result tuple to track the message for rate limiting
  defp update_result_socket_for_rate_limit({:reply, reply, socket}) do
    {:reply, reply, ChannelRateLimiter.track(socket)}
  end

  defp update_result_socket_for_rate_limit({:noreply, socket}) do
    {:noreply, ChannelRateLimiter.track(socket)}
  end

  defp update_result_socket_for_rate_limit(other), do: other

  # NOTE: Death, Shop, Container, Gathering/Crafting, and Emote/Social helpers
  # moved to Loka.Game.Actions.* modules

  # Deliver completed timers that occurred while player was offline
  defp deliver_offline_timers(socket, player_id) do
    completed_timers = Loka.Timers.get_completed_undelivered(player_id)

    if completed_timers != [] do
      Enum.each(completed_timers, fn timer ->
        push(socket, "timer_completed", %{
          timer_id: timer.id,
          timer_type: timer.timer_type,
          data: timer.data,
          scheduled_at: timer.scheduled_at,
          completed_at: timer.completed_at
        })
      end)

      Loka.Timers.mark_delivered(completed_timers)
    end
  end
end
