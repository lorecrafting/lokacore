defmodule Exmud.Framework.Abilities.AbilityEffects do
  @moduledoc """
  Effect type implementations for the ability system.

  Each effect type represents a different kind of action an ability can perform:
  damage, healing, status effects, buffs, teleportation, etc.

  ## Effect Types

  1. `damage` - Deal damage (amount, damage_type)
  2. `heal` - Restore HP (amount)
  3. `status` - Apply status effect (status_key, duration)
  4. `buff` - Temporary stat bonus (stat, modifier, duration)
  5. `debuff` - Temporary stat penalty
  6. `teleport` - Move to location (room_key)
  7. `summon` - Spawn entity (prototype_key)
  8. `transform` - Change form (form_key, duration)
  9. `dispel` - Remove effects (effect_type or :all)
  10. `resource` - Modify resource (resource_type, amount)

  ## Effect Structure

  Effects are maps with at minimum a `:type` key:

      %{type: :damage, amount: 25, damage_type: :fire}
      %{type: :heal, amount: 50}
      %{type: :status, status: :burning, duration: 3}
      %{type: :buff, stat: :strength, modifier: 5, duration: 10}

  ## Usage

      alias Exmud.Framework.Abilities.AbilityEffects

      effect = %{type: :damage, amount: 25, damage_type: :fire}
      result = AbilityEffects.apply_effect(effect, caster_id, target, game_state)
  """

  alias Exmud.Utils.MapHelpers

  @effect_types [
    :damage,
    :heal,
    :status,
    :buff,
    :debuff,
    :teleport,
    :summon,
    :transform,
    :dispel,
    :resource
  ]

  # =============================================================================
  # Effect Application
  # =============================================================================

  @doc """
  Applies an effect to the target.

  Returns a result map containing the effect outcome.
  """
  def apply_effect(effect, caster_id, target, game_state) do
    effect_type = MapHelpers.get_flexible(effect, :type, :unknown)

    case effect_type do
      :damage -> apply_damage(effect, caster_id, target, game_state)
      :heal -> apply_heal(effect, caster_id, target, game_state)
      :status -> apply_status(effect, caster_id, target, game_state)
      :buff -> apply_buff(effect, caster_id, target, game_state)
      :debuff -> apply_debuff(effect, caster_id, target, game_state)
      :teleport -> apply_teleport(effect, caster_id, target, game_state)
      :summon -> apply_summon(effect, caster_id, target, game_state)
      :transform -> apply_transform(effect, caster_id, target, game_state)
      :dispel -> apply_dispel(effect, caster_id, target, game_state)
      :resource -> apply_resource(effect, caster_id, target, game_state)
      _ -> {:error, {:unknown_effect_type, effect_type}}
    end
  end

  @doc """
  Returns the list of valid effect types.
  """
  def effect_types, do: @effect_types

  # =============================================================================
  # Effect Implementations
  # =============================================================================

  # Applies damage to the target.
  # Effect params: amount, damage_type, scaling, scaling_factor
  defp apply_damage(effect, caster_id, target, game_state) do
    base_amount = MapHelpers.get_flexible(effect, :amount, 0)
    damage_type = MapHelpers.get_flexible(effect, :damage_type, :physical)
    scaling = MapHelpers.get_flexible(effect, :scaling, nil)
    scaling_factor = MapHelpers.get_flexible(effect, :scaling_factor, 0.1)

    # Calculate scaled damage
    final_amount =
      if scaling do
        stat_value = get_caster_stat(caster_id, scaling, game_state)
        base_amount + trunc(stat_value * scaling_factor)
      else
        base_amount
      end

    # Add variance (+/- 10%)
    variance = :rand.uniform(21) - 11
    actual_damage = max(1, trunc(final_amount * (1 + variance / 100)))

    {:ok,
     %{
       type: :damage,
       amount: actual_damage,
       damage_type: damage_type,
       target: target,
       caster: caster_id
     }}
  end

  # Heals the target.
  # Effect params: amount, scaling, scaling_factor
  defp apply_heal(effect, caster_id, target, game_state) do
    base_amount = MapHelpers.get_flexible(effect, :amount, 0)
    scaling = MapHelpers.get_flexible(effect, :scaling, nil)
    scaling_factor = MapHelpers.get_flexible(effect, :scaling_factor, 0.1)

    final_amount =
      if scaling do
        stat_value = get_caster_stat(caster_id, scaling, game_state)
        base_amount + trunc(stat_value * scaling_factor)
      else
        base_amount
      end

    {:ok,
     %{
       type: :heal,
       amount: final_amount,
       target: target,
       caster: caster_id
     }}
  end

  # Applies a status effect to the target.
  # Effect params: status, duration, potency
  defp apply_status(effect, caster_id, target, _game_state) do
    status = MapHelpers.get_flexible(effect, :status, :unknown)
    duration = MapHelpers.get_flexible(effect, :duration, 1)
    potency = MapHelpers.get_flexible(effect, :potency, 1)

    {:ok,
     %{
       type: :status,
       status: status,
       duration: duration,
       potency: potency,
       target: target,
       caster: caster_id
     }}
  end

  # Applies a temporary stat buff to the target.
  # Effect params: stat, modifier, duration
  defp apply_buff(effect, caster_id, target, _game_state) do
    stat = MapHelpers.get_flexible(effect, :stat, :unknown)
    modifier = MapHelpers.get_flexible(effect, :modifier, 0)
    duration = MapHelpers.get_flexible(effect, :duration, 1)

    {:ok,
     %{
       type: :buff,
       stat: stat,
       modifier: modifier,
       duration: duration,
       target: target,
       caster: caster_id
     }}
  end

  # Applies a temporary stat debuff to the target.
  # Effect params: stat, modifier, duration
  defp apply_debuff(effect, caster_id, target, _game_state) do
    stat = MapHelpers.get_flexible(effect, :stat, :unknown)
    modifier = MapHelpers.get_flexible(effect, :modifier, 0)
    duration = MapHelpers.get_flexible(effect, :duration, 1)

    {:ok,
     %{
       type: :debuff,
       stat: stat,
       modifier: -abs(modifier),
       duration: duration,
       target: target,
       caster: caster_id
     }}
  end

  # Teleports the target to a location.
  # Effect params: room_key, message
  defp apply_teleport(effect, caster_id, target, _game_state) do
    room_key = MapHelpers.get_flexible(effect, :room_key, nil)
    message = MapHelpers.get_flexible(effect, :message, "You are transported elsewhere.")

    if room_key do
      {:ok,
       %{
         type: :teleport,
         room_key: room_key,
         message: message,
         target: target,
         caster: caster_id
       }}
    else
      {:error, :missing_room_key}
    end
  end

  # Summons an entity.
  # Effect params: prototype_key, count, duration, allegiance
  defp apply_summon(effect, caster_id, _target, _game_state) do
    prototype_key = MapHelpers.get_flexible(effect, :prototype_key, nil)
    count = MapHelpers.get_flexible(effect, :count, 1)
    duration = MapHelpers.get_flexible(effect, :duration, nil)
    allegiance = MapHelpers.get_flexible(effect, :allegiance, :friendly)

    if prototype_key do
      {:ok,
       %{
         type: :summon,
         prototype_key: prototype_key,
         count: count,
         duration: duration,
         allegiance: allegiance,
         caster: caster_id
       }}
    else
      {:error, :missing_prototype_key}
    end
  end

  # Transforms the target into a different form.
  # Effect params: form_key, duration, stat_changes
  defp apply_transform(effect, caster_id, target, _game_state) do
    form_key = MapHelpers.get_flexible(effect, :form_key, nil)
    duration = MapHelpers.get_flexible(effect, :duration, 1)
    stat_changes = MapHelpers.get_flexible(effect, :stat_changes, %{})

    if form_key do
      {:ok,
       %{
         type: :transform,
         form_key: form_key,
         duration: duration,
         stat_changes: stat_changes,
         target: target,
         caster: caster_id
       }}
    else
      {:error, :missing_form_key}
    end
  end

  # Removes effects from the target.
  # Effect params: effect_type, count
  defp apply_dispel(effect, caster_id, target, _game_state) do
    effect_type = MapHelpers.get_flexible(effect, :effect_type, :all)
    count = MapHelpers.get_flexible(effect, :count, :all)

    {:ok,
     %{
       type: :dispel,
       effect_type: effect_type,
       count: count,
       target: target,
       caster: caster_id
     }}
  end

  # Modifies a resource (mana, gold, etc.) on the target.
  # Effect params: resource, amount
  defp apply_resource(effect, caster_id, target, _game_state) do
    resource = MapHelpers.get_flexible(effect, :resource, :unknown)
    amount = MapHelpers.get_flexible(effect, :amount, 0)

    {:ok,
     %{
       type: :resource,
       resource: resource,
       amount: amount,
       target: target,
       caster: caster_id
     }}
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp get_caster_stat(_caster_id, stat_name, game_state) do
    # For now, get from game_state stats
    # Later can look up entity stats via EntityServer
    MapHelpers.get_flexible(game_state.stats, stat_name, 10)
  end
end
