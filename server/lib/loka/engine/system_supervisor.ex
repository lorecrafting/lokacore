defmodule Loka.Engine.SystemSupervisor do
  @moduledoc """
  DynamicSupervisor for system entities (weather, day_night, etc.).

  System entities are long-lived processes that run game systems. They are
  separate from EntitySupervisor (which manages regular entities with
  `:transient` restart).

  System entities are tagged with `auto_start` and started at boot time
  after EntitySeeder runs.

  ## Restart Policy

  `max_restarts: 5, max_seconds: 60` — system entities should NOT crash-loop.
  If a system entity crashes 5 times in 60 seconds, the supervisor stops.
  """

  use DynamicSupervisor
  require Logger

  alias Loka.Engine.{Entities, EntityRegistry}

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    DynamicSupervisor.start_link(__MODULE__, opts, name: name)
  end

  @impl true
  def init(_opts) do
    DynamicSupervisor.init(
      strategy: :one_for_one,
      max_restarts: 5,
      max_seconds: 60
    )
  end

  @doc """
  Starts a child process under this supervisor.
  """
  def start_child(child_spec, supervisor \\ __MODULE__) do
    DynamicSupervisor.start_child(supervisor, child_spec)
  end

  @doc """
  Lists all running children.
  """
  def which_children(supervisor \\ __MODULE__) do
    DynamicSupervisor.which_children(supervisor)
  end

  @doc """
  Returns the count of running children.
  """
  def count_children(supervisor \\ __MODULE__) do
    DynamicSupervisor.count_children(supervisor)
  end

  @doc """
  Boots all system entities tagged with `auto_start`.

  Called after EntitySeeder runs. Queries for entities with the `auto_start` tag,
  sorts by `components["service"]["boot_priority"]` (lower = first), and starts
  each one under this supervisor via EntityServer.

  Also cleans up stale `online` tags from previous boot.
  """
  def boot_system_entities do
    # Clean up stale online tags from previous boot
    cleanup_stale_online_tags()

    # Find all auto_start entities
    entities = Entities.find_all(tags: ["auto_start"])

    # Sort by boot_priority (lower = first, nil = last)
    sorted =
      Enum.sort_by(entities, fn entity ->
        get_in(entity.components || %{}, ["service", "boot_priority"]) || 999
      end)

    Logger.info("[SystemSupervisor] Booting #{length(sorted)} system entities")

    results =
      Enum.map(sorted, fn entity ->
        case EntityRegistry.get_or_start(entity.id) do
          {:ok, pid} ->
            Logger.info(
              "[SystemSupervisor] Started #{entity.key} (#{entity.id}) -> #{inspect(pid)}"
            )

            {:ok, entity.key}

          {:error, reason} ->
            Logger.error("[SystemSupervisor] Failed to start #{entity.key}: #{inspect(reason)}")
            {:error, entity.key, reason}
        end
      end)

    started = Enum.count(results, &match?({:ok, _}, &1))
    failed = Enum.count(results, &match?({:error, _, _}, &1))

    if failed > 0 do
      Logger.warning("[SystemSupervisor] Boot complete: #{started} started, #{failed} failed")
    else
      Logger.info("[SystemSupervisor] Boot complete: #{started} system entities started")
    end

    :ok
  end

  defp cleanup_stale_online_tags do
    Entities.find_all(tags: ["online"])
    |> Enum.each(fn entity ->
      Entities.remove_tag(entity.id, "online")
    end)
  end
end
