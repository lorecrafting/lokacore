defmodule Loka.Framework.Actions.Action do
  @moduledoc """
  Represents an action that can be performed on an entity.

  Actions are defined on entities (items, NPCs, etc.) and can have conditions
  that determine whether they're available to a specific player.

  ## Fields

  - `key` - Unique identifier for the action (e.g., "get", "talk", "attack")
  - `label` - Display text shown to the player (e.g., "Pick Up", "Talk")
  - `conditions` - List of conditions that must pass for action to be available
  - `unavailable_message` - Message shown when conditions aren't met (optional)
  - `priority` - Used for ordering actions in UI (higher = first)
  - `icon` - Icon identifier for mobile UI (optional)

  ## Example YAML

      components:
        actions:
          - key: get
            label: "Pick Up"
          - key: read
            label: "Read the Tome"
            conditions:
              - flag: can_read_ancient
            unavailable_message: "The script is incomprehensible."
          - key: study
            label: "Study the Script"
            conditions:
              - not_flag: can_read_ancient
              - stat_gte: { int: 12 }
  """

  @type t :: %__MODULE__{
          key: String.t(),
          label: String.t(),
          conditions: list(),
          unavailable_message: String.t() | nil,
          priority: integer(),
          icon: String.t() | nil
        }

  defstruct [
    :key,
    :label,
    conditions: [],
    unavailable_message: nil,
    priority: 0,
    icon: nil
  ]

  @doc """
  Creates an Action from a map (typically from YAML/JSON).
  """
  def from_map(data) when is_map(data) do
    %__MODULE__{
      key: get_string(data, "key") || get_string(data, :key),
      label: get_string(data, "label") || get_string(data, :label) || get_string(data, "key"),
      conditions: get_list(data, "conditions") || get_list(data, :conditions) || [],
      unavailable_message:
        get_string(data, "unavailable_message") || get_string(data, :unavailable_message),
      priority: get_integer(data, "priority") || get_integer(data, :priority) || 0,
      icon: get_string(data, "icon") || get_string(data, :icon)
    }
  end

  def from_map(_), do: nil

  @doc """
  Creates a simple action with just key and label.
  """
  def new(key, label, opts \\ []) do
    %__MODULE__{
      key: key,
      label: label,
      conditions: Keyword.get(opts, :conditions, []),
      unavailable_message: Keyword.get(opts, :unavailable_message),
      priority: Keyword.get(opts, :priority, 0),
      icon: Keyword.get(opts, :icon)
    }
  end

  @doc """
  Serializes an action for sending to the client.
  """
  def to_map(%__MODULE__{} = action) do
    %{
      key: action.key,
      label: action.label
    }
    |> maybe_put(:icon, action.icon)
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp get_string(map, key) do
    case Map.get(map, key) do
      val when is_binary(val) -> val
      _ -> nil
    end
  end

  defp get_list(map, key) do
    case Map.get(map, key) do
      val when is_list(val) -> val
      _ -> nil
    end
  end

  defp get_integer(map, key) do
    case Map.get(map, key) do
      val when is_integer(val) -> val
      _ -> nil
    end
  end
end
