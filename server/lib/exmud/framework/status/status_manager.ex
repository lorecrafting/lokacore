defmodule Exmud.Framework.Status.StatusManager do
  @moduledoc """
  Manages active status effects on entities.

  Handles applying, removing, ticking, and querying status effects.
  Status instances are stored per entity in ETS and include duration
  tracking, stacks, and source information.

  ## Active Status Structure

  Each active status on an entity is stored as:

      %{
        status_key: "poisoned",
        stacks: 1,
        remaining_duration: 5,
        source_id: "entity_abc",
        applied_at: DateTime.utc_now()
      }

  ## Usage

      alias Exmud.Framework.Status.StatusManager

      # Apply a status
      StatusManager.apply_status(entity_id, "poisoned", source_id)

      # Check if entity has status
      StatusManager.has?(entity_id, "poisoned")

      # Tick turn-based effects
      results = StatusManager.tick(entity_id, :on_turn_start)

      # Get stat modifiers from all active statuses
      modifiers = StatusManager.get_stat_modifiers(entity_id, :str)
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Status.{StatusEffect, StatusRegistry}

  @active_status_table :exmud_active_statuses

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the StatusManager GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Applies a status effect to an entity.

  Options:
  - `:stacks` - Number of stacks to apply (default: 1)
  - `:duration` - Override duration (default: from status definition)

  Returns `{:ok, active_status}` or `{:error, reason}`.
  """
  def apply_status(entity_id, status_key, source_id, opts \\ []) do
    GenServer.call(__MODULE__, {:apply_status, entity_id, status_key, source_id, opts})
  end

  @doc """
  Removes a status effect from an entity.

  Returns `:ok` or `{:error, :not_found}`.
  """
  def remove_status(entity_id, status_key) do
    GenServer.call(__MODULE__, {:remove_status, entity_id, status_key})
  end

  @doc """
  Removes all status effects from an entity.
  """
  def clear_all(entity_id) do
    GenServer.cast(__MODULE__, {:clear_all, entity_id})
  end

  @doc """
  Checks if an entity has a specific status effect.
  """
  def has?(entity_id, status_key) do
    statuses = get_active(entity_id)
    Enum.any?(statuses, &(&1.status_key == status_key))
  end

  @doc """
  Gets all active status effects for an entity.
  """
  def get_active(entity_id) do
    case :ets.lookup(@active_status_table, entity_id) do
      [{_id, statuses}] -> statuses
      [] -> []
    end
  rescue
    ArgumentError -> []
  end

  @doc """
  Gets the number of stacks for a specific status.
  """
  def get_stacks(entity_id, status_key) do
    statuses = get_active(entity_id)

    case Enum.find(statuses, &(&1.status_key == status_key)) do
      nil -> 0
      active -> active.stacks
    end
  end

  @doc """
  Ticks all status effects for a trigger type.

  Returns a list of effect results (damage, healing, etc.).
  """
  def tick(entity_id, trigger) do
    GenServer.call(__MODULE__, {:tick, entity_id, trigger})
  end

  @doc """
  Ticks duration and removes expired statuses.

  Called at turn end to decrement durations.
  """
  def tick_duration(entity_id) do
    GenServer.call(__MODULE__, {:tick_duration, entity_id})
  end

  @doc """
  Attempts to cure a status with an item or ability.

  Returns `:ok` if cured, `{:error, reason}` otherwise.
  """
  def try_cure(entity_id, status_key, cure_source, cure_type \\ :item) do
    GenServer.call(__MODULE__, {:try_cure, entity_id, status_key, cure_source, cure_type})
  end

  @doc """
  Gets the total stat modifier from all active statuses.

  Returns the sum of all passive stat modifications for the given stat.
  """
  def get_stat_modifiers(entity_id, stat) do
    active_statuses = get_active(entity_id)

    Enum.reduce(active_statuses, 0, fn active, acc ->
      case StatusRegistry.get(active.status_key) do
        {:ok, status} ->
          modifiers = StatusEffect.get_stat_modifiers(status)

          modifier_sum =
            modifiers
            |> Enum.filter(fn {s, _} -> normalize_stat(s) == normalize_stat(stat) end)
            |> Enum.map(fn {_, m} -> m * active.stacks end)
            |> Enum.sum()

          acc + modifier_sum

        {:error, _} ->
          acc
      end
    end)
  end

  @doc """
  Dispels status effects of a specific type or all.

  Returns the number of effects dispelled.
  """
  def dispel(entity_id, type_or_all \\ :all, count \\ :all) do
    GenServer.call(__MODULE__, {:dispel, entity_id, type_or_all, count})
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    table =
      :ets.new(@active_status_table, [
        :set,
        :public,
        :named_table,
        read_concurrency: true
      ])

    {:ok, %{table: table}}
  end

  @impl true
  def handle_call({:apply_status, entity_id, status_key, source_id, opts}, _from, state) do
    result =
      case StatusRegistry.get(status_key) do
        {:error, _} ->
          {:error, :status_not_found}

        {:ok, status} ->
          active_statuses = get_active(entity_id)

          # Check for exclusive statuses
          conflicting =
            Enum.find(active_statuses, fn active ->
              active.status_key in status.exclusive_with
            end)

          if conflicting do
            {:error, {:exclusive_conflict, conflicting.status_key}}
          else
            new_stacks = Keyword.get(opts, :stacks, 1)
            duration = Keyword.get(opts, :duration, status.duration)

            # Check if already has this status
            existing = Enum.find(active_statuses, &(&1.status_key == status_key))

            new_active =
              if existing && status.stackable do
                # Add stacks up to max
                new_stack_count = min(existing.stacks + new_stacks, status.max_stacks)
                %{existing | stacks: new_stack_count, remaining_duration: duration}
              else
                if existing do
                  # Refresh duration
                  %{existing | remaining_duration: duration}
                else
                  # New status
                  %{
                    status_key: status_key,
                    stacks: min(new_stacks, status.max_stacks),
                    remaining_duration: duration,
                    source_id: source_id,
                    applied_at: DateTime.utc_now()
                  }
                end
              end

            # Update active statuses list
            updated_statuses =
              active_statuses
              |> Enum.reject(&(&1.status_key == status_key))
              |> List.insert_at(0, new_active)

            :ets.insert(@active_status_table, {entity_id, updated_statuses})

            # Process on_apply effects if newly applied
            if !existing do
              process_trigger(entity_id, status, new_active, :on_apply)
            end

            {:ok, new_active}
          end
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:remove_status, entity_id, status_key}, _from, state) do
    active_statuses = get_active(entity_id)
    existing = Enum.find(active_statuses, &(&1.status_key == status_key))

    result =
      if existing do
        # Process on_remove effects
        case StatusRegistry.get(status_key) do
          {:ok, status} -> process_trigger(entity_id, status, existing, :on_remove)
          _ -> nil
        end

        updated_statuses = Enum.reject(active_statuses, &(&1.status_key == status_key))
        :ets.insert(@active_status_table, {entity_id, updated_statuses})
        :ok
      else
        {:error, :not_found}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:tick, entity_id, trigger}, _from, state) do
    active_statuses = get_active(entity_id)

    results =
      Enum.flat_map(active_statuses, fn active ->
        case StatusRegistry.get(active.status_key) do
          {:ok, status} ->
            process_trigger(entity_id, status, active, trigger)

          {:error, _} ->
            []
        end
      end)

    {:reply, results, state}
  end

  @impl true
  def handle_call({:tick_duration, entity_id}, _from, state) do
    active_statuses = get_active(entity_id)

    {remaining, expired} =
      Enum.split_with(active_statuses, fn active ->
        case active.remaining_duration do
          nil -> true
          dur when dur > 1 -> true
          _ -> false
        end
      end)

    # Decrement durations
    updated_remaining =
      Enum.map(remaining, fn active ->
        case active.remaining_duration do
          nil -> active
          dur -> %{active | remaining_duration: dur - 1}
        end
      end)

    # Process on_remove for expired
    Enum.each(expired, fn active ->
      case StatusRegistry.get(active.status_key) do
        {:ok, status} -> process_trigger(entity_id, status, active, :on_remove)
        _ -> nil
      end
    end)

    :ets.insert(@active_status_table, {entity_id, updated_remaining})

    {:reply, {:ok, length(expired)}, state}
  end

  @impl true
  def handle_call({:try_cure, entity_id, status_key, cure_source, cure_type}, _from, state) do
    result =
      case StatusRegistry.get(status_key) do
        {:error, _} ->
          {:error, :status_not_found}

        {:ok, status} ->
          can_cure =
            case cure_type do
              :item -> StatusEffect.curable_by_item?(status, cure_source)
              :ability -> StatusEffect.curable_by_ability?(status, cure_source)
              _ -> false
            end

          if can_cure do
            GenServer.call(__MODULE__, {:remove_status, entity_id, status_key})
          else
            {:error, :cannot_cure}
          end
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:dispel, entity_id, type_or_all, count}, _from, state) do
    active_statuses = get_active(entity_id)

    to_dispel =
      if type_or_all == :all do
        active_statuses
      else
        Enum.filter(active_statuses, fn active ->
          case StatusRegistry.get(active.status_key) do
            {:ok, status} -> status.type == type_or_all
            _ -> false
          end
        end)
      end

    to_dispel =
      if count == :all do
        to_dispel
      else
        Enum.take(to_dispel, count)
      end

    dispelled_keys = Enum.map(to_dispel, & &1.status_key)

    # Process on_remove for dispelled
    Enum.each(to_dispel, fn active ->
      case StatusRegistry.get(active.status_key) do
        {:ok, status} -> process_trigger(entity_id, status, active, :on_remove)
        _ -> nil
      end
    end)

    remaining = Enum.reject(active_statuses, &(&1.status_key in dispelled_keys))
    :ets.insert(@active_status_table, {entity_id, remaining})

    {:reply, {:ok, length(dispelled_keys)}, state}
  end

  @impl true
  def handle_cast({:clear_all, entity_id}, state) do
    :ets.delete(@active_status_table, entity_id)
    {:noreply, state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp process_trigger(_entity_id, status, active, trigger) do
    effects = StatusEffect.get_effects_for_trigger(status, trigger)

    Enum.map(effects, fn effect ->
      process_effect(effect, active)
    end)
  end

  defp process_effect(effect, active) do
    action = effect.action

    base_result = %{
      action: action,
      status_key: active.status_key,
      stacks: active.stacks
    }

    case action do
      :damage ->
        amount = (Map.get(effect, :amount) || 0) * active.stacks
        damage_type = Map.get(effect, :damage_type) || :physical
        Map.merge(base_result, %{amount: amount, damage_type: damage_type})

      :heal ->
        amount = (Map.get(effect, :amount) || 0) * active.stacks
        Map.merge(base_result, %{amount: amount})

      :stat_modify ->
        stat = Map.get(effect, :stat)
        modifier = (Map.get(effect, :modifier) || 0) * active.stacks
        Map.merge(base_result, %{stat: stat, modifier: modifier})

      :resource_drain ->
        resource = Map.get(effect, :resource)
        amount = (Map.get(effect, :amount) || 0) * active.stacks
        Map.merge(base_result, %{resource: resource, amount: amount})

      :prevent_action ->
        action_type = Map.get(effect, :action_type)
        Map.merge(base_result, %{prevented: action_type})

      :reflect_damage ->
        percentage = Map.get(effect, :percentage) || 0
        Map.merge(base_result, %{percentage: percentage})

      :immunity ->
        immune_to = Map.get(effect, :immune_to)
        Map.merge(base_result, %{immune_to: immune_to})

      :resource_regen ->
        resource = Map.get(effect, :resource)
        amount = (Map.get(effect, :amount) || 0) * active.stacks
        Map.merge(base_result, %{resource: resource, amount: amount})

      _ ->
        base_result
    end
  end

  defp normalize_stat(stat) when is_atom(stat), do: stat
  defp normalize_stat(stat) when is_binary(stat), do: String.to_atom(stat)
  defp normalize_stat(_), do: :unknown
end
