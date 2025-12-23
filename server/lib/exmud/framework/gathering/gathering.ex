defmodule Exmud.Framework.Gathering do
  require Logger

  @moduledoc """
  Core gathering execution logic.

  Handles the gathering process: checking requirements, determining yields,
  managing node depletion and respawn timers.

  ## Usage

      alias Exmud.Framework.Gathering

      # List nodes in a room
      nodes = Gathering.list_nodes(room_entity)

      # Check if player can gather
      case Gathering.can_gather?(game_state, room_entity, "herb_patch") do
        :ok -> # Can gather
        {:error, reason} -> # Handle missing requirements
      end

      # Execute gathering
      case Gathering.gather(game_state, room_entity, "herb_patch") do
        {:ok, result} -> # result contains :items, :message, :xp
        {:error, reason} -> # Handle failure
      end

  ## Room Node State

  Room entities track node state in their components:

      components:
        gathering_nodes:
          herb_patch:
            uses_remaining: 3
            respawn_at: nil  # timestamp when fully respawned
  """

  alias Exmud.Framework.Gathering.{GatheringNode, GatheringRegistry}
  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @type gather_result :: %{
          items: [%{item: String.t(), quantity: pos_integer()}],
          message: String.t(),
          xp: map() | nil,
          node_exhausted: boolean()
        }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Lists all gathering nodes available in a room.

  Returns a list of {node_key, node_definition, room_state} tuples.
  """
  def list_nodes(room_entity) do
    room_nodes = get_room_nodes(room_entity)

    Enum.flat_map(room_nodes, fn {node_key, node_state} ->
      case GatheringRegistry.get(node_key) do
        {:ok, node_def} -> [{node_key, node_def, node_state}]
        {:error, _} -> []
      end
    end)
  end

  @doc """
  Lists nodes that are not exhausted in a room.
  """
  def list_available_nodes(room_entity) do
    list_nodes(room_entity)
    |> Enum.filter(fn {_key, _def, state} ->
      uses = Map.get(state, :uses_remaining, 1)
      uses > 0
    end)
  end

  @doc """
  Checks if an entity can gather from a specific node.

  Returns `:ok` or `{:error, reason}`.

  ## Checks Performed

  1. Node exists in room
  2. Node is not exhausted
  3. Skill requirements met
  4. Required tool in inventory
  """
  def can_gather?(%GameState{} = game_state, room_entity, node_key) do
    with {:ok, node_def} <- get_node_definition(node_key),
         {:ok, node_state} <- get_node_state(room_entity, node_key),
         :ok <- check_not_exhausted(node_state, node_def),
         :ok <- check_skill_requirements(game_state, node_def),
         :ok <- check_tool(game_state, node_def) do
      :ok
    end
  end

  @doc """
  Executes gathering from a node, generating yields.

  Returns `{:ok, result}` or `{:error, reason}`.

  The result contains:
  - `:items` - List of items gathered
  - `:message` - Success or failure message
  - `:xp` - XP reward
  - `:node_exhausted` - Whether the node is now depleted
  - `:new_uses_remaining` - Remaining uses after gathering
  """
  def gather(%GameState{} = game_state, room_entity, node_key) do
    with {:ok, node_def} <- get_node_definition(node_key),
         {:ok, node_state} <- get_node_state(room_entity, node_key),
         :ok <- can_gather?(game_state, room_entity, node_key) do
      # Roll for yields
      items = GatheringNode.roll_yields(node_def)

      # Decrement uses
      uses_remaining = Map.get(node_state, :uses_remaining, node_def.uses_per_respawn)
      new_uses = max(0, uses_remaining - 1)
      exhausted = new_uses == 0

      # Build result
      message = if Enum.empty?(items), do: node_def.failure_message, else: node_def.success_message
      message = if exhausted, do: "#{message} #{node_def.exhausted_message}", else: message

      result = %{
        items: items,
        message: message,
        xp: if(Enum.any?(items), do: node_def.xp_reward, else: nil),
        node_exhausted: exhausted,
        new_uses_remaining: new_uses,
        node_key: node_key
      }

      {:ok, result}
    end
  end

  @doc """
  Gets the remaining uses for a node in a room.
  """
  def get_remaining_uses(room_entity, node_key) do
    case get_node_state(room_entity, node_key) do
      {:ok, state} ->
        case GatheringRegistry.get(node_key) do
          {:ok, node_def} -> Map.get(state, :uses_remaining, node_def.uses_per_respawn)
          {:error, _} -> 0
        end

      {:error, _} ->
        0
    end
  end

  @doc """
  Checks if a node is exhausted.
  """
  def exhausted?(room_entity, node_key) do
    get_remaining_uses(room_entity, node_key) == 0
  end

  @doc """
  Processes respawn timers for all nodes in a room.

  Called by the game loop. Returns updated node states.
  """
  def tick_respawn(room_entity, current_time \\ nil) do
    current_time = current_time || System.system_time(:second)
    room_nodes = get_room_nodes(room_entity)

    Enum.map(room_nodes, fn {node_key, node_state} ->
      case GatheringRegistry.get(node_key) do
        {:ok, node_def} ->
          updated_state = process_respawn(node_key, node_state, node_def, current_time)
          {node_key, updated_state}

        {:error, _} ->
          {node_key, node_state}
      end
    end)
    |> Enum.into(%{})
  end

  @doc """
  Manually resets a node to full uses.
  """
  def reset_node(node_key) do
    case GatheringRegistry.get(node_key) do
      {:ok, node_def} ->
        {:ok, %{uses_remaining: node_def.uses_per_respawn, respawn_at: nil}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # =============================================================================
  # Validation Checks
  # =============================================================================

  defp get_node_definition(node_key) do
    GatheringRegistry.get(node_key)
  end

  defp get_node_state(room_entity, node_key) do
    room_nodes = get_room_nodes(room_entity)

    case Map.get(room_nodes, node_key) do
      nil -> {:error, {:node_not_in_room, node_key}}
      state -> {:ok, state}
    end
  end

  defp check_not_exhausted(node_state, node_def) do
    uses = Map.get(node_state, :uses_remaining, node_def.uses_per_respawn)

    if uses > 0 do
      :ok
    else
      {:error, :node_exhausted}
    end
  end

  defp check_skill_requirements(%GameState{} = game_state, %GatheringNode{} = node_def) do
    if GatheringNode.requires_skill?(node_def) do
      skills = get_skills(game_state)
      player_level = Map.get(skills, node_def.skill_required, 0)

      if player_level >= node_def.skill_level do
        :ok
      else
        {:error, {:skill_required, node_def.skill_required, node_def.skill_level, player_level}}
      end
    else
      :ok
    end
  end

  defp check_tool(%GameState{} = game_state, %GatheringNode{} = node_def) do
    if GatheringNode.requires_tool?(node_def) do
      if has_item?(game_state, node_def.tool_required) do
        :ok
      else
        {:error, {:tool_required, node_def.tool_required}}
      end
    else
      :ok
    end
  end

  # =============================================================================
  # Room Node Management
  # =============================================================================

  defp get_room_nodes(nil), do: %{}

  defp get_room_nodes(room_entity) do
    components = Map.get(room_entity, :components, %{})
    nodes_data = MapHelpers.get_flexible(components, :gathering_nodes, %{})

    # Handle both list and map formats
    case nodes_data do
      nodes when is_map(nodes) -> nodes
      nodes when is_list(nodes) -> list_to_node_map(nodes)
      _ -> %{}
    end
  end

  defp list_to_node_map(nodes_list) do
    Enum.reduce(nodes_list, %{}, fn node_data, acc ->
      node_key = MapHelpers.get_flexible(node_data, :node, nil)

      if node_key do
        state = %{
          uses_remaining: MapHelpers.get_flexible(node_data, :uses_remaining, nil),
          respawn_at: MapHelpers.get_flexible(node_data, :respawn_at, nil)
        }

        Map.put(acc, node_key, state)
      else
        acc
      end
    end)
  end

  defp process_respawn(node_key, node_state, node_def, current_time) do
    uses = Map.get(node_state, :uses_remaining, node_def.uses_per_respawn)
    respawn_at = Map.get(node_state, :respawn_at)

    cond do
      # Already at full uses
      uses >= node_def.uses_per_respawn ->
        node_state

      # No respawn timer set, start one
      is_nil(respawn_at) and uses < node_def.uses_per_respawn ->
        %{node_state | respawn_at: current_time + node_def.respawn_time}

      # Respawn timer has elapsed
      not is_nil(respawn_at) and current_time >= respawn_at ->
        Logger.debug("Node #{node_key} respawned")
        %{uses_remaining: node_def.uses_per_respawn, respawn_at: nil}

      # Still waiting
      true ->
        node_state
    end
  end

  # =============================================================================
  # Inventory Helpers
  # =============================================================================

  defp get_skills(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :skills, %{})
  end

  defp has_item?(%GameState{inventory: inventory}, item_key) do
    Enum.any?(inventory, fn item_id ->
      item_id == item_key or String.starts_with?(to_string(item_id), item_key)
    end)
  end
end
