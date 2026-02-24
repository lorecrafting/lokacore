defmodule Loka.Channel.Events do
  @moduledoc """
  Single source of truth for all channel events between server and client.

  ## Overview

  This module defines ALL events that flow through the Phoenix channel:
  - Server → Client events (game state updates, combat, dialogue, etc.)
  - Client → Server events (player actions, navigation, etc.)

  TypeScript types are auto-generated from this file.

  ## Type System

  Simple types:
  - `:string` - String value
  - `:integer` - Integer value
  - `:boolean` - Boolean value
  - `:map` - Any map/object
  - `:list` - Any list/array

  Compound types:
  - `{:optional, type}` - Field may be nil/missing
  - `{:enum, [values]}` - One of the allowed string values
  - `%{key: type}` - Nested object with specific shape

  ## Usage

      # Check if event exists
      Events.server_event?("combat_start")  # true
      Events.client_event?("navigate")       # true

      # Get schema for validation
      Events.get_server_event("combat_start")
      # => %{enemy: %{id: :string, name: :string, ...}}

  ## Generating TypeScript

      mix loka.gen.channel_types

  This generates `mobile/src/types/channel.generated.ts` from these definitions.
  """

  # ===========================================================================
  # Server → Client Events
  # ===========================================================================

  @server_events %{
    # Core events
    "event" => %{
      text: :string,
      type: {:optional, :string}
    },
    "game_state" => %{
      room: :map,
      atmosphere: :string,
      inventory: :list,
      equipped: :map,
      quests: :list,
      stats: :map,
      resources: :map,
      health: %{current: :integer, max: :integer},
      other_players: :list,
      server: {:optional, :map}
    },

    # Room events
    "room_update" => %{
      room: :map,
      atmosphere: :string,
      other_players: :list,
      visual_state: {:optional, :map},
      sound_state: {:optional, :map}
    },
    "atmosphere_update" => %{
      atmosphere: :string,
      calendar: {:optional, :map},
      visual_state: {:optional, :map},
      sound_state: {:optional, :map}
    },
    "players_update" => %{
      players: :list
    },

    # Entity context
    "entity_context" => %{
      entity: :map
    },

    # Combat events
    "combat_start" => %{
      enemy: %{
        id: :string,
        name: :string,
        health: %{current: :integer, max: :integer}
      },
      pvp: {:optional, :boolean}
    },
    "combat_update" => %{
      player_health: {:optional, %{current: :integer, max: :integer}},
      enemy_health: {:optional, %{current: :integer, max: :integer}},
      can_flee: {:optional, :boolean}
    },
    "combat_end" => %{
      result: {:optional, {:enum, ["victory", "defeat", "fled"]}},
      reason: {:optional, :string},
      rewards: {:optional, :map}
    },

    # Dialogue events
    "dialogue_start" => %{
      entity_id: :string,
      node_id: :string,
      text: :string,
      speaker: {:optional, :string},
      choices: :list
    },
    "dialogue_update" => %{
      node_id: :string,
      text: :string,
      speaker: {:optional, :string},
      choices: :list
    },
    "dialogue_end" => %{},

    # Cutscene events
    "cutscene_start" => %{
      cutscene_key: :string,
      name: :string
    },
    "cutscene_line" => %{
      text: :string,
      class: {:optional, :string}
    },
    "cutscene_end" => %{},

    # Quest events
    "quest_accepted" => %{
      quest_id: :string,
      name: :string,
      quest: {:optional, :map}
    },
    "quest_completed" => %{
      quest_id: :string,
      title: :string,
      rewards: {:optional, :map}
    },
    "quest_progress" => %{
      quests: :list
    },

    # Inventory events
    "inventory_update" => %{
      inventory: {:optional, :list},
      action: {:optional, :string},
      item_id: {:optional, :string}
    },
    "equipment_update" => %{
      equipped: :map
    },

    # Shop events
    "shop_open" => %{
      npc_id: :string,
      npc_name: :string,
      items: :list,
      buys: :list
    },
    "shop_close" => %{},

    # Container events
    "container_open" => %{
      entity_id: :string,
      entity_name: :string,
      items: :list
    },
    "container_update" => %{
      items: :list
    },
    "container_close" => %{},

    # Ghost (death) events
    "ghost_enter" => %{
      killer: :string
    },
    "ghost_exit" => %{},

    # Resource events
    "stats_update" => %{
      stats: :map
    },
    "resources_update" => %{
      resources: :map
    },

    # System events
    "timer_completed" => %{
      timer_id: {:optional, :string},
      timer_type: :string,
      data: {:optional, :map},
      scheduled_at: {:optional, :string},
      completed_at: {:optional, :string}
    },
    "force_disconnect" => %{
      reason: :string
    },
    "capture_screenshot" => %{}
  }

  # ===========================================================================
  # Client → Server Events
  # ===========================================================================

  @client_events %{
    # Navigation
    "navigate" => %{
      direction:
        {:enum, ["north", "south", "east", "west", "up", "down", "n", "s", "e", "w", "u", "d"]}
    },

    # Entity interaction
    "click_entity" => %{
      entity_id: {:optional, :string},
      id: {:optional, :string},
      type: {:optional, :string}
    },
    "action" => %{
      action: :string,
      entity_id: :string
    },

    # Dialogue
    "dialogue_select" => %{
      choice_index: :integer
    },

    # Inventory
    "inventory" => %{
      action: {:enum, ["drop", "equip", "unequip"]},
      item_id: {:optional, :string},
      slot: {:optional, :string}
    },
    "use_item" => %{
      item_id: :string
    },

    # Combat
    "combat_action" => %{
      action: {:enum, ["flee"]}
    },

    # Shop
    "shop" => %{
      action: {:enum, ["buy", "sell", "close"]},
      item_key: {:optional, :string},
      item_id: {:optional, :string},
      npc_id: {:optional, :string}
    },

    # Container
    "container" => %{
      action: {:enum, ["take", "close"]},
      index: {:optional, :integer}
    },

    # Gathering & Crafting
    "gather" => %{
      node_type: :string
    },
    "craft" => %{
      recipe_key: :string,
      tool_id: {:optional, :string}
    },

    # Communication
    "chat" => %{
      mode: {:enum, ["say", "shout"]},
      message: :string
    },

    # Social
    "emote" => %{
      emote_key: :string,
      target_id: {:optional, :string}
    },
    "social" => %{
      action: {:enum, ["set_mood", "set_pose"]},
      mood: {:optional, :string},
      pose: {:optional, :string}
    },

    # Resurrection
    "resurrect" => %{
      method: {:enum, ["shrine", "healer"]}
    }
  }

  # ===========================================================================
  # Public API
  # ===========================================================================

  @doc "Get all server event definitions"
  def server_events, do: @server_events

  @doc "Get all client event definitions"
  def client_events, do: @client_events

  @doc "Get list of server event names"
  def server_event_names, do: Map.keys(@server_events)

  @doc "Get list of client event names"
  def client_event_names, do: Map.keys(@client_events)

  @doc "Check if a server event exists"
  def server_event?(name), do: Map.has_key?(@server_events, name)

  @doc "Check if a client event exists"
  def client_event?(name), do: Map.has_key?(@client_events, name)

  @doc "Get schema for a server event"
  def get_server_event(name), do: Map.get(@server_events, name)

  @doc "Get schema for a client event"
  def get_client_event(name), do: Map.get(@client_events, name)

  @doc "Get schema for any event by direction"
  def get_event(:server, name), do: get_server_event(name)
  def get_event(:client, name), do: get_client_event(name)
end
