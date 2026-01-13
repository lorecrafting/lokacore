defmodule Loka.Framework.Quest.StateHelper do
  @moduledoc """
  Helper functions for accessing quest state with flexible key types.

  Quest state can have either atom or string keys depending on how it was
  loaded (from DB vs fresh). These helpers provide consistent access patterns.

  ## Usage

      alias Loka.Framework.Quest.StateHelper

      active = StateHelper.get_active(quests)
      completed = StateHelper.get_completed(quests)
  """

  @doc """
  Gets the active quests map from the quests state.

  Handles both atom and string keys for backwards compatibility.
  Returns an empty map if no active quests exist.
  """
  @spec get_active(map()) :: map()
  def get_active(quests) when is_map(quests) do
    Map.get(quests, "active") || Map.get(quests, :active, %{})
  end

  def get_active(_), do: %{}

  @doc """
  Gets the completed quests list from the quests state.

  Handles both atom and string keys for backwards compatibility.
  Returns an empty list if no completed quests exist.
  """
  @spec get_completed(map()) :: list()
  def get_completed(quests) when is_map(quests) do
    Map.get(quests, "completed") || Map.get(quests, :completed, [])
  end

  def get_completed(_), do: []

  @doc """
  Gets the objectives map from quest data.

  Handles both atom and string keys for backwards compatibility.
  Returns an empty map if no objectives exist.
  """
  @spec get_objectives(map()) :: map()
  def get_objectives(quest_data) when is_map(quest_data) do
    Map.get(quest_data, "objectives") || Map.get(quest_data, :objectives, %{})
  end

  def get_objectives(_), do: %{}

  # ============================================================================
  # Objective Data Accessors
  # ============================================================================

  @doc """
  Gets the completed status from objective progress data.

  Handles both atom and string keys for backwards compatibility.

  ## Examples

      iex> get_objective_completed(%{"completed" => true})
      true

      iex> get_objective_completed(%{completed: false})
      false

      iex> get_objective_completed(%{})
      false
  """
  @spec get_objective_completed(map()) :: boolean()
  def get_objective_completed(obj_data) when is_map(obj_data) do
    Map.get(obj_data, "completed") || Map.get(obj_data, :completed, false)
  end

  def get_objective_completed(_), do: false

  @doc """
  Gets the progress count from objective progress data.

  Handles both atom and string keys for backwards compatibility.

  ## Examples

      iex> get_objective_progress(%{"progress" => 3})
      3

      iex> get_objective_progress(%{progress: 5})
      5

      iex> get_objective_progress(%{})
      0
  """
  @spec get_objective_progress(map()) :: integer()
  def get_objective_progress(obj_data) when is_map(obj_data) do
    Map.get(obj_data, "progress") || Map.get(obj_data, :progress, 0)
  end

  def get_objective_progress(_), do: 0

  @doc """
  Gets the expired status from objective progress data.

  Handles both atom and string keys for backwards compatibility.

  ## Examples

      iex> get_objective_expired(%{"expired" => true})
      true

      iex> get_objective_expired(%{expired: false})
      false

      iex> get_objective_expired(%{})
      false
  """
  @spec get_objective_expired(map()) :: boolean()
  def get_objective_expired(obj_data) when is_map(obj_data) do
    Map.get(obj_data, "expired") || Map.get(obj_data, :expired, false)
  end

  def get_objective_expired(_), do: false
end
