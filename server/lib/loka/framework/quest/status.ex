defmodule Loka.Framework.Quest.Status do
  @moduledoc """
  Single source of truth for quest status definitions.

  All quest-related modules should reference this module instead of
  defining their own status values.

  ## Quest Statuses

  - `:available` - Quest can be accepted but hasn't been started
  - `:in_progress` - Quest has been accepted and is being worked on
  - `:complete` - All objectives met, ready for turn-in
  - `:turned_in` - Quest has been turned in and rewards given
  - `:abandoned` - Quest was abandoned by the player

  ## State Keys

  The player's quest state uses these keys:
  - `"active"` - Map of quest_id => progress for in-progress quests
  - `"completed"` - List of quest_ids that have been turned in

  ## Usage

      alias Loka.Framework.Quest.Status

      # Check if valid
      Status.valid?(:in_progress)  # true

      # Check status categories
      Status.active?(:in_progress)    # true
      Status.terminal?(:turned_in)    # true
  """

  @statuses [:available, :in_progress, :complete, :turned_in, :abandoned]

  @type quest_status :: :available | :in_progress | :complete | :turned_in | :abandoned

  # Keys used in player game_state.quests map
  @state_key_active "active"
  @state_key_completed "completed"

  @doc "Returns all valid quest statuses."
  @spec all() :: [quest_status()]
  def all, do: @statuses

  @doc "Returns true if the given status is valid."
  @spec valid?(atom()) :: boolean()
  def valid?(status), do: status in @statuses

  @doc "Returns true if the quest is in an active (working) state."
  @spec active?(quest_status()) :: boolean()
  def active?(:available), do: true
  def active?(:in_progress), do: true
  def active?(:complete), do: true
  def active?(_), do: false

  @doc "Returns true if the quest is in a terminal (finished) state."
  @spec terminal?(quest_status()) :: boolean()
  def terminal?(:turned_in), do: true
  def terminal?(:abandoned), do: true
  def terminal?(_), do: false

  @doc "Returns true if the quest can be turned in."
  @spec ready_for_turnin?(quest_status()) :: boolean()
  def ready_for_turnin?(:complete), do: true
  def ready_for_turnin?(_), do: false

  @doc "Returns the state key for active quests."
  @spec state_key_active() :: String.t()
  def state_key_active, do: @state_key_active

  @doc "Returns the state key for completed quests."
  @spec state_key_completed() :: String.t()
  def state_key_completed, do: @state_key_completed
end
