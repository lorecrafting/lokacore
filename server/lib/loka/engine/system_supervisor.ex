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
end
