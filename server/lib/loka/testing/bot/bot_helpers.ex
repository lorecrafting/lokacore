defmodule Loka.Testing.Bot.BotHelpers do
  @moduledoc """
  Shared helper functions for bot testing modules.

  These helpers provide consistent patterns for accessing entity data,
  quest state, and dialogue state across QuestStrategy, StorylineRunner,
  and BotActions.

  ## Entity Access

  Entity data can have either atom or string keys depending on how it was
  loaded. These helpers provide consistent access:

      entity = BotHelpers.find_entity_in_room(context, "merchant_dorje")
      key = BotHelpers.get_entity_field(entity, :key)

  ## Quest State Access

  Quest state similarly can have mixed key types:

      completed = BotHelpers.get_completed_quests(game_state)
      is_done = BotHelpers.quest_completed?(game_state, "main_quest")

  ## Dialogue State Access

  Dialogue state may be at different paths in the context:

      dialogue = BotHelpers.get_dialogue_state(context)
  """

  alias Loka.Framework.Player.GameState

  # ============================================================================
  # Entity Helpers
  # ============================================================================

  @doc """
  Gets a field from an entity map, handling both atom and string keys.

  ## Examples

      iex> get_entity_field(%{key: "merchant"}, :key)
      "merchant"

      iex> get_entity_field(%{"key" => "merchant"}, :key)
      "merchant"
  """
  @spec get_entity_field(map(), atom()) :: any()
  def get_entity_field(entity, field) when is_map(entity) and is_atom(field) do
    Map.get(entity, field) || Map.get(entity, to_string(field))
  end

  def get_entity_field(_, _), do: nil

  @doc """
  Finds an entity in the room by key or id.

  Searches context[:nearby_entities] for an entity matching the target key.
  Handles both atom and string keys in entity data.

  ## Examples

      iex> find_entity_in_room(context, "merchant_dorje")
      %{key: "merchant_dorje", id: "abc123", ...}

      iex> find_entity_in_room(context, nil)
      nil
  """
  @spec find_entity_in_room(map(), String.t() | nil) :: map() | nil
  def find_entity_in_room(_context, nil), do: nil

  def find_entity_in_room(context, target_key) do
    entities = context[:nearby_entities] || []

    Enum.find(entities, fn entity ->
      entity_key = get_entity_field(entity, :key)
      entity_id = get_entity_field(entity, :id)
      entity_name = get_entity_field(entity, :name)

      # Match by key, id, or name (converted to key format)
      entity_key == target_key || entity_id == target_key ||
        (entity_name && normalize_key(entity_name) == target_key)
    end)
  end

  # Helper to normalize entity names to key format (e.g., "Abbot Jampa" -> "abbot_jampa")
  defp normalize_key(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "_")
    |> String.trim("_")
  end

  defp normalize_key(_), do: nil

  @doc """
  Gets the entity's type field.
  """
  @spec entity_type(map()) :: atom()
  def entity_type(entity) do
    get_entity_field(entity, :type) || :unknown
  end

  @doc """
  Gets a human-readable name for an entity.
  """
  @spec entity_name(map()) :: String.t()
  def entity_name(entity) do
    get_entity_field(entity, :short_desc) ||
      get_entity_field(entity, :name) ||
      get_entity_field(entity, :id) ||
      "unknown"
  end

  # ============================================================================
  # Quest State Helpers
  # ============================================================================

  @doc """
  Gets the list of completed quest IDs from game state.

  Handles both GameState structs and plain maps with mixed key types.

  ## Examples

      iex> get_completed_quests(game_state)
      ["intro_quest", "main_quest"]

  Note: When using channel format (quests as list), completed quests are not
  included in the payload. This returns an empty list in that case.
  """
  @spec get_completed_quests(GameState.t() | map()) :: [String.t()]
  def get_completed_quests(%GameState{} = game_state) do
    get_completed_quests(Map.from_struct(game_state))
  end

  def get_completed_quests(game_state) when is_map(game_state) do
    quests = game_state[:quests] || game_state["quests"] || %{}

    cond do
      # Channel format: quests is a list (only active quests sent)
      # Completed quests are not included in channel payload
      is_list(quests) ->
        []

      # Internal format: quests is %{active: map, completed: list}
      is_map(quests) ->
        quests[:completed] || quests["completed"] || []

      true ->
        []
    end
  end

  def get_completed_quests(_), do: []

  @doc """
  Gets the list of active quest IDs from game state.

  Handles multiple formats:
  - GameState struct: Uses Quest.get_active_quests/1
  - Channel format: quests is a list of quest maps [%{id: "quest_id", ...}]
  - Internal format: quests is %{active: %{quest_id => progress}, completed: [...]}
  """
  @spec get_active_quest_ids(GameState.t() | map()) :: [String.t()]
  def get_active_quest_ids(%GameState{} = game_state) do
    get_active_quest_ids(Map.from_struct(game_state))
  end

  def get_active_quest_ids(game_state) when is_map(game_state) do
    quests = game_state[:quests] || game_state["quests"] || %{}

    cond do
      # Channel format: quests is a list of quest maps
      is_list(quests) ->
        Enum.map(quests, fn q -> q[:id] || q["id"] end) |> Enum.reject(&is_nil/1)

      # Internal format: quests is %{active: map, completed: list}
      is_map(quests) ->
        active = quests[:active] || quests["active"] || %{}
        Map.keys(active)

      true ->
        []
    end
  end

  def get_active_quest_ids(_), do: []

  @doc """
  Checks if a quest is completed.

  ## Examples

      iex> quest_completed?(game_state, "main_quest")
      true
  """
  @spec quest_completed?(GameState.t() | map(), String.t()) :: boolean()
  def quest_completed?(game_state, quest_id) do
    quest_id in get_completed_quests(game_state)
  end

  @doc """
  Gets quest progress for a specific quest from game state.

  Handles multiple formats:
  - GameState struct: Uses Quest.get_quest_progress/2
  - Channel format: quests is a list of quest maps, extracts progress from quest map
  - Internal format: quests is %{active: %{quest_id => progress}}
  """
  @spec get_quest_progress(GameState.t() | map(), String.t()) :: map() | nil
  def get_quest_progress(%GameState{} = game_state, quest_id) do
    get_quest_progress(Map.from_struct(game_state), quest_id)
  end

  def get_quest_progress(game_state, quest_id) when is_map(game_state) do
    quests = game_state[:quests] || game_state["quests"] || %{}

    cond do
      # Channel format: quests is a list of quest maps
      is_list(quests) ->
        Enum.find_value(quests, fn q ->
          q_id = q[:id] || q["id"]
          if q_id == quest_id, do: q
        end)

      # Internal format: quests is %{active: map, completed: list}
      is_map(quests) ->
        active = quests[:active] || quests["active"] || %{}
        Map.get(active, quest_id)

      true ->
        nil
    end
  end

  def get_quest_progress(_, _), do: nil

  # ============================================================================
  # Objective Helpers
  # ============================================================================

  @doc """
  Gets the completed status from objective progress data.

  Handles both atom and string keys.
  """
  @spec get_objective_completed(map()) :: boolean()
  def get_objective_completed(obj_data) when is_map(obj_data) do
    Map.get(obj_data, "completed") || Map.get(obj_data, :completed, false)
  end

  def get_objective_completed(_), do: false

  @doc """
  Gets the progress count from objective progress data.
  """
  @spec get_objective_progress(map()) :: integer()
  def get_objective_progress(obj_data) when is_map(obj_data) do
    Map.get(obj_data, "progress") || Map.get(obj_data, :progress, 0)
  end

  def get_objective_progress(_), do: 0

  @doc """
  Gets the expired status from objective progress data.
  """
  @spec get_objective_expired(map()) :: boolean()
  def get_objective_expired(obj_data) when is_map(obj_data) do
    Map.get(obj_data, "expired") || Map.get(obj_data, :expired, false)
  end

  def get_objective_expired(_), do: false

  # ============================================================================
  # Dialogue State Helpers
  # ============================================================================

  @doc """
  Gets the dialogue state from context.

  Handles both direct access (context[:dialogue_state]) and nested access
  (context[:bot_state][:dialogue_state]).

  ## Examples

      iex> get_dialogue_state(%{dialogue_state: %{npc: "merchant"}})
      %{npc: "merchant"}

      iex> get_dialogue_state(%{bot_state: %{dialogue_state: %{npc: "merchant"}}})
      %{npc: "merchant"}
  """
  @spec get_dialogue_state(map()) :: map() | nil
  def get_dialogue_state(context) when is_map(context) do
    context[:dialogue_state] ||
      get_in(context, [:bot_state, :dialogue_state])
  end

  def get_dialogue_state(_), do: nil
end
