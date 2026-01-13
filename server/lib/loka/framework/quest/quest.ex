defmodule Loka.Framework.Quest do
  @moduledoc """
  Quest management system for the game framework.

  This module delegates to specialized modules:
  - `Loka.Framework.Quest.Definitions` - Quest/Objective structs and loading
  - `Loka.Framework.Quest.Progress` - Player quest progress tracking

  ## Usage

      alias Loka.Framework.Quest

      # Accept a new quest
      {:ok, state} = Quest.accept_quest(state, "find_sword")

      # Check progress
      Quest.get_active_quests(state)

      # Complete an objective manually
      {:ok, state} = Quest.complete_objective(state, "find_sword", "talk_to_blacksmith")

      # Check if quest is complete
      Quest.is_complete?(state, "find_sword")

      # Turn in for rewards
      {:ok, state, rewards} = Quest.turn_in_quest(state, "find_sword")
  """

  alias Loka.Framework.Quest.Definitions
  alias Loka.Framework.Quest.Progress

  # Re-export structs for backwards compatibility
  defdelegate objective_types(), to: Definitions

  # Quest definition functions
  defdelegate get_quest_definition(quest_id), to: Definitions

  # Quest progress functions
  defdelegate accept_quest(state, quest_id), to: Progress
  defdelegate update_progress(state, event), to: Progress
  defdelegate complete_objective(state, quest_id, objective_id), to: Progress
  defdelegate is_complete?(state, quest_id), to: Progress
  defdelegate turn_in_quest(state, quest_id), to: Progress
  defdelegate get_active_quests(state), to: Progress
  defdelegate get_completed_quests(state), to: Progress
  defdelegate get_quest_progress(state, quest_id), to: Progress

  # Backwards compatibility: provide Quest.Quest and Quest.Objective aliases
  defmodule Quest do
    @moduledoc false
    defstruct [
      :id,
      :name,
      :description,
      objectives: [],
      rewards: %{},
      status: :available
    ]
  end

  defmodule Objective do
    @moduledoc false
    defstruct [
      :id,
      :type,
      :description,
      :target_id,
      target_count: 1,
      completed: false,
      progress: 0
    ]
  end
end
