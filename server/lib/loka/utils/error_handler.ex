defmodule Loka.Utils.ErrorHandler do
  @moduledoc """
  Unified error handling for Loka game actions.

  Provides consistent error atoms and user-friendly messages for game errors.

  ## Usage

      alias Loka.Utils.ErrorHandler

      case SomeModule.do_action(args) do
        {:ok, result} -> handle_success(result)
        {:error, reason} ->
          message = ErrorHandler.message(reason)
          # Display message to user
      end

  ## Error Categories

  - Entity errors: `:entity_not_found`, `:npc_not_found`, `:item_not_found`
  - Inventory errors: `:not_in_inventory`, `:inventory_full`
  - Equipment errors: `:not_equipable`, `:slot_empty`, `:requirements_not_met`
  - Quest errors: `:quest_not_found`, `:already_active`, `:already_completed`
  - Combat errors: `:not_combatant`, `:on_cooldown`, `:invalid_action`
  - Dialogue errors: `:no_dialogue`, `:invalid_choice`, `:node_not_found`
  - Skill errors: `:not_enough_skill_points`, `:already_learned`
  """

  # Entity errors
  @type error_reason ::
          :entity_not_found
          | :npc_not_found
          | :item_not_found
          | :player_not_found
          | :not_found
          # Inventory errors
          | :not_in_inventory
          | :inventory_full
          | :not_consumable
          # Equipment errors
          | :not_equipable
          | :slot_empty
          | {:requirements_not_met, map()}
          # Quest errors
          | :quest_not_found
          | :quest_not_active
          | :quest_not_complete
          | :already_active
          | :already_completed
          | :objective_not_found
          # Combat errors
          | :not_combatant
          | :on_cooldown
          | :invalid_action
          | :combat_ended
          # Dialogue errors
          | :no_dialogue
          | :no_start_node
          | :invalid_choice
          | :invalid_node
          | :node_not_found
          # Skill/Progression errors
          | :not_enough_skill_points
          | :already_learned
          | :skill_not_found
          # Generic errors
          | :invalid_state
          | :operation_failed
          | term()

  @doc """
  Converts an error reason to a user-friendly message.

  ## Examples

      iex> ErrorHandler.message(:item_not_found)
      "That item doesn't exist."

      iex> ErrorHandler.message(:not_in_inventory)
      "You don't have that item."

      iex> ErrorHandler.message({:requirements_not_met, %{level: 5}})
      "You don't meet the requirements."
  """
  @spec message(error_reason()) :: String.t()
  def message(reason)

  # Entity errors
  def message(:entity_not_found), do: "That doesn't exist."
  def message(:npc_not_found), do: "That person isn't here."
  def message(:item_not_found), do: "That item doesn't exist."
  def message(:player_not_found), do: "That player isn't here."
  def message(:not_found), do: "Not found."

  # Inventory errors
  def message(:not_in_inventory), do: "You don't have that item."
  def message(:inventory_full), do: "Your inventory is full. Drop or sell items to make room."
  def message(:not_consumable), do: "You can't use that."

  # Equipment errors
  def message(:not_equipable), do: "You can't equip that."
  def message(:slot_empty), do: "Nothing is equipped there."
  def message({:requirements_not_met, _reqs}), do: "You don't meet the requirements."

  # Quest errors
  def message(:quest_not_found), do: "That quest doesn't exist."
  def message(:quest_not_active), do: "You don't have that quest."
  def message(:quest_not_complete), do: "You haven't completed all objectives yet."
  def message(:already_active), do: "You already have that quest."
  def message(:already_completed), do: "You've already completed that quest."
  def message(:objective_not_found), do: "That objective doesn't exist."

  # Combat errors
  def message(:not_combatant), do: "They don't want to fight."
  def message(:on_cooldown), do: "You must wait before using that again."
  def message(:invalid_action), do: "You can't do that right now."
  def message(:combat_ended), do: "The combat has ended."

  # Dialogue errors
  def message(:no_dialogue), do: "They have nothing to say."
  def message(:no_start_node), do: "The conversation can't be started."
  def message(:invalid_choice), do: "That's not an option."
  def message(:invalid_node), do: "The conversation ended unexpectedly."
  def message(:node_not_found), do: "The conversation ended unexpectedly."

  # Skill/Progression errors
  def message(:not_enough_skill_points), do: "You don't have enough skill points."
  def message(:already_learned), do: "You already know that skill."
  def message(:skill_not_found), do: "That skill doesn't exist."

  # Generic fallback
  def message(:invalid_state), do: "Something went wrong."
  def message(:operation_failed), do: "The action failed."
  def message(other) when is_atom(other), do: "Error: #{other}"
  def message(other) when is_binary(other), do: other
  def message(_other), do: "An unexpected error occurred."

  @doc """
  Creates an error tuple with a user-friendly message.

  Useful for wrapping low-level errors with user-facing messages.

  ## Examples

      iex> ErrorHandler.wrap(:item_not_found)
      {:error, :item_not_found, "That item doesn't exist."}
  """
  @spec wrap(error_reason()) :: {:error, error_reason(), String.t()}
  def wrap(reason) do
    {:error, reason, message(reason)}
  end

  @doc """
  Converts an error result to a flash-ready format.

  Returns a map suitable for use with Phoenix flash messages.

  ## Examples

      iex> ErrorHandler.to_flash({:error, :not_in_inventory})
      %{type: :error, message: "You don't have that item."}
  """
  @spec to_flash({:error, error_reason()}) :: %{type: :error, message: String.t()}
  def to_flash({:error, reason}) do
    %{type: :error, message: message(reason)}
  end

  @doc """
  Logs an error with context for debugging.

  In development, logs the full error. In production, logs a sanitized version.
  """
  @spec log(error_reason(), keyword()) :: :ok
  def log(reason, context \\ []) do
    require Logger

    case Mix.env() do
      :prod ->
        Logger.warning("Game error: #{inspect(reason)}")

      _ ->
        Logger.debug("Game error: #{inspect(reason)}, context: #{inspect(context)}")
    end

    :ok
  end
end
