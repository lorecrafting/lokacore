defmodule Loka.Framework.Combat.CombatSupervisor do
  @moduledoc """
  DynamicSupervisor for combat GenServer processes.

  Each active combat session gets its own supervised process,
  allowing combat state to persist across LiveView reconnections.
  """

  use DynamicSupervisor

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: Loka.CombatSupervisor)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
