defmodule Exmud.Framework.Abilities.Ability do
  @moduledoc """
  Core ability struct and execution logic for the ability system.

  Abilities represent any action a character can perform: spells, tech powers,
  martial arts techniques, mantras, psionics, etc. They are generic enough to
  be themed for any game world.

  ## Ability Structure

      %Ability{
        key: "fireball",
        name: "Fireball",
        type: :offensive,
        cost: %{mana: 15},
        cooldown: 3,
        target: :enemy,
        effects: [%{type: :damage, amount: 25, damage_type: :fire}],
        requirements: %{level: 5, skills: ["fire_magic"]},
        description: "Hurls a ball of flame at the target.",
        cast_message: "You conjure flames and hurl them at {target}!"
      }

  ## Ability Types

  - `:offensive` - Deals damage or applies harmful effects
  - `:defensive` - Protects, heals, or removes negative effects
  - `:utility` - Teleportation, buffs, summons, etc.
  - `:passive` - Always-active abilities that modify stats

  ## Target Types

  - `:self` - Can only target the caster
  - `:ally` - Can target friendly entities
  - `:enemy` - Can target hostile entities
  - `:area` - Affects all entities in range
  - `:room` - Affects the entire room

  ## Usage

      alias Exmud.Framework.Abilities.Ability

      # Check if entity can use ability
      case Ability.can_use?(entity, ability, target, game_state) do
        :ok -> # Proceed
        {:error, reason} -> # Handle error
      end

      # Execute ability
      case Ability.use(entity, ability, target, game_state) do
        {:ok, results} -> # Apply results
        {:error, reason} -> # Handle failure
      end
  """

  alias Exmud.Framework.Abilities.{AbilityEffects, AbilityCooldowns}
  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @type ability_type :: :offensive | :defensive | :utility | :passive
  @type target_type :: :self | :ally | :enemy | :area | :room

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          type: ability_type(),
          cost: map(),
          cooldown: non_neg_integer(),
          target: target_type(),
          effects: [map()],
          requirements: map(),
          description: String.t(),
          cast_message: String.t(),
          fail_message: String.t(),
          room_interactions: map(),
          tags: [String.t()]
        }

  defstruct [
    :key,
    :name,
    type: :offensive,
    cost: %{},
    cooldown: 0,
    target: :enemy,
    effects: [],
    requirements: %{},
    description: "",
    cast_message: "",
    fail_message: "",
    room_interactions: %{},
    tags: []
  ]

  @valid_types [:offensive, :defensive, :utility, :passive]
  @valid_targets [:self, :ally, :enemy, :area, :room]

  # =============================================================================
  # Struct Creation
  # =============================================================================

  @doc """
  Creates an Ability struct from a map (typically loaded from YAML).

  Returns `{:ok, ability}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, "key"),
         {:ok, name} <- require_field(data, "name") do
      ability = %__MODULE__{
        key: key,
        name: name,
        type: parse_type(data),
        cost: parse_cost(data),
        cooldown: MapHelpers.get_flexible(data, :cooldown, 0),
        target: parse_target(data),
        effects: parse_effects(data),
        requirements: parse_requirements(data),
        description: MapHelpers.get_flexible(data, :description, ""),
        cast_message: MapHelpers.get_flexible(data, :cast_message, ""),
        fail_message: MapHelpers.get_flexible(data, :fail_message, ""),
        room_interactions: MapHelpers.get_flexible(data, :room_interactions, %{}),
        tags: MapHelpers.get_flexible(data, :tags, [])
      }

      {:ok, ability}
    end
  end

  defp require_field(data, field) do
    value = MapHelpers.get_flexible(data, String.to_atom(field), nil)

    if value do
      {:ok, value}
    else
      {:error, {:missing_field, field}}
    end
  end

  defp parse_type(data) do
    type_value = MapHelpers.get_flexible(data, :type, :offensive)

    type =
      cond do
        is_atom(type_value) -> type_value
        is_binary(type_value) -> String.to_existing_atom(type_value)
        true -> :offensive
      end

    if type in @valid_types, do: type, else: :offensive
  rescue
    ArgumentError -> :offensive
  end

  defp parse_target(data) do
    target_value = MapHelpers.get_flexible(data, :target, :enemy)

    target =
      cond do
        is_atom(target_value) -> target_value
        is_binary(target_value) -> String.to_existing_atom(target_value)
        true -> :enemy
      end

    if target in @valid_targets, do: target, else: :enemy
  rescue
    ArgumentError -> :enemy
  end

  defp parse_cost(data) do
    MapHelpers.get_flexible(data, :cost, %{})
  end

  defp parse_effects(data) do
    effects = MapHelpers.get_flexible(data, :effects, [])

    Enum.map(effects, fn effect ->
      # Ensure effect type is an atom
      effect_type = Map.get(effect, "type") || Map.get(effect, :type)

      type =
        cond do
          is_atom(effect_type) -> effect_type
          is_binary(effect_type) -> String.to_existing_atom(effect_type)
          true -> :unknown
        end

      effect
      |> Map.put(:type, type)
      |> Map.delete("type")
    end)
  rescue
    ArgumentError -> []
  end

  defp parse_requirements(data) do
    MapHelpers.get_flexible(data, :requirements, %{})
  end

  # =============================================================================
  # Ability Usage
  # =============================================================================

  @doc """
  Checks if an entity can use an ability on a target.

  Returns `:ok` or `{:error, reason}`.

  ## Checks Performed

  1. Requirements met (level, skills)
  2. Resources available (mana, stamina, etc.)
  3. Not on cooldown
  4. Valid target for ability type
  """
  def can_use?(entity_id, %__MODULE__{} = ability, target, %GameState{} = game_state) do
    with :ok <- check_requirements(ability, game_state),
         :ok <- check_resources(ability, game_state),
         :ok <- check_cooldown(entity_id, ability),
         :ok <- check_target(ability, target) do
      :ok
    end
  end

  @doc """
  Uses an ability, consuming resources and applying effects.

  Returns `{:ok, results}` or `{:error, reason}`.

  The `results` map contains:
  - `:effects` - List of effect results
  - `:message` - The cast message with substitutions
  - `:cost_paid` - Resources consumed
  """
  def use(entity_id, %__MODULE__{} = ability, target, %GameState{} = game_state) do
    case can_use?(entity_id, ability, target, game_state) do
      :ok ->
        # Start cooldown
        AbilityCooldowns.start_cooldown(entity_id, ability.key, ability.cooldown)

        # Apply effects
        effect_results = apply_effects(ability, entity_id, target, game_state)

        # Build result
        message = format_cast_message(ability, target)

        result = %{
          effects: effect_results,
          message: message,
          cost: ability.cost,
          ability_key: ability.key
        }

        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # =============================================================================
  # Validation Checks
  # =============================================================================

  defp check_requirements(%__MODULE__{requirements: reqs}, %GameState{} = game_state)
       when map_size(reqs) == 0 do
    _ = game_state
    :ok
  end

  defp check_requirements(%__MODULE__{requirements: reqs}, %GameState{} = game_state) do
    # Check level requirement
    required_level = MapHelpers.get_flexible(reqs, :level, 1)
    player_level = MapHelpers.get_flexible(game_state.stats, :level, 1)

    cond do
      player_level < required_level ->
        {:error, {:level_required, required_level}}

      not skills_met?(reqs, game_state) ->
        {:error, :missing_skills}

      true ->
        :ok
    end
  end

  defp skills_met?(reqs, game_state) do
    required_skills = MapHelpers.get_flexible(reqs, :skills, [])

    if Enum.empty?(required_skills) do
      true
    else
      player_skills = MapHelpers.get_flexible(game_state.stats, :skills, [])
      Enum.all?(required_skills, &(&1 in player_skills))
    end
  end

  defp check_resources(%__MODULE__{cost: cost}, %GameState{} = _game_state)
       when map_size(cost) == 0 do
    :ok
  end

  defp check_resources(%__MODULE__{cost: cost}, %GameState{} = game_state) do
    # Check each resource type
    Enum.reduce_while(cost, :ok, fn {resource_type, amount}, _acc ->
      current = get_resource(game_state, resource_type)

      if current >= amount do
        {:cont, :ok}
      else
        {:halt, {:error, {:insufficient_resource, resource_type, amount, current}}}
      end
    end)
  end

  defp get_resource(%GameState{} = game_state, resource_type) do
    resource_key =
      if is_atom(resource_type), do: resource_type, else: String.to_existing_atom(resource_type)

    # Check in stats first, then in dedicated resource fields
    MapHelpers.get_flexible(game_state.stats, resource_key, 0)
  rescue
    ArgumentError -> 0
  end

  defp check_cooldown(entity_id, %__MODULE__{key: key}) do
    case AbilityCooldowns.get_cooldown(entity_id, key) do
      0 -> :ok
      remaining -> {:error, {:on_cooldown, remaining}}
    end
  end

  defp check_target(%__MODULE__{target: target_type}, target) do
    case {target_type, target} do
      {:self, _} -> :ok
      {:ally, nil} -> {:error, :target_required}
      {:enemy, nil} -> {:error, :target_required}
      {:area, _} -> :ok
      {:room, _} -> :ok
      {_, _} -> :ok
    end
  end

  # =============================================================================
  # Effect Application
  # =============================================================================

  defp apply_effects(%__MODULE__{effects: effects}, caster_id, target, game_state) do
    Enum.map(effects, fn effect ->
      AbilityEffects.apply_effect(effect, caster_id, target, game_state)
    end)
  end

  defp format_cast_message(%__MODULE__{cast_message: message}, target) do
    target_name =
      case target do
        nil -> "the air"
        %{name: name} -> name
        name when is_binary(name) -> name
        _ -> "the target"
      end

    String.replace(message, "{target}", target_name)
  end

  # =============================================================================
  # Utility Functions
  # =============================================================================

  @doc """
  Returns the list of valid ability types.
  """
  def valid_types, do: @valid_types

  @doc """
  Returns the list of valid target types.
  """
  def valid_targets, do: @valid_targets

  @doc """
  Checks if an ability is passive.
  """
  def passive?(%__MODULE__{type: :passive}), do: true
  def passive?(%__MODULE__{}), do: false

  @doc """
  Checks if an ability has a cooldown.
  """
  def has_cooldown?(%__MODULE__{cooldown: cd}) when cd > 0, do: true
  def has_cooldown?(%__MODULE__{}), do: false

  @doc """
  Checks if an ability has any cost.
  """
  def has_cost?(%__MODULE__{cost: cost}) when map_size(cost) > 0, do: true
  def has_cost?(%__MODULE__{}), do: false
end
