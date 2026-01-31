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
  - `bardo: reincarnate` - `%{"action" => "reincarnate"}` - Respawn after death

  ### Text Commands (MUD-style)
  - `command` - `%{"text" => "look"}` - Parse and execute text command

  ## Events Pushed to Client

  ### State Updates
  - `game_state` - Full game state on join
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

  ### Bardo (Death)
  - `bardo_enter` - Player entered death realm
  - `bardo_message` - Dream/vision message during death
  - `bardo_ready` - Player can now reincarnate
  - `bardo_exit` - Player respawned

  ### Notifications
  - `event` - Game event (combat result, chat message, rewards, etc.)
  - `output` - Text output for MUD clients (room descriptions, etc.)
  - `quest_update` - Quest progress changed
  """
  use Phoenix.Channel

  require Logger

  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.{Inventory, Equipment, Quest, Spark}
  alias Loka.Framework.World.{Atmosphere, Calendar}
  alias Loka.Framework.Resources.ResourcePool
  alias Loka.Session
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers
  alias LokaWeb.Channels.GameChannel.ActionBridge
  alias LokaWeb.Channels.VersionCompatibility

  # =============================================================================
  # Configuration Constants
  # =============================================================================

  # NOTE: Bardo and social configuration moved to Loka.Game.Actions.Bardo and Loka.Game.Actions.Social

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

    # Get or create player game state
    case PlayerGameState.get_or_create_state(player.id) do
      {:ok, game_state} ->
        if PlayerGameState.character_created?(game_state) do
          send(self(), :after_join)
          {:ok, assign(socket, :game_state, game_state)}
        else
          # Auto-create character for mobile guests who have a name
          case auto_create_character_if_guest(player, game_state) do
            {:ok, updated_state} ->
              send(self(), :after_join)
              {:ok, assign(socket, :game_state, updated_state)}

            {:error, :no_name} ->
              Logger.warning(
                "Character creation failed: player has no name (player_id=#{player.id})"
              )

              {:error, %{reason: "character_not_created", detail: "no_name"}}

            {:error, :name_taken} ->
              Logger.warning(
                "Character creation failed: name already taken (player_id=#{player.id})"
              )

              {:error,
               %{
                 reason: "character_not_created",
                 detail: "name_taken",
                 message: "That character name is already taken. Please choose a different name."
               }}

            {:error, %Ecto.Changeset{} = changeset} ->
              errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)

              Logger.warning(
                "Character creation failed: #{inspect(errors)} (player_id=#{player.id})"
              )

              {:error,
               %{reason: "character_not_created", detail: "validation_failed", errors: errors}}

            {:error, reason} ->
              Logger.warning(
                "Character creation failed: #{inspect(reason)} (player_id=#{player.id})"
              )

              {:error, %{reason: "character_not_created", detail: inspect(reason)}}
          end
        end

      {:error, reason} ->
        {:error, %{reason: inspect(reason)}}
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
  defp auto_create_character_if_guest(player, game_state) do
    if player.name && player.name != "" do
      character_name = sanitize_character_name(player.name)

      if Application.get_env(:loka, :env) == :dev do
        # DEV MODE: Directly update character_name, bypassing uniqueness check
        # This allows quick dev testing without worrying about name conflicts
        dev_create_character(game_state, character_name)
      else
        # PROD MODE: Use proper validation
        prod_create_character(game_state, character_name)
      end
    else
      {:error, :no_name}
    end
  end

  # Dev mode: directly set character, find unique name if needed
  defp dev_create_character(game_state, base_name) do
    # Try the base name first, then append numbers if taken
    name = find_available_dev_name(base_name, 0)

    # Direct update bypassing some validation for dev convenience
    case game_state
         |> Ecto.Changeset.change(%{
           character_name: name,
           gender: "they/them",
           background: "pilgrim"
         })
         |> Loka.Repo.update() do
      {:ok, state} ->
        Logger.info("Dev mode: Created character '#{name}' for player #{game_state.player_id}")
        {:ok, state}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  # Find an available name by appending numbers
  defp find_available_dev_name(base_name, attempt) when attempt > 99 do
    # Give up after 99 attempts
    base_name <> Integer.to_string(:rand.uniform(9999))
  end

  defp find_available_dev_name(base_name, attempt) do
    import Ecto.Query

    name = if attempt == 0, do: base_name, else: "#{base_name}#{attempt}"

    exists? =
      Loka.Repo.exists?(
        from g in PlayerGameState,
          where: fragment("lower(?)", g.character_name) == ^String.downcase(name)
      )

    if exists? do
      find_available_dev_name(base_name, attempt + 1)
    else
      name
    end
  end

  # Prod mode: proper validation with clear error messages
  defp prod_create_character(game_state, character_name) do
    attrs = %{
      character_name: character_name,
      gender: "they/them",
      background: "pilgrim"
    }

    changeset = PlayerGameState.character_creation_changeset(game_state, attrs)

    case Loka.Repo.update(changeset) do
      {:ok, state} ->
        {:ok, state}

      {:error, %Ecto.Changeset{} = changeset} ->
        if name_taken_error?(changeset) do
          {:error, :name_taken}
        else
          {:error, changeset}
        end
    end
  end

  defp name_taken_error?(changeset) do
    Enum.any?(changeset.errors, fn
      {:character_name, {msg, _}} -> String.contains?(msg, "taken")
      _ -> false
    end)
  end

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
  # Character Creation
  # =============================================================================

  @impl true
  def handle_in("create_character", params, socket) do
    game_state = socket.assigns.game_state

    # Extract character data from params
    attrs = %{
      character_name: sanitize_character_name(Map.get(params, "name", game_state.player.name)),
      gender: Map.get(params, "gender", "they/them"),
      background: Map.get(params, "background", "pilgrim")
    }

    # Extract stats allocations if provided
    stats = Map.get(params, "stats", %{})

    changeset = PlayerGameState.character_creation_changeset(game_state, attrs)

    case Loka.Repo.update(changeset) do
      {:ok, updated_state} ->
        # Apply initial stat allocations if provided
        final_state =
          if map_size(stats) > 0 do
            apply_initial_stats(updated_state, stats)
          else
            updated_state
          end

        Logger.info("[GameChannel] Character created: #{attrs.character_name}")

        # Update socket and push success response
        socket = assign(socket, :game_state, final_state)

        push(socket, "character_created", %{
          success: true,
          character_name: final_state.character_name
        })

        {:reply, {:ok, %{character_name: final_state.character_name}}, socket}

      {:error, changeset} ->
        error_msg =
          if name_taken_error?(changeset) do
            "That name is already taken"
          else
            "Failed to create character"
          end

        {:reply, {:error, %{reason: error_msg}}, socket}
    end
  end

  # Apply initial stat allocations from character creation
  defp apply_initial_stats(game_state, stats) do
    # Stats map: %{"strength" => 2, "agility" => 1, ...}
    # Apply to game_state.stats
    current_stats = game_state.stats || %{}
    updated_stats = Map.merge(current_stats, stats)

    case Ecto.Changeset.change(game_state, %{stats: updated_stats}) |> Loka.Repo.update() do
      {:ok, state} -> state
      {:error, _} -> game_state
    end
  end

  # =============================================================================
  # Navigation
  # =============================================================================

  @impl true
  def handle_in("navigate", %{"direction" => direction}, socket) do
    case ActionBridge.execute(socket, :navigate, %{direction: direction}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Entity Interactions
  # =============================================================================

  def handle_in("click_entity", %{"id" => id, "type" => type}, socket) do
    case ActionBridge.execute(socket, :click_entity, %{entity_id: id, entity_type: type}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # Mobile app sends entity_id without type - auto-detect from room contents
  def handle_in("click_entity", %{"entity_id" => entity_id}, socket) do
    case ActionBridge.execute(socket, :click_entity, %{entity_id: entity_id, entity_type: "auto"}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("action", %{"action" => "talk", "entity_id" => entity_id}, socket) do
    case ActionBridge.execute(socket, :talk, %{entity_id: entity_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
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
      case ActionBridge.execute(socket, :attack, %{entity_id: entity_id, entity: entity}) do
        {:ok, socket} -> {:reply, :ok, socket}
        {:error, _reason, socket} -> {:reply, :ok, socket}
      end
    else
      push(socket, "event", %{text: "You don't see that here."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("combat_action", %{"action" => "flee"}, socket) do
    case ActionBridge.execute(socket, :flee, %{}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Inventory - Item Pickup/Drop/Equip
  # =============================================================================

  def handle_in("action", %{"action" => "get", "entity_id" => entity_id}, socket) do
    case ActionBridge.execute(socket, :get_item, %{entity_id: entity_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("inventory", %{"action" => "drop", "item_id" => item_id}, socket) do
    case ActionBridge.execute(socket, :drop_item, %{item_id: item_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("inventory", %{"action" => "equip", "item_id" => item_id}, socket) do
    case ActionBridge.execute(socket, :equip_item, %{item_id: item_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("inventory", %{"action" => "unequip", "slot" => slot}, socket) do
    case ActionBridge.execute(socket, :unequip_item, %{slot: slot}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Shop
  # =============================================================================

  def handle_in("action", %{"action" => "shop", "entity_id" => entity_id}, socket) do
    room = socket.assigns.room
    entity = find_entity(room, entity_id, "npc")

    if entity do
      case ActionBridge.execute(socket, :open_shop, %{entity_id: entity_id, entity: entity}) do
        {:ok, socket} -> {:reply, :ok, socket}
        {:error, _reason, socket} -> {:reply, :ok, socket}
      end
    else
      push(socket, "event", %{text: "You don't see a merchant here."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("shop", %{"action" => "buy", "item_key" => item_key, "npc_id" => npc_id}, socket) do
    room = socket.assigns.room
    npc = find_entity(room, npc_id, "npc")

    if npc do
      case ActionBridge.execute(socket, :buy_item, %{
             npc_id: npc_id,
             item_key: item_key,
             npc_entity: npc
           }) do
        {:ok, socket} -> {:reply, :ok, socket}
        {:error, _reason, socket} -> {:reply, :ok, socket}
      end
    else
      push(socket, "event", %{text: "You're not at a shop."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("shop", %{"action" => "sell", "item_id" => item_id, "npc_id" => npc_id}, socket) do
    room = socket.assigns.room
    npc = find_entity(room, npc_id, "npc")

    if npc do
      case ActionBridge.execute(socket, :sell_item, %{
             npc_id: npc_id,
             item_id: item_id,
             npc_entity: npc
           }) do
        {:ok, socket} -> {:reply, :ok, socket}
        {:error, _reason, socket} -> {:reply, :ok, socket}
      end
    else
      push(socket, "event", %{text: "You're not at a shop."})
      {:reply, :ok, socket}
    end
  end

  def handle_in("shop", %{"action" => "close"}, socket) do
    case ActionBridge.execute(socket, :close_shop, %{}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Containers
  # =============================================================================

  def handle_in("action", %{"action" => "open", "entity_id" => entity_id}, socket) do
    case ActionBridge.execute(socket, :open_container, %{entity_id: entity_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("container", %{"action" => "take", "index" => index}, socket) do
    case ActionBridge.execute(socket, :take_from_container, %{index: index}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("container", %{"action" => "close"}, socket) do
    case ActionBridge.execute(socket, :close_container, %{}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Gathering
  # =============================================================================

  def handle_in("gather", %{"node_type" => node_type}, socket) do
    case ActionBridge.execute(socket, :gather, %{node_type: node_type}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Crafting
  # =============================================================================

  def handle_in("craft", %{"recipe_key" => recipe_key, "tool_id" => tool_id}, socket) do
    case ActionBridge.execute(socket, :craft, %{recipe_key: recipe_key, tool_id: tool_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Emotes
  # =============================================================================

  # Targeted emote - more specific pattern must come first
  def handle_in("emote", %{"emote_key" => emote_key, "target_id" => target_id}, socket) do
    case ActionBridge.execute(socket, :emote, %{emote_key: emote_key, target_id: target_id}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # No-target emote
  def handle_in("emote", %{"emote_key" => emote_key}, socket) do
    case ActionBridge.execute(socket, :emote, %{emote_key: emote_key}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Social (Mood/Pose)
  # =============================================================================

  def handle_in("social", %{"action" => "set_mood", "mood" => mood_str}, socket) do
    case ActionBridge.execute(socket, :set_mood, %{mood: mood_str}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("social", %{"action" => "set_pose", "pose" => pose_text}, socket) do
    case ActionBridge.execute(socket, :set_pose, %{pose: pose_text}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Bardo (Death/Reincarnation)
  # =============================================================================

  def handle_in("bardo", %{"action" => "reincarnate"}, socket) do
    bardo = socket.assigns[:bardo]

    case ActionBridge.execute(socket, :reincarnate, %{bardo: bardo}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # =============================================================================
  # Chat
  # =============================================================================

  def handle_in("chat", %{"mode" => "say", "message" => message}, socket) do
    player = socket.assigns.player
    room = socket.assigns.room
    player_name = player_display_name(player)

    # Broadcast to room
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "room:#{room.id}",
      {:player_says, player.id, player_name, message}
    )

    # Echo back to sender
    push(socket, "event", %{text: "You say, \"#{message}\""})

    {:reply, :ok, socket}
  end

  def handle_in("chat", %{"mode" => "shout", "message" => message}, socket) do
    player = socket.assigns.player
    room = socket.assigns.room
    player_name = player_display_name(player)

    # Broadcast to current room and adjacent rooms
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "room:#{room.id}",
      {:player_shouts, player.id, player_name, message}
    )

    # TODO: Broadcast to adjacent rooms

    push(socket, "event", %{text: "You shout, \"#{message}\""})

    {:reply, :ok, socket}
  end

  # =============================================================================
  # Spark Companion
  # =============================================================================

  def handle_in("spark", %{"action" => "status"}, socket) do
    case ActionBridge.execute(socket, :spark_status, %{}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("spark", %{"action" => "updates"}, socket) do
    case ActionBridge.execute(socket, :spark_updates, %{}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("spark", %{"action" => "dismiss"}, socket) do
    case ActionBridge.execute(socket, :spark_dismiss_updates, %{}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  def handle_in("spark", %{"action" => "ask", "question" => question}, socket) do
    case ActionBridge.execute(socket, :spark_ask, %{question: question}) do
      {:ok, socket} -> {:reply, :ok, socket}
      {:error, _reason, socket} -> {:reply, :ok, socket}
    end
  end

  # Catch-all for unhandled events - log instead of crashing
  def handle_in(event, payload, socket) do
    Logger.warning(
      "Unhandled channel event: #{event} with payload: #{inspect(payload, limit: 200)}"
    )

    {:reply, {:error, %{reason: "unknown_event", event: event}}, socket}
  end

  # =============================================================================
  # PubSub Handlers
  # =============================================================================

  @impl true
  def handle_info(:after_join, socket) do
    player = socket.assigns.player
    game_state = socket.assigns.game_state

    # Load room
    {room, game_state} = RoomHelpers.load_player_room(game_state)

    # Subscribe to PubSub topics
    Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room.id}")
    Phoenix.PubSub.subscribe(Loka.PubSub, "player:#{player.id}")
    Phoenix.PubSub.subscribe(Loka.PubSub, "world:atmosphere")
    Phoenix.PubSub.subscribe(Loka.PubSub, "debug:screenshot")

    # Initialize resource pools
    stats = game_state.stats || %{}
    ResourcePool.init_pools(player.id, stats)

    # Register with session system
    {:ok, _session_pid, session_id} = Session.connect(player, :mobile, self())
    Logger.metadata(session_id: session_id, player_id: player.id)
    Session.update_room(player.id, room.id)

    # Broadcast player entered
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "room:#{room.id}",
      {:player_entered, player.id, player_display_name(player)}
    )

    # Load game data
    inventory_items = Inventory.list_items(game_state)
    equipped_items = Equipment.get_equipped(game_state)
    active_quests = Quest.get_active_quests(game_state)
    other_players = RoomHelpers.load_other_players(room.id, player.id)
    atmosphere = Atmosphere.describe_for_room(room)
    resources = ResourcePool.get(player.id)
    active_timers = Loka.Timers.get_active(player.id)
    calendar_time = Calendar.get_time()

    # Get visual state for environmental effects
    visual_state = Serializers.serialize_visual_state(room: room, player: game_state)

    # Get sound state for ambient audio
    sound_state = Serializers.serialize_sound_state(room: room, player: game_state)

    # Get Spark companion data
    spark_data = Spark.to_client_format(player.id)

    # Send full game state to client (including server capabilities for version negotiation)
    push(socket, "game_state", %{
      room: Serializers.serialize_room(room),
      atmosphere: atmosphere,
      calendar: Serializers.serialize_calendar(calendar_time),
      visual_state: visual_state,
      sound_state: sound_state,
      other_players: Serializers.serialize_players(other_players),
      inventory: Serializers.serialize_inventory(inventory_items),
      equipped: Serializers.serialize_equipped(equipped_items),
      quests: Serializers.serialize_quests(active_quests),
      stats: game_state.stats || %{},
      # Health is now in resources.health - use unified accessor
      health: PlayerGameState.get_health(game_state),
      resources: Serializers.serialize_resources(resources),
      timers: Serializers.serialize_timers(active_timers),
      spark: spark_data,
      player: %{
        id: player.id,
        name: player_display_name(player)
      },
      # Server capabilities for version negotiation
      server: VersionCompatibility.server_capabilities()
    })

    # Deliver any timers that completed while offline
    deliver_offline_timers(socket, player.id)

    # Deliver Spark updates if player has a Spark with pending updates
    deliver_spark_greeting(socket, player.id)

    socket =
      socket
      |> assign(:game_state, game_state)
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
    game_state = socket.assigns.game_state
    atmosphere = Atmosphere.describe_for_room(room)
    calendar_time = Calendar.get_time()
    visual_state = Serializers.serialize_visual_state(room: room, player: game_state)
    sound_state = Serializers.serialize_sound_state(room: room, player: game_state)

    push(socket, "atmosphere_update", %{
      atmosphere: atmosphere,
      calendar: Serializers.serialize_calendar(calendar_time),
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
      push(socket, "event", %{text: text})
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
  # Bardo Handlers
  # =============================================================================

  def handle_info({:enter_bardo, killer_name}, socket) do
    case ActionBridge.execute(socket, :enter_bardo, %{killer_name: killer_name}) do
      {:ok, socket} -> {:noreply, socket}
      {:error, _reason, socket} -> {:noreply, socket}
    end
  end

  def handle_info(:bardo_timer_complete, socket) do
    alias Loka.Game.Actions.Bardo, as: BardoActions
    bardo = socket.assigns[:bardo]

    if bardo && bardo.active do
      push(socket, "event", %{text: "The path back to the living opens before you..."})
      push(socket, "bardo_can_reincarnate", %{})

      socket = assign(socket, :bardo, BardoActions.mark_can_reincarnate(bardo))
      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  def handle_info(:bardo_next_message, socket) do
    alias Loka.Game.Actions.Bardo, as: BardoActions
    bardo = socket.assigns[:bardo]

    if bardo && bardo.active do
      case BardoActions.next_message(bardo) do
        {:ok, message, new_bardo, has_more} ->
          push(socket, "event", %{text: message})

          if has_more do
            Process.send_after(self(), :bardo_next_message, BardoActions.message_interval_ms())
          end

          {:noreply, assign(socket, :bardo, new_bardo)}

        :done ->
          {:noreply, socket}
      end
    else
      {:noreply, socket}
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
    room = socket.assigns[:room]

    if player && room && room.id do
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "room:#{room.id}",
        {:player_left, player.id, player_display_name(player), "away"}
      )

      ResourcePool.clear(player.id)
    end

    :ok
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  # NOTE: Navigation, inventory, equipment logic moved to Loka.Game.Actions
  # GameChannel now uses ActionBridge.execute/3 for these actions

  defp find_entity(room, id, "npc") do
    Enum.find(room.entities, fn e -> e.id == id end)
  end

  defp find_entity(room, id, "item") do
    Enum.find(room.items, fn i -> i.id == id end)
  end

  defp find_entity(_room, _id, _type), do: nil

  defp player_display_name(player) do
    case PlayerGameState.get_state(player.id) do
      %PlayerGameState{character_name: name} when not is_nil(name) -> name
      _ -> player.name || player.email || "Unknown"
    end
  end

  # NOTE: Bardo, Shop, Container, Gathering/Crafting, and Emote/Social helpers
  # moved to Loka.Game.Actions.* modules

  # Deliver completed timers that occurred while player was offline
  defp deliver_offline_timers(socket, player_id) do
    completed_timers = Loka.Timers.get_completed_undelivered(player_id)

    if length(completed_timers) > 0 do
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

  # Deliver Spark greeting on login with pending update count
  defp deliver_spark_greeting(socket, player_id) do
    case Spark.get(player_id) do
      nil ->
        # No Spark yet - they haven't completed character creation with Spark
        :ok

      spark ->
        pending_count = Spark.count_pending_updates(player_id)
        name = spark.revealed_name || "Your Spark"

        greeting =
          cond do
            pending_count > 0 ->
              "#{name} pulses warmly. *You sense it has #{pending_count} things to share.*"

            true ->
              "#{name} glows softly in greeting."
          end

        push(socket, "event", %{text: greeting})

        # If there are pending updates, also push the spark_updates event
        if pending_count > 0 do
          push(socket, "spark_has_updates", %{count: pending_count})
        end
    end
  end
end
