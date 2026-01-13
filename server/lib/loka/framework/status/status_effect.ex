defmodule Loka.Framework.Status.StatusEffect do
  @moduledoc """
  Status effect definition for buffs, debuffs, and conditions.

  Status effects represent temporary (or permanent) modifiers applied to
  entities. They can deal damage, heal, modify stats, prevent actions,
  and more. Effects can trigger at various times during gameplay.

  ## Status Types

  - `:buff` - Positive effect
  - `:debuff` - Negative effect
  - `:neutral` - Neither positive nor negative

  ## Effect Triggers

  - `:on_apply` - When first applied
  - `:on_remove` - When removed/expires
  - `:on_turn_start` - Each turn start
  - `:on_turn_end` - Each turn end
  - `:on_damage_taken` - When receiving damage
  - `:on_damage_dealt` - When dealing damage
  - `:on_ability_use` - When using any ability
  - `:passive` - Constant effect (stat modifiers)

  ## Effect Actions

  - `:damage` - Deal damage {amount, damage_type}
  - `:heal` - Restore HP {amount}
  - `:stat_modify` - Modify stat {stat, modifier}
  - `:resource_drain` - Drain resource {resource, amount}
  - `:prevent_action` - Prevent action type (stun, silence)
  - `:reflect_damage` - Reflect % of damage taken
  - `:immunity` - Immune to damage type or status

  ## Action Modifiers (Evennia-inspired)

  Status effects can modify available entity actions:

  - `removes_actions` - List of action keys to block (Remove merge)
  - `grants_actions` - List of action maps to grant (Union merge)
  - `replaces_all_actions` - If true, completely replaces all actions (Replace merge)

  ### Example: Stun (blocks movement and attacks)

      key: stunned
      name: Stunned
      type: debuff
      duration: 2
      removes_actions:
        - attack
        - move
        - cast

  ### Example: Transformation (replaces all actions)

      key: werewolf_form
      name: Werewolf Form
      type: buff
      replaces_all_actions: true
      grants_actions:
        - key: bite
          label: Bite
          priority: 100
        - key: claw
          label: Claw
          priority: 90
        - key: howl
          label: Howl
          priority: 80
  """

  alias Loka.Utils.MapHelpers

  @type status_type :: :buff | :debuff | :neutral
  @type trigger ::
          :on_apply
          | :on_remove
          | :on_turn_start
          | :on_turn_end
          | :on_damage_taken
          | :on_damage_dealt
          | :on_ability_use
          | :passive

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          type: status_type(),
          duration: non_neg_integer() | nil,
          stackable: boolean(),
          max_stacks: pos_integer(),
          effects: [map()],
          cure_items: [String.t()],
          cure_abilities: [String.t()],
          display_icon: String.t(),
          display_color: String.t(),
          description: String.t(),
          hidden: boolean(),
          exclusive_with: [String.t()],
          tags: [String.t()],
          # Action modifiers (Evennia-inspired)
          removes_actions: [String.t()],
          grants_actions: [map()],
          replaces_all_actions: boolean()
        }

  defstruct [
    :key,
    :name,
    type: :neutral,
    duration: nil,
    stackable: false,
    max_stacks: 1,
    effects: [],
    cure_items: [],
    cure_abilities: [],
    display_icon: "status",
    display_color: "white",
    description: "",
    hidden: false,
    exclusive_with: [],
    tags: [],
    # Action modifiers (Evennia-inspired)
    removes_actions: [],
    grants_actions: [],
    replaces_all_actions: false
  ]

  @valid_types [:buff, :debuff, :neutral]
  @valid_triggers [
    :on_apply,
    :on_remove,
    :on_turn_start,
    :on_turn_end,
    :on_damage_taken,
    :on_damage_dealt,
    :on_ability_use,
    :passive
  ]
  @valid_actions [
    :damage,
    :heal,
    :stat_modify,
    :resource_drain,
    :prevent_action,
    :reflect_damage,
    :immunity,
    :resource_regen
  ]

  # =============================================================================
  # Struct Creation
  # =============================================================================

  @doc """
  Creates a StatusEffect struct from a map (typically loaded from YAML).

  Returns `{:ok, status_effect}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, :key),
         {:ok, name} <- require_field(data, :name) do
      status = %__MODULE__{
        key: key,
        name: name,
        type: parse_type(data),
        duration: MapHelpers.get_flexible(data, :duration, nil),
        stackable: MapHelpers.get_flexible(data, :stackable, false),
        max_stacks: MapHelpers.get_flexible(data, :max_stacks, 1),
        effects: parse_effects(data),
        cure_items: MapHelpers.get_flexible(data, :cure_items, []),
        cure_abilities: MapHelpers.get_flexible(data, :cure_abilities, []),
        display_icon: MapHelpers.get_flexible(data, :display_icon, "status"),
        display_color: MapHelpers.get_flexible(data, :display_color, "white"),
        description: MapHelpers.get_flexible(data, :description, ""),
        hidden: MapHelpers.get_flexible(data, :hidden, false),
        exclusive_with: MapHelpers.get_flexible(data, :exclusive_with, []),
        tags: MapHelpers.get_flexible(data, :tags, []),
        # Action modifiers (Evennia-inspired)
        removes_actions: MapHelpers.get_flexible(data, :removes_actions, []),
        grants_actions: MapHelpers.get_flexible(data, :grants_actions, []),
        replaces_all_actions: MapHelpers.get_flexible(data, :replaces_all_actions, false)
      }

      {:ok, status}
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

  defp parse_type(data) do
    type_value = MapHelpers.get_flexible(data, :type, :neutral)

    parsed =
      cond do
        is_atom(type_value) -> type_value
        is_binary(type_value) -> String.to_existing_atom(type_value)
        true -> :neutral
      end

    if parsed in @valid_types, do: parsed, else: :neutral
  rescue
    ArgumentError -> :neutral
  end

  defp parse_effects(data) do
    effects = MapHelpers.get_flexible(data, :effects, [])

    Enum.map(effects, fn effect ->
      trigger = parse_atom(Map.get(effect, "trigger") || Map.get(effect, :trigger), :passive)
      action = parse_atom(Map.get(effect, "effect") || Map.get(effect, :effect), :stat_modify)

      effect
      |> Map.put(:trigger, trigger)
      |> Map.put(:action, action)
      |> Map.delete("trigger")
      |> Map.delete("effect")
    end)
  end

  defp parse_atom(value, _default) when is_atom(value), do: value

  defp parse_atom(value, default) when is_binary(value) do
    String.to_existing_atom(value)
  rescue
    ArgumentError -> default
  end

  defp parse_atom(_, default), do: default

  # =============================================================================
  # Utility Functions
  # =============================================================================

  @doc """
  Returns the list of valid status types.
  """
  def valid_types, do: @valid_types

  @doc """
  Returns the list of valid effect triggers.
  """
  def valid_triggers, do: @valid_triggers

  @doc """
  Returns the list of valid effect actions.
  """
  def valid_actions, do: @valid_actions

  @doc """
  Checks if status is permanent (no duration).
  """
  def permanent?(%__MODULE__{duration: nil}), do: true
  def permanent?(%__MODULE__{}), do: false

  @doc """
  Checks if status is a buff.
  """
  def buff?(%__MODULE__{type: :buff}), do: true
  def buff?(%__MODULE__{}), do: false

  @doc """
  Checks if status is a debuff.
  """
  def debuff?(%__MODULE__{type: :debuff}), do: true
  def debuff?(%__MODULE__{}), do: false

  @doc """
  Gets effects for a specific trigger.
  """
  def get_effects_for_trigger(%__MODULE__{effects: effects}, trigger) do
    Enum.filter(effects, fn effect ->
      effect.trigger == trigger
    end)
  end

  @doc """
  Checks if status can be cured by an item.
  """
  def curable_by_item?(%__MODULE__{cure_items: items}, item_key) do
    item_key in items
  end

  @doc """
  Checks if status can be cured by an ability.
  """
  def curable_by_ability?(%__MODULE__{cure_abilities: abilities}, ability_key) do
    ability_key in abilities
  end

  @doc """
  Gets all passive stat modifiers from this status.
  """
  def get_stat_modifiers(%__MODULE__{effects: effects}) do
    effects
    |> Enum.filter(fn effect ->
      effect.trigger == :passive and effect.action == :stat_modify
    end)
    |> Enum.map(fn effect ->
      stat = Map.get(effect, :stat) || Map.get(effect, "stat")
      modifier = Map.get(effect, :modifier) || Map.get(effect, "modifier") || 0
      {stat, modifier}
    end)
  end
end
