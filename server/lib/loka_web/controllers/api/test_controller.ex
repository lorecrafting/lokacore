defmodule LokaWeb.Api.TestController do
  @moduledoc """
  Test-only API endpoints for E2E testing.

  These endpoints are ONLY available in the :test and :dev environments.
  They allow E2E tests to:
  - Create test players with instant login (bypassing magic link)
  - Reset test data
  - Query game state

  ## Security

  These endpoints are disabled in production. The router checks
  Mix.env() before mounting these routes.
  """

  use LokaWeb, :controller

  alias Loka.Accounts
  alias Loka.Engine.Entities
  alias Loka.Testing.TestData
  alias Loka.Testing.QuestStrategy

  # Dedicated test email for E2E tests
  @test_email "e2e-test@loka.test"

  @doc """
  Creates a test player and returns a session token.

  This bypasses the magic link flow for E2E tests.

  ## Request

      POST /api/test/create-player
      {
        "email": "test@example.com"
      }

  ## Response

      {
        "player_id": "uuid",
        "email": "test@example.com",
        "token": "session_token"
      }
  """
  def create_player(conn, %{"email" => email}) do
    # Only allow in test/dev
    unless Mix.env() in [:test, :dev] do
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Not available in production"})
      |> halt()
    end

    # Create or get existing player
    case Accounts.get_player_by_email(email) do
      nil ->
        # Create new player
        case Accounts.register_player(%{email: email}) do
          {:ok, player} ->
            token = generate_session_token(player)

            json(conn, %{
              player_id: player.id,
              email: player.email,
              token: token
            })

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "Failed to create player", details: inspect(changeset.errors)})
        end

      player ->
        # Player exists, generate new token
        token = generate_session_token(player)

        json(conn, %{
          player_id: player.id,
          email: player.email,
          token: token
        })
    end
  end

  @doc """
  Finds the path between two rooms.

  ## Request

      GET /api/test/path?from=room_a&to=room_b

  ## Response

      {
        "path": ["north", "east", "north"]
      }

  Or on error:

      {
        "error": "no_path"
      }
  """
  def find_path(conn, %{"from" => from, "to" => to}) do
    case TestData.find_path(from, to) do
      {:ok, path} ->
        json(conn, %{path: path})

      {:error, reason} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Gets the world graph (room connections).

  ## Request

      GET /api/test/world-graph

  ## Response

      {
        "awakening_clearing": { "north": "heartwood_grove_path" },
        "heartwood_grove_path": { "south": "awakening_clearing", "east": "gathering_circle" }
      }
  """
  def world_graph(conn, _params) do
    graph = TestData.build_world_graph()
    json(conn, graph)
  end

  @doc """
  Gets NPC locations.

  ## Request

      GET /api/test/npcs

  ## Response

      {
        "thera": "awakening_clearing",
        "elder_maren": "gathering_circle"
      }
  """
  def npc_locations(conn, _params) do
    locations = TestData.build_npc_locations()
    json(conn, locations)
  end

  @doc """
  Resets the dedicated E2E test player to a fresh state.

  This deletes the player's game state (inventory, quests, progress)
  and creates a fresh one, allowing tests to run from a clean slate.

  ## Request

      POST /api/test/reset-player

  ## Response

      {
        "player_id": "uuid",
        "email": "e2e-test@loka.test",
        "token": "session_token",
        "reset": true
      }
  """
  def reset_player(conn, _params) do
    # Get or create the dedicated test player (handles race conditions)
    player = get_or_create_test_player()

    # Delete existing character entity (resets all progress)
    case Entities.find_one(account_id: player.id) do
      {:ok, character} -> Entities.delete_entity(character.id)
      {:error, :not_found} -> :ok
    end

    # Generate fresh session token
    token = generate_session_token(player)

    json(conn, %{
      player_id: player.id,
      email: player.email,
      token: token,
      reset: true
    })
  end

  @doc """
  Gets the current game state for the test player.

  ## Request

      GET /api/test/player-state

  ## Response

      {
        "quests": {...},
        "inventory": [...],
        "flags": {...},
        "current_room_id": "..."
      }
  """
  def player_state(conn, _params) do
    case Accounts.get_player_by_email(@test_email) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Test player not found. Call /api/test/reset-player first."})

      player ->
        case Entities.find_one(account_id: player.id) do
          {:error, :not_found} ->
            json(conn, %{
              player_id: player.id,
              state: nil,
              message: "No character entity yet. Player needs to enter the game."
            })

          {:ok, character} ->
            components = character.components || %{}
            # Get nearby entities from the current room
            nearby_entities = get_room_entities(character.location_id)

            json(conn, %{
              player_id: player.id,
              quests: components["quest_progress"] || %{},
              inventory: components["inventory"] || [],
              equipment: components["equipment"] || %{},
              flags: components["flags"] || %{},
              stats: components["stats"] || %{},
              current_room_id: character.location_id,
              nearby_entities: nearby_entities
            })
        end
    end
  end

  # Get entities in a room for E2E tests
  # Filters out despawned mobs so the strategy knows they're unavailable
  defp get_room_entities(nil), do: []

  defp get_room_entities(room_id) do
    alias Loka.Engine.Entities

    room_id
    |> Entities.get_contents()
    |> Enum.reject(fn entity ->
      # Filter out despawned (dead) mobs
      entity.components["despawned"] == true
    end)
    |> Enum.map(fn entity ->
      %{
        id: entity.id,
        key: entity.key,
        type: entity.type,
        name: entity.short_desc,
        components: Map.keys(entity.components || %{})
      }
    end)
  end

  # =============================================================================
  # Quest Strategy API
  # =============================================================================

  @doc """
  Gets the next action for a quest strategy run.

  This is the unified decision-making endpoint that Playwright E2E tests can
  use to get the same quest logic as the Elixir bot.

  ## Request

      POST /api/test/strategy/next-action
      {
        "storyline_id": "grove_arc",
        "current_room_id": "awakening_clearing",
        "game_state": {...},
        "nearby_entities": [...],
        "dialogue_state": null,
        "room_graph": {...},
        "strategy_state": {...}  // Optional, for continuing from previous action
      }

  ## Response

      {
        "action": "navigate",
        "params": { "direction": "north" },
        "strategy_state": {...}  // Pass this back in next request
      }

  ## Action Types

  - `navigate` - Move in a direction
  - `talk` - Start dialogue with NPC
  - `dialogue_choice` - Select dialogue option
  - `pick_up` - Get item from room
  - `attack` - Attack enemy
  - `accept_quest` - Accept a quest
  - `complete_quest` - Turn in a quest
  - `wait` - Wait (milliseconds)
  - `complete` - Storyline finished
  - `stuck` - Can't proceed (check reason)
  - `idle` - No action needed, check again
  """
  def strategy_next_action(conn, params) do
    context = %{
      storyline_id: params["storyline_id"],
      current_room_id: params["current_room_id"],
      game_state: atomize_keys(params["game_state"] || %{}),
      nearby_entities: params["nearby_entities"] || [],
      dialogue_state: params["dialogue_state"],
      room_graph: params["room_graph"] || %{},
      entity_locations: params["entity_locations"] || %{},
      strategy_state: atomize_strategy_state(params["strategy_state"])
    }

    {action, new_strategy_state} = QuestStrategy.next_action(context)

    {action_type, action_params} = format_action(action)

    json(conn, %{
      action: action_type,
      params: action_params,
      strategy_state: serialize_strategy_state(new_strategy_state)
    })
  end

  # Serialize strategy state to JSON-safe format
  defp serialize_strategy_state(nil), do: nil

  defp serialize_strategy_state(state) when is_map(state) do
    %{
      phase: to_string(state[:phase]),
      current_quest_id: state[:current_quest_id],
      current_objective: serialize_objective(state[:current_objective]),
      target_room_id: state[:target_room_id],
      target_room_key: state[:target_room_key],
      target_entity_key: state[:target_entity_key],
      dialogue_goal: serialize_dialogue_goal(state[:dialogue_goal]),
      path: state[:path] || [],
      failure_reason: state[:failure_reason] && to_string(state[:failure_reason]),
      results: serialize_results_for_json(state[:results]),
      storyline_id: state[:storyline_id]
    }
  end

  # Serialize results - convert tuples to lists for JSON
  defp serialize_results_for_json(nil), do: nil

  defp serialize_results_for_json(results) when is_map(results) do
    Map.new(results, fn {k, v} ->
      {k, serialize_result_list(v)}
    end)
  end

  defp serialize_result_list(list) when is_list(list) do
    Enum.map(list, fn
      {a, b} -> [a, b]
      {a, b, c} -> [a, b, c]
      other -> other
    end)
  end

  defp serialize_result_list(other), do: other

  defp serialize_objective(nil), do: nil

  defp serialize_objective(%{id: id, type: type, target_id: target_id, description: desc}) do
    %{
      id: id,
      type: to_string(type),
      target_id: target_id,
      description: desc
    }
  end

  defp serialize_objective(obj) when is_map(obj) do
    %{
      id: obj[:id] || obj["id"],
      type: to_string(obj[:type] || obj["type"]),
      target_id: obj[:target_id] || obj["target_id"],
      description: obj[:description] || obj["description"]
    }
  end

  defp serialize_dialogue_goal(nil), do: nil
  defp serialize_dialogue_goal({action, quest_id}), do: [to_string(action), quest_id]
  defp serialize_dialogue_goal(goal), do: goal

  @doc """
  Gets the quest order for a storyline.

  ## Request

      GET /api/test/strategy/quest-order?storyline_id=grove_arc

  ## Response

      {
        "quests": ["intro_welcome", "intro_find_temple", ...]
      }
  """
  def strategy_quest_order(conn, %{"storyline_id" => storyline_id}) do
    case QuestStrategy.get_quest_order(storyline_id) do
      {:ok, quests} ->
        json(conn, %{quests: quests})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Storyline not found"})
    end
  end

  # Format action tuple into JSON-friendly format
  defp format_action({:navigate, direction}), do: {"navigate", %{direction: direction}}
  defp format_action({:talk, npc_key}), do: {"talk", %{npc_key: npc_key}}
  defp format_action({:dialogue_choice, index}), do: {"dialogue_choice", %{index: index}}
  defp format_action({:pick_up, item_key}), do: {"pick_up", %{item_key: item_key}}
  defp format_action({:attack, enemy_key}), do: {"attack", %{enemy_key: enemy_key}}
  defp format_action({:accept_quest, quest_id}), do: {"accept_quest", %{quest_id: quest_id}}
  defp format_action({:wait, ms}), do: {"wait", %{milliseconds: ms}}

  defp format_action({:complete, results}),
    do: {"complete", %{results: serialize_results_for_json(results)}}

  defp format_action({:stuck, reason}), do: {"stuck", %{reason: to_string(reason)}}
  defp format_action(:idle), do: {"idle", %{}}

  # Convert string keys to atoms for game_state
  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), atomize_keys(v)}
      {k, v} -> {k, atomize_keys(v)}
    end)
  rescue
    # If atom doesn't exist, keep as string
    ArgumentError -> map
  end

  defp atomize_keys(list) when is_list(list), do: Enum.map(list, &atomize_keys/1)
  defp atomize_keys(value), do: value

  # Convert strategy_state from JSON back to proper format
  defp atomize_strategy_state(nil), do: nil

  defp atomize_strategy_state(state) when is_map(state) do
    %{
      phase: String.to_existing_atom(state["phase"] || "init"),
      current_quest_id: state["current_quest_id"],
      current_objective: atomize_objective(state["current_objective"]),
      target_room_id: state["target_room_id"],
      target_room_key: state["target_room_key"],
      target_entity_key: state["target_entity_key"],
      dialogue_goal: atomize_dialogue_goal(state["dialogue_goal"]),
      path: state["path"] || [],
      failure_reason: state["failure_reason"],
      results: atomize_results(state["results"]),
      storyline_id: state["storyline_id"]
    }
  rescue
    _ -> nil
  end

  defp atomize_objective(nil), do: nil

  defp atomize_objective(obj) when is_map(obj) do
    %{
      id: obj["id"],
      type: String.to_existing_atom(obj["type"] || "talk"),
      target_id: obj["target_id"],
      description: obj["description"]
    }
  rescue
    _ -> nil
  end

  defp atomize_dialogue_goal(nil), do: nil

  defp atomize_dialogue_goal([type, quest_id]) when is_binary(type) do
    {String.to_existing_atom(type), quest_id}
  rescue
    _ -> nil
  end

  defp atomize_dialogue_goal(_), do: nil

  defp atomize_results(nil) do
    %{
      quests_completed: [],
      objectives_achieved: [],
      npcs_talked_to: [],
      items_collected: [],
      enemies_defeated: [],
      rooms_visited: []
    }
  end

  defp atomize_results(results) when is_map(results) do
    %{
      quests_completed: results["quests_completed"] || [],
      objectives_achieved: results["objectives_achieved"] || [],
      npcs_talked_to: results["npcs_talked_to"] || [],
      items_collected: results["items_collected"] || [],
      enemies_defeated: results["enemies_defeated"] || [],
      rooms_visited: results["rooms_visited"] || []
    }
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp generate_session_token(player) do
    # Generate a session token that can be used in cookies
    token = Accounts.generate_player_session_token(player)
    Base.url_encode64(token)
  end

  # Handles race condition where multiple parallel tests try to create the same player
  defp get_or_create_test_player do
    case Accounts.get_player_by_email(@test_email) do
      nil ->
        case Accounts.register_player(%{email: @test_email}) do
          {:ok, player} ->
            player

          {:error, _changeset} ->
            # Race condition - another process created it first, just fetch
            Accounts.get_player_by_email(@test_email)
        end

      existing ->
        existing
    end
  end
end
