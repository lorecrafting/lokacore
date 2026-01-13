defmodule Loka.Engine.EntitySupervisor do
  @moduledoc """
  DynamicSupervisor for EntityServer processes.

  This supervisor manages the lifecycle of active entity processes.
  Entities are started on-demand by the EntityRegistry and stop
  themselves after idle timeout.
  """

  use DynamicSupervisor

  alias Loka.Engine.EntityServer

  @registry_name Loka.Engine.EntityRegistry.Registry

  @doc """
  Starts the EntitySupervisor.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    DynamicSupervisor.start_link(__MODULE__, opts, name: name)
  end

  @impl true
  def init(_opts) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc """
  Starts a new EntityServer for the given entity ID.

  The server is registered with the EntityRegistry.Registry.
  """
  def start_child(entity_id, opts \\ []) do
    supervisor = Keyword.get(opts, :supervisor, __MODULE__)
    registry = Keyword.get(opts, :registry, @registry_name)

    # EntityServer will register itself with the Registry
    child_spec = %{
      id: entity_id,
      start:
        {EntityServer, :start_link, [entity_id, [name: via_tuple(entity_id, registry)] ++ opts]},
      restart: :temporary
    }

    DynamicSupervisor.start_child(supervisor, child_spec)
  end

  @doc """
  Stops an EntityServer by entity ID.
  """
  def stop_child(entity_id, opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)

    case Registry.lookup(registry, entity_id) do
      [{pid, _}] ->
        EntityServer.stop(pid)
        :ok

      [] ->
        {:error, :not_found}
    end
  end

  defp via_tuple(entity_id, registry) do
    {:via, Registry, {registry, entity_id}}
  end
end
