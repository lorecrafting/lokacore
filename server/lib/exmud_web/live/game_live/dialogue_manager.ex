defmodule ExmudWeb.GameLive.DialogueManager do
  @moduledoc """
  Dialogue event handlers for GameLive.

  Handles:
  - Starting conversations with NPCs
  - Dialogue choices
  - Dialogue actions (accept quest, give item, set flag, learn skill)
  """

  import Phoenix.Component, only: [assign: 3, update: 3]

  alias Exmud.Framework.Player.GameState, as: PlayerGameState
  alias Exmud.Framework.Dialogue
  alias Exmud.Framework.Quest
  alias Exmud.Framework.Inventory
  alias Exmud.Framework.Progression
  alias Exmud.Framework.Skills

  @doc """
  Starts a conversation with an NPC.
  """
  def start_conversation(socket, entity) do
    player_quests = socket.assigns.quests

    case Dialogue.start_conversation(entity.id, player_quests: player_quests) do
      {:ok, dialogue_node} ->
        {:noreply,
         socket
         |> assign(:dialogue, dialogue_node)
         |> assign(:dialogue_npc, entity)
         |> update_ui(%{context_entity: nil})}

      {:error, _reason} ->
        event = %{
          text: "The #{entity.name} nods in acknowledgment.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{context_entity: nil})
         |> update(:events, fn events -> events ++ [event] end)}
    end
  end

  @doc """
  Handles selecting a dialogue choice.
  """
  def handle_choice(socket, index_str) do
    index = String.to_integer(index_str)
    npc = socket.assigns.dialogue_npc
    current_node = socket.assigns.dialogue
    player_quests = socket.assigns.quests

    case Dialogue.choose_option(npc.id, index, current_node.id, player_quests: player_quests) do
      {:ok, :end, %{action: action}} ->
        socket = handle_action(socket, action)

        {:noreply,
         socket
         |> assign(:dialogue, nil)
         |> assign(:dialogue_npc, nil)}

      {:ok, next_node, %{action: action}} ->
        socket = handle_action(socket, action)

        {:noreply, assign(socket, :dialogue, next_node)}

      {:error, _} ->
        {:noreply,
         socket
         |> assign(:dialogue, nil)
         |> assign(:dialogue_npc, nil)}
    end
  end

  @doc """
  Ends the current dialogue.
  """
  def end_dialogue(socket) do
    {:noreply,
     socket
     |> assign(:dialogue, nil)
     |> assign(:dialogue_npc, nil)}
  end

  @doc """
  Handles a dialogue action.
  """
  def handle_action(socket, nil), do: socket

  def handle_action(socket, {:accept_quest, quest_id}) do
    game_state = socket.assigns.game_state

    case Quest.accept_quest(game_state, quest_id) do
      {:ok, new_game_state} ->
        active_quests = Quest.get_active_quests(new_game_state)
        completed_quests = Quest.get_completed_quests(new_game_state)

        quest_def = Quest.get_quest_definition(quest_id)
        quest_name = if quest_def, do: quest_def.name, else: quest_id

        event = %{
          text: "New quest: #{quest_name}",
          timestamp: DateTime.utc_now()
        }

        socket
        |> assign(:game_state, new_game_state)
        |> assign(:quests, new_game_state.quests)
        |> assign(:active_quests, active_quests)
        |> assign(:completed_quests, completed_quests)
        |> update(:events, fn events -> events ++ [event] end)

      {:error, :already_active} ->
        event = %{
          text: "You already have this quest.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, :already_completed} ->
        event = %{
          text: "You've already completed this quest.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, _reason} ->
        socket
    end
  end

  def handle_action(socket, {:give_item, item_id}) do
    game_state = socket.assigns.game_state

    case Inventory.add_item(game_state, item_id) do
      {:ok, new_game_state} ->
        inventory_items = Inventory.list_items(new_game_state)

        event = %{
          text: "You received an item.",
          timestamp: DateTime.utc_now()
        }

        socket
        |> assign(:game_state, new_game_state)
        |> assign(:inventory, new_game_state.inventory)
        |> assign(:inventory_items, inventory_items)
        |> update(:events, fn events -> events ++ [event] end)

      {:error, _} ->
        socket
    end
  end

  def handle_action(socket, {:set_flag, flag_name}) do
    game_state = socket.assigns.game_state
    flags = game_state.flags || %{}
    new_flags = Map.put(flags, flag_name, true)

    case PlayerGameState.update_state(game_state, %{flags: new_flags}) do
      {:ok, new_game_state} ->
        assign(socket, :game_state, new_game_state)

      {:error, _} ->
        socket
    end
  end

  def handle_action(socket, {:learn_skill, skill_id, skill_cost}) do
    game_state = socket.assigns.game_state
    skill = Skills.get_skill(skill_id)

    case Progression.learn_skill(game_state, skill_id, skill_cost) do
      {:ok, new_game_state} ->
        skill_name = if skill, do: skill.name, else: skill_id

        event = %{
          text: "You have learned #{skill_name}! (#{skill_cost} skill points spent)",
          timestamp: DateTime.utc_now()
        }

        socket
        |> assign(:game_state, new_game_state)
        |> assign(:stats, new_game_state.stats)
        |> update(:events, fn events -> events ++ [event] end)

      {:error, :not_enough_skill_points} ->
        event = %{
          text: "You don't have enough skill points to learn this skill.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, :already_learned} ->
        event = %{
          text: "You already know this skill.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, _} ->
        socket
    end
  end

  def handle_action(socket, _unknown_action), do: socket

  # Private helpers

  defp update_ui(socket, updates) do
    update(socket, :ui, fn ui -> Map.merge(ui, updates) end)
  end
end
