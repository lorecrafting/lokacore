defmodule Loka.Framework.Quest.Handlers.ObjectiveHelper do
  @moduledoc """
  Shared helper functions for quest objective handlers.

  Provides common functionality for extracting fields from objective definitions
  that support both atom and string keys (from YAML parsing).

  ## Usage

      alias Loka.Framework.Quest.Handlers.ObjectiveHelper

      # In your handler
      def matches?(objective_def, event) do
        ObjectiveHelper.get_target_id(objective_def) == event.target_id
      end

      def is_complete?(objective_def, progress) do
        progress >= ObjectiveHelper.get_target_count(objective_def)
      end
  """

  # =============================================================================
  # Field Extractors - Support both atom and string keys
  # =============================================================================

  @doc """
  Gets the target_id from an objective definition.

  Returns nil if not found.
  """
  @spec get_target_id(map()) :: String.t() | nil
  def get_target_id(obj) do
    get_field(obj, :target_id)
  end

  @doc """
  Gets the target_count from an objective definition.

  Returns 1 as default if not specified.
  """
  @spec get_target_count(map()) :: non_neg_integer()
  def get_target_count(obj) do
    get_field(obj, :target_count) || 1
  end

  @doc """
  Gets the description from an objective definition.

  Returns empty string if not found.
  """
  @spec get_description(map()) :: String.t()
  def get_description(obj) do
    get_field(obj, :description) || ""
  end

  @doc """
  Gets the objective ID from an objective definition.
  """
  @spec get_id(map()) :: String.t() | nil
  def get_id(obj) do
    get_field(obj, :id)
  end

  @doc """
  Gets the objective type from an objective definition.

  Converts string types to atoms.
  """
  @spec get_type(map()) :: atom() | nil
  def get_type(obj) do
    case get_field(obj, :type) do
      nil -> nil
      type when is_atom(type) -> type
      type when is_binary(type) -> String.to_existing_atom(type)
    end
  rescue
    ArgumentError -> nil
  end

  @doc """
  Gets the dialogue_topic from an objective definition (for talk objectives).
  """
  @spec get_dialogue_topic(map()) :: String.t() | nil
  def get_dialogue_topic(obj) do
    get_field(obj, :dialogue_topic)
  end

  @doc """
  Gets the time_limit from an objective definition (for timed objectives).
  """
  @spec get_time_limit(map()) :: non_neg_integer() | nil
  def get_time_limit(obj) do
    get_field(obj, :time_limit)
  end

  @doc """
  Gets an arbitrary field from an objective definition, supporting both keys.
  """
  @spec get_field(map(), atom()) :: any()
  def get_field(obj, field) when is_atom(field) do
    Map.get(obj, field) || Map.get(obj, Atom.to_string(field))
  end

  # =============================================================================
  # Progress Helpers
  # =============================================================================

  @doc """
  Formats a description with progress count.

  ## Examples

      iex> format_progress_description("Defeat goblins", 3, 5)
      "Defeat goblins (3/5)"

      iex> format_progress_description("Find the sword", 1, 1)
      "Find the sword"
  """
  @spec format_progress_description(String.t(), non_neg_integer(), non_neg_integer()) ::
          String.t()
  def format_progress_description(description, progress, target_count)
      when target_count > 1 do
    "#{description} (#{progress}/#{target_count})"
  end

  def format_progress_description(description, _progress, _target_count) do
    description
  end

  @doc """
  Increments progress by the event count.

  Used by count-based objectives (kill, get_item).
  """
  @spec increment_progress(map(), non_neg_integer()) :: non_neg_integer()
  def increment_progress(event, current_progress) do
    count = Map.get(event, :count, 1)
    current_progress + count
  end

  @doc """
  Checks if progress meets or exceeds target count.
  """
  @spec progress_complete?(non_neg_integer(), non_neg_integer()) :: boolean()
  def progress_complete?(progress, target_count) do
    progress >= target_count
  end

  # =============================================================================
  # Validation Helpers
  # =============================================================================

  @doc """
  Validates that target_id is present and non-empty.
  """
  @spec validate_target_id(map(), String.t()) :: :ok | {:error, String.t()}
  def validate_target_id(obj, error_message) do
    target_id = get_target_id(obj)

    if is_nil(target_id) || target_id == "" do
      {:error, error_message}
    else
      :ok
    end
  end

  @doc """
  Validates that target_count is a positive integer.
  """
  @spec validate_target_count(map()) :: :ok | {:error, String.t()}
  def validate_target_count(obj) do
    target_count = get_target_count(obj)

    if is_integer(target_count) && target_count >= 1 do
      :ok
    else
      {:error, "target_count must be a positive integer"}
    end
  end

  @doc """
  Combines multiple validation results.

  Returns :ok if all pass, or the first error encountered.
  """
  @spec validate_all([{:ok | {:error, String.t()}}]) :: :ok | {:error, String.t()}
  def validate_all(validations) do
    Enum.find(validations, :ok, fn
      {:error, _} -> true
      :ok -> false
    end)
  end

  # =============================================================================
  # Event Matching Helpers
  # =============================================================================

  @doc """
  Checks if an event matches the expected type and target.
  """
  @spec matches_type_and_target?(map(), map(), atom()) :: boolean()
  def matches_type_and_target?(objective_def, event, expected_type) do
    event_type = Map.get(event, :type)
    event_target = Map.get(event, :target_id)
    obj_target = get_target_id(objective_def)

    event_type == expected_type && event_target == obj_target
  end
end
