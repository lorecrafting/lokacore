defmodule Loka.Engine.PluginSupervisor do
  @moduledoc """
  DynamicSupervisor for plugin children.

  Plugins can add GenServers to this supervisor via the `children/0` callback.
  Children are started by PluginLoader during plugin initialization.

  ## Usage

  Plugins don't interact with this module directly. Instead, they declare
  children in their plugin module:

      defmodule MyPlugin do
        use Loka.Engine.Plugin

        def children do
          [
            MyPlugin.GuildRegistry,
            {MyPlugin.TerritoryManager, interval: 5000}
          ]
        end
      end

  The PluginLoader starts these children automatically.
  """

  use DynamicSupervisor

  @doc """
  Starts the PluginSupervisor.
  """
  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc """
  Starts a child process under this supervisor.

  Returns `{:ok, pid}` or `{:error, reason}`.
  """
  def start_child(child_spec) do
    DynamicSupervisor.start_child(__MODULE__, child_spec)
  end

  @doc """
  Stops a child process.
  """
  def stop_child(pid) when is_pid(pid) do
    DynamicSupervisor.terminate_child(__MODULE__, pid)
  end

  @doc """
  Lists all children under this supervisor.
  """
  def children do
    DynamicSupervisor.which_children(__MODULE__)
  end

  @doc """
  Returns the count of children.
  """
  def count_children do
    DynamicSupervisor.count_children(__MODULE__)
  end
end
