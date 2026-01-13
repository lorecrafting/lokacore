defmodule Loka.Framework.Resources.ResourceTicker do
  @moduledoc """
  Periodically ticks resource regeneration for all entities.

  Runs every second by default and triggers resource regeneration
  for all entities in the ResourcePool. After regeneration, broadcasts
  updated resource pools to player PubSub topics.
  """

  use GenServer
  require Logger

  alias Loka.Framework.Resources.ResourcePool

  @tick_interval 1_000
  @pool_table :loka_resource_pools
  @previous_pools_table :loka_resource_pools_previous

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @impl true
  def init(_opts) do
    :ets.new(@previous_pools_table, [:set, :public, :named_table])
    schedule_tick()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:tick, state) do
    context = %{in_combat: false, resting: false}
    ResourcePool.tick_all_regen(context)

    # Broadcast updated pools to all registered players
    broadcast_updates()

    schedule_tick()
    {:noreply, state}
  end

  defp schedule_tick do
    Process.send_after(self(), :tick, @tick_interval)
  end

  defp broadcast_updates do
    try do
      :ets.tab2list(@pool_table)
      |> Enum.each(fn {entity_id, pools} ->
        previous_pools =
          case :ets.lookup(@previous_pools_table, entity_id) do
            [{^entity_id, prev}] -> prev
            [] -> nil
          end

        if pools != previous_pools do
          Phoenix.PubSub.broadcast(
            Loka.PubSub,
            "player:#{entity_id}",
            {:resources_updated, pools}
          )

          :ets.insert(@previous_pools_table, {entity_id, pools})
        end
      end)
    rescue
      ArgumentError -> :ok
    end
  end
end
