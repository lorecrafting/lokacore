defmodule Loka.Framework.Farming.CropRegistry do
  @moduledoc """
  Loads and stores crop definitions from YAML files.

  Crops are stored as YAML files in `priv/world/crops/`. This registry:
  - Reads all YAML files from the crops directory
  - Parses each crop definition
  - Stores crops in ETS for fast concurrent lookup

  ## YAML Format

      key: wheat_crop
      name: "Wheat"
      seed_item: wheat_seeds
      growth_stages:
        - stage: planted
          duration: 300
          description: "Seeds freshly planted."
        - stage: sprouting
          duration: 600
          description: "Small green shoots emerge."
        - stage: harvestable
          duration: null
          description: "Golden wheat ready for harvest."
      harvest_yield:
        - item: wheat
          quantity: [3, 6]
        - item: wheat_seeds
          quantity: [1, 2]
          chance: 0.5
      requires_water: true
      can_wither: true
      wither_time: 1800
      skill_required: farming
      xp_reward:
        skill: farming
        amount: 15

  ## Usage

      alias Loka.Framework.Farming.CropRegistry

      {:ok, crop} = CropRegistry.get("wheat_crop")
      crops = CropRegistry.all()
  """

  use Loka.Framework.RegistryBase,
    table: :loka_crops,
    path: "priv/world/crops",
    item_module: Loka.Framework.Farming.Crop,
    item_name: "crop",
    state_key: :crops

  @doc """
  Finds the crop that uses a specific seed item.
  """
  def by_seed(seed_item, server \\ __MODULE__) when is_binary(seed_item) do
    GenServer.call(server, {:by_seed, seed_item})
  end

  @doc """
  Lists all crops with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  # Custom call handlers

  @doc false
  def handle_custom_call({:by_seed, seed_item}, _from, state) do
    crop =
      state.crops
      |> Map.values()
      |> Enum.find(&(&1.seed_item == seed_item))

    result = if crop, do: {:ok, crop}, else: {:error, :not_found}
    {:reply, result, state}
  end

  def handle_custom_call({:by_tag, tag}, _from, state) do
    crops =
      state.crops
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, crops, state}
  end
end
