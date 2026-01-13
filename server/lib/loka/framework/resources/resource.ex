defmodule Loka.Framework.Resources.Resource do
  @moduledoc """
  Resource type definition for the resource system.

  Resources represent consumable pools like mana, stamina, energy, or any
  custom resource. Each resource type defines how it regenerates and its
  maximum value formula.

  ## Resource Structure

      %Resource{
        key: "mana",
        name: "Mana",
        max_formula: "level * 10 + sta * 2",
        regen_rate: 2,
        regen_condition: :out_of_combat,
        color: "blue",
        description: "Magical energy for casting spells"
      }

  ## Regen Conditions

  - `:always` - Regenerates continuously
  - `:out_of_combat` - Only regenerates when not in combat
  - `:resting` - Only regenerates when resting/meditating
  - `:never` - Never regenerates automatically (must be restored manually)

  ## Max Formula

  Formulas can reference entity stats (level, str, dex, sta, etc.):
  - `"100"` - Fixed value
  - `"level * 10"` - Scales with level
  - `"level * 10 + sta * 2"` - Scales with level and stamina
  """

  alias Loka.Utils.MapHelpers

  @type regen_condition :: :always | :out_of_combat | :resting | :never

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          max_formula: String.t(),
          regen_rate: non_neg_integer(),
          regen_condition: regen_condition(),
          color: String.t(),
          description: String.t(),
          min_value: integer(),
          starts_full: boolean(),
          hidden: boolean()
        }

  defstruct [
    :key,
    :name,
    max_formula: "100",
    regen_rate: 0,
    regen_condition: :always,
    color: "white",
    description: "",
    min_value: 0,
    starts_full: true,
    hidden: false
  ]

  @valid_conditions [:always, :out_of_combat, :resting, :never, :in_combat]

  # =============================================================================
  # Struct Creation
  # =============================================================================

  @doc """
  Creates a Resource struct from a map (typically loaded from YAML).

  Returns `{:ok, resource}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, :key),
         {:ok, name} <- require_field(data, :name) do
      resource = %__MODULE__{
        key: key,
        name: name,
        max_formula: MapHelpers.get_flexible(data, :max_formula, "100"),
        regen_rate: MapHelpers.get_flexible(data, :regen_rate, 0),
        regen_condition: parse_condition(data),
        color: MapHelpers.get_flexible(data, :color, "white"),
        description: MapHelpers.get_flexible(data, :description, ""),
        min_value: MapHelpers.get_flexible(data, :min_value, 0),
        starts_full: MapHelpers.get_flexible(data, :starts_full, true),
        hidden: MapHelpers.get_flexible(data, :hidden, false)
      }

      {:ok, resource}
    end
  end

  defp require_field(data, field) when is_atom(field) do
    value = MapHelpers.get_flexible(data, field, nil)

    if value do
      {:ok, value}
    else
      {:error, {:missing_field, field}}
    end
  end

  defp parse_condition(data) do
    condition = MapHelpers.get_flexible(data, :regen_condition, :always)

    parsed =
      cond do
        is_atom(condition) -> condition
        is_binary(condition) -> String.to_existing_atom(condition)
        true -> :always
      end

    if parsed in @valid_conditions, do: parsed, else: :always
  rescue
    ArgumentError -> :always
  end

  # =============================================================================
  # Utility Functions
  # =============================================================================

  @doc """
  Returns the list of valid regen conditions.
  """
  def valid_conditions, do: @valid_conditions

  @doc """
  Checks if a resource regenerates automatically.
  """
  def regenerates?(%__MODULE__{regen_condition: :never}), do: false
  def regenerates?(%__MODULE__{regen_rate: rate}) when rate > 0, do: true
  def regenerates?(%__MODULE__{}), do: false

  @doc """
  Checks if resource should regenerate given the current context.
  """
  def should_regen?(%__MODULE__{regen_condition: condition}, context) do
    in_combat = Map.get(context, :in_combat, false)
    resting = Map.get(context, :resting, false)

    case condition do
      :always -> true
      :never -> false
      :out_of_combat -> not in_combat
      :in_combat -> in_combat
      :resting -> resting
    end
  end
end
