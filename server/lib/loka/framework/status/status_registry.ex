defmodule Loka.Framework.Status.StatusRegistry do
  @moduledoc """
  Loads and stores status effect definitions from YAML files.

  Status effects are stored as YAML files in `priv/world/statuses/`. This registry:
  - Reads all YAML files from the statuses directory
  - Parses each status effect definition
  - Stores status effects in ETS for fast concurrent lookup

  ## Usage

      alias Loka.Framework.Status.StatusRegistry

      # Get a status by key
      {:ok, status} = StatusRegistry.get("poisoned")

      # List all statuses
      statuses = StatusRegistry.all()

      # List buffs only
      buffs = StatusRegistry.by_type(:buff)

      # Hot-reload from disk
      :ok = StatusRegistry.reload()
  """

  use Loka.Framework.RegistryBase,
    table: :loka_statuses,
    path: "priv/world/statuses",
    item_module: Loka.Framework.Status.StatusEffect,
    item_name: "status effect",
    state_key: :statuses,
    content_types: [{:status, nil}]

  @doc """
  Lists all status effects of a specific type.
  """
  def by_type(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:by_type, type})
  end

  @doc """
  Lists all status effects with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc false
  def handle_custom_call({:by_type, type}, _from, state) do
    statuses =
      state.statuses
      |> Map.values()
      |> Enum.filter(&(&1.type == type))

    {:reply, statuses, state}
  end

  def handle_custom_call({:by_tag, tag}, _from, state) do
    statuses =
      state.statuses
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, statuses, state}
  end
end
