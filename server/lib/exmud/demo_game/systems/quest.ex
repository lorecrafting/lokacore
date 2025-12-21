defmodule Exmud.DemoGame.Systems.Quest do
  @moduledoc """
  Quest management system for the demo game.

  This module delegates to specialized modules:
  - `Exmud.DemoGame.Systems.QuestDefinitions` - Quest/Objective structs and loading
  - `Exmud.DemoGame.Systems.QuestProgress` - Player quest progress tracking

  ## Usage

      alias Exmud.DemoGame.Systems.Quest

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

  alias Exmud.DemoGame.Systems.QuestDefinitions
  alias Exmud.DemoGame.Systems.QuestProgress

  # Re-export structs for backwards compatibility
  defdelegate objective_types(), to: QuestDefinitions

  # Quest definition functions
  defdelegate get_quest_definition(quest_id), to: QuestDefinitions

  # Quest progress functions
  defdelegate accept_quest(state, quest_id), to: QuestProgress
  defdelegate update_progress(state, event), to: QuestProgress
  defdelegate complete_objective(state, quest_id, objective_id), to: QuestProgress
  defdelegate is_complete?(state, quest_id), to: QuestProgress
  defdelegate turn_in_quest(state, quest_id), to: QuestProgress
  defdelegate get_active_quests(state), to: QuestProgress
  defdelegate get_completed_quests(state), to: QuestProgress
  defdelegate get_quest_progress(state, quest_id), to: QuestProgress

  # Struct aliases for backwards compatibility
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
