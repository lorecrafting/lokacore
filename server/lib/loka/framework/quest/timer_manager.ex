defmodule Loka.Framework.Quest.TimerManager do
  @moduledoc """
  Manages timed quest objectives with expiration tracking.

  V2: Stateless module — timer data is stored in the player entity's
  `quest_progress` component alongside objective data. No ETS, no GenServer.

  Timer fields are embedded in objective data:

      entity.components["quest_progress"]["active"]["quest_id"]["objectives"]["obj_id"] = %{
        "completed" => false,
        "progress" => 0,
        "expires_at" => 1739712600,     # Unix timestamp (UTC seconds)
        "time_limit" => 300,            # Original limit in seconds
        "warned" => [60, 30]            # Warning intervals already sent
      }

  ## Usage

      TimerManager.start_objective_timer(entity, quest_id, objective_id, time_limit)
      TimerManager.cancel_objective_timer(entity, quest_id, objective_id)
      TimerManager.get_remaining_time(entity, quest_id, objective_id)
      TimerManager.is_expired?(entity, quest_id, objective_id)

  ## Events

  The TimerManager broadcasts events via PubSub:

  - `{:objective_warning, quest_id, objective_id, seconds_remaining}` - Warning before expiration
  - `{:objective_expired, quest_id, objective_id}` - Objective time limit reached

  Subscribe to receive notifications:

      Phoenix.PubSub.subscribe(Loka.PubSub, "quest_timer:\#{player_id}")
  """

  require Logger

  alias Loka.Engine.Entity
  alias Loka.Framework.Quest.StateHelper

  # Seconds before expiration to send warnings
  @warning_intervals [60, 30, 10]

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Starts a timer for a timed objective.

  Updates the objective data in the entity's quest_progress component with
  timer fields (expires_at, time_limit).

  Returns `{:ok, updated_entity, expires_at}` on success.
  """
  def start_objective_timer(%Entity{} = entity, quest_id, objective_id, time_limit, opts \\ []) do
    started_at = Keyword.get(opts, :started_at, DateTime.utc_now())
    expires_at_dt = DateTime.add(started_at, time_limit, :second)
    expires_at_unix = DateTime.to_unix(expires_at_dt, :second)

    case update_objective_field(entity, quest_id, objective_id, fn obj_data ->
           obj_data
           |> Map.put("expires_at", expires_at_unix)
           |> Map.put("time_limit", time_limit)
           |> Map.put("warned", [])
         end) do
      {:ok, updated_entity} ->
        Logger.debug(
          "[TimerManager] Started timer for #{quest_id}/#{objective_id}, expires in #{time_limit}s"
        )

        {:ok, updated_entity, expires_at_dt}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Cancels a timer for an objective (e.g., when completed).

  Removes timer fields from the objective data.

  Returns `{:ok, updated_entity}`.
  """
  def cancel_objective_timer(%Entity{} = entity, quest_id, objective_id) do
    case update_objective_field(entity, quest_id, objective_id, fn obj_data ->
           obj_data
           |> Map.delete("expires_at")
           |> Map.delete("time_limit")
           |> Map.delete("warned")
         end) do
      {:ok, updated_entity} ->
        Logger.debug("[TimerManager] Cancelled timer for #{quest_id}/#{objective_id}")
        {:ok, updated_entity}

      {:error, _reason} ->
        # Timer may not exist, that's fine
        {:ok, entity}
    end
  end

  @doc """
  Gets remaining time for an objective in seconds.

  Returns `nil` if no timer exists, or the number of seconds remaining.
  """
  def get_remaining_time(%Entity{} = entity, quest_id, objective_id) do
    case get_objective_data(entity, quest_id, objective_id) do
      nil ->
        nil

      obj_data ->
        case Map.get(obj_data, "expires_at") do
          nil -> nil
          expires_at -> max(0, expires_at - System.os_time(:second))
        end
    end
  end

  @doc """
  Checks if an objective has expired.
  """
  def is_expired?(%Entity{} = entity, quest_id, objective_id) do
    case get_remaining_time(entity, quest_id, objective_id) do
      nil -> false
      remaining -> remaining <= 0
    end
  end

  @doc """
  Gets the expiration time for an objective as a DateTime.

  Returns `{:ok, expires_at}` or `{:error, :not_found}`.
  """
  def get_expires_at(%Entity{} = entity, quest_id, objective_id) do
    case get_objective_data(entity, quest_id, objective_id) do
      nil ->
        {:error, :not_found}

      obj_data ->
        case Map.get(obj_data, "expires_at") do
          nil -> {:error, :not_found}
          expires_at -> {:ok, DateTime.from_unix!(expires_at, :second)}
        end
    end
  end

  @doc """
  Gets all active timers for a player entity.

  Returns a list of timer info maps.
  """
  def get_player_timers(%Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)
    now = System.os_time(:second)

    Enum.flat_map(active, fn {quest_id, quest_data} ->
      objectives = StateHelper.get_objectives(quest_data)

      objectives
      |> Enum.filter(fn {_obj_id, obj_data} ->
        Map.has_key?(obj_data, "expires_at")
      end)
      |> Enum.map(fn {obj_id, obj_data} ->
        expires_at = obj_data["expires_at"]
        remaining = max(0, expires_at - now)

        %{
          player_id: entity.account_id,
          quest_id: quest_id,
          objective_id: obj_id,
          time_limit: obj_data["time_limit"],
          expires_at: DateTime.from_unix!(expires_at, :second),
          remaining_seconds: remaining
        }
      end)
    end)
  end

  @doc """
  Clears all timers for all quests on a player entity.

  Returns `{:ok, updated_entity}`.
  """
  def clear_player_timers(%Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)

    new_active =
      Map.new(active, fn {quest_id, quest_data} ->
        {quest_id, clear_timers_from_quest(quest_data)}
      end)

    new_quests = Map.put(quests, "active", new_active)
    {:ok, Entity.add_component(entity, "quest_progress", new_quests)}
  end

  @doc """
  Clears all timers for a specific quest.

  Returns `{:ok, updated_entity}`.
  """
  def clear_quest_timers(%Entity{} = entity, quest_id) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)

    case Map.get(active, quest_id) do
      nil ->
        {:ok, entity}

      quest_data ->
        cleaned = clear_timers_from_quest(quest_data)
        new_active = Map.put(active, quest_id, cleaned)
        new_quests = Map.put(quests, "active", new_active)
        {:ok, Entity.add_component(entity, "quest_progress", new_quests)}
    end
  end

  @doc """
  Checks timers on an entity and sends any pending warnings/expirations.

  Call this on player reconnect to reschedule warnings for active timed objectives.

  Returns `{:ok, updated_entity}` with warned fields updated.
  """
  def check_and_warn(%Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)
    now = System.os_time(:second)
    player_id = entity.account_id

    {new_active, _} =
      Enum.reduce(active, {%{}, false}, fn {quest_id, quest_data}, {acc, changed} ->
        objectives = StateHelper.get_objectives(quest_data)

        {new_objectives, obj_changed} =
          Enum.reduce(objectives, {%{}, false}, fn {obj_id, obj_data}, {obj_acc, oc} ->
            case Map.get(obj_data, "expires_at") do
              nil ->
                {Map.put(obj_acc, obj_id, obj_data), oc}

              expires_at ->
                remaining = expires_at - now

                if remaining <= 0 do
                  # Expired — broadcast and mark
                  broadcast_expired(player_id, quest_id, obj_id)

                  updated =
                    obj_data
                    |> Map.put("expired", true)
                    |> Map.delete("expires_at")
                    |> Map.delete("time_limit")
                    |> Map.delete("warned")

                  {Map.put(obj_acc, obj_id, updated), true}
                else
                  # Check warnings
                  already_warned = Map.get(obj_data, "warned", [])

                  new_warnings =
                    @warning_intervals
                    |> Enum.filter(fn interval ->
                      remaining <= interval && interval not in already_warned
                    end)

                  if Enum.empty?(new_warnings) do
                    {Map.put(obj_acc, obj_id, obj_data), oc}
                  else
                    Enum.each(new_warnings, fn _interval ->
                      broadcast_warning(player_id, quest_id, obj_id, remaining)
                    end)

                    updated = Map.put(obj_data, "warned", already_warned ++ new_warnings)
                    {Map.put(obj_acc, obj_id, updated), true}
                  end
                end
            end
          end)

        new_quest_data = Map.put(quest_data, "objectives", new_objectives)
        {Map.put(acc, quest_id, new_quest_data), changed || obj_changed}
      end)

    new_quests = Map.put(quests, "active", new_active)
    {:ok, Entity.add_component(entity, "quest_progress", new_quests)}
  end

  @doc "Returns the default warning intervals."
  def warning_intervals, do: @warning_intervals

  # =============================================================================
  # Private
  # =============================================================================

  defp get_objective_data(entity, quest_id, objective_id) do
    get_in(entity.components, ["quest_progress", "active", quest_id, "objectives", objective_id])
  end

  defp update_objective_field(entity, quest_id, objective_id, update_fn) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)

    case get_in(active, [quest_id, "objectives", objective_id]) do
      nil ->
        {:error, :objective_not_found}

      obj_data ->
        updated_obj = update_fn.(obj_data)

        new_active =
          put_in(active, [quest_id, "objectives", objective_id], updated_obj)

        new_quests = Map.put(quests, "active", new_active)
        {:ok, Entity.add_component(entity, "quest_progress", new_quests)}
    end
  end

  defp clear_timers_from_quest(quest_data) do
    objectives = StateHelper.get_objectives(quest_data)

    cleaned_objectives =
      Map.new(objectives, fn {obj_id, obj_data} ->
        cleaned =
          obj_data
          |> Map.delete("expires_at")
          |> Map.delete("time_limit")
          |> Map.delete("warned")

        {obj_id, cleaned}
      end)

    Map.put(quest_data, "objectives", cleaned_objectives)
  end

  defp broadcast_warning(player_id, quest_id, objective_id, remaining) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "quest_timer:#{player_id}",
      {:objective_warning, quest_id, objective_id, remaining}
    )
  end

  defp broadcast_expired(player_id, quest_id, objective_id) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "quest_timer:#{player_id}",
      {:objective_expired, quest_id, objective_id}
    )

    Loka.Admin.GameLog.Quest.log_objective_expired(player_id, quest_id, objective_id, 0)

    Logger.info(
      "[TimerManager] Objective #{quest_id}/#{objective_id} expired for player #{player_id}"
    )
  end
end
