defmodule Loka.Framework.Resources.ResourceRegistry do
  @moduledoc """
  Loads and stores resource type definitions from YAML files.

  Resources are stored as YAML files in `priv/world/resources/`. This registry:
  - Reads all YAML files from the resources directory
  - Parses each resource definition
  - Stores resources in ETS for fast concurrent lookup

  ## YAML Format

      key: mana
      name: "Mana"
      max_formula: "level * 10 + sta * 2"
      regen_rate: 2
      regen_condition: out_of_combat
      color: blue
      description: "Magical energy for casting spells"

  ## Usage

      alias Loka.Framework.Resources.ResourceRegistry

      # Get a resource by key
      {:ok, resource} = ResourceRegistry.get("mana")

      # List all resources
      resources = ResourceRegistry.all()

      # Hot-reload from disk
      :ok = ResourceRegistry.reload()
  """

  use Loka.Framework.RegistryBase,
    table: :loka_resources,
    path: "priv/world/resources",
    item_module: Loka.Framework.Resources.Resource,
    item_name: "resource",
    state_key: :resources

  alias Loka.Framework.Resources.Resource

  @doc """
  Returns resources that regenerate (regen_rate > 0).
  """
  def regenerating(server \\ __MODULE__) do
    GenServer.call(server, :regenerating)
  end

  @doc false
  def handle_custom_call(:regenerating, _from, state) do
    resources =
      state.resources
      |> Map.values()
      |> Enum.filter(&Resource.regenerates?/1)

    {:reply, resources, state}
  end
end
