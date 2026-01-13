defmodule Loka.Framework.Housing do
  @moduledoc """
  Player housing system.

  Allows players to own, customize, and manage personal rooms:
  - Purchase/rent housing
  - Place furniture and decorations
  - Set permissions for visitors
  - Store items safely
  - Return/recall to home

  ## Housing Configuration (YAML - Room Prototype)

      key: player_cottage
      name: "Cozy Cottage"
      type: room
      components:
        housing:
          price: 5000
          rent_weekly: 100
          max_furniture: 20
          max_storage: 100
          upgradeable: true
          upgrades:
            expanded_storage:
              price: 2000
              storage_bonus: 50
            garden:
              price: 3000
              feature: farming_plot

  ## Player Home State (in GameState)

      stats:
        housing:
          home_room_id: "room_123"
          furniture: [...]
          storage: [...]
          rent_paid_until: timestamp
          upgrades: [expanded_storage]

  ## Usage

      alias Loka.Framework.Housing

      # Buy a house
      {:ok, state} = Housing.purchase(game_state, room_entity, :buy)

      # Set home location
      {:ok, state} = Housing.set_home(game_state, room_id)

      # Recall home
      home_room = Housing.get_home(game_state)

      # Place furniture
      {:ok, state} = Housing.place_furniture(game_state, furniture_item)
  """

  alias Loka.Framework.Player.GameState
  alias Loka.Utils.MapHelpers

  @type housing_state :: %{
          home_room_id: String.t() | nil,
          furniture: [String.t()],
          storage: [String.t()],
          rent_paid_until: integer() | nil,
          upgrades: [String.t()]
        }

  @default_housing_state %{
    home_room_id: nil,
    furniture: [],
    storage: [],
    rent_paid_until: nil,
    upgrades: []
  }

  # =============================================================================
  # Housing Queries
  # =============================================================================

  @doc """
  Gets the player's housing state.
  """
  def get_housing_state(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :housing, @default_housing_state)
  end

  @doc """
  Gets the player's home room ID.
  """
  def get_home(%GameState{} = game_state) do
    housing = get_housing_state(game_state)
    housing.home_room_id
  end

  @doc """
  Checks if player has a home.
  """
  def has_home?(%GameState{} = game_state) do
    get_home(game_state) != nil
  end

  @doc """
  Checks if rent is current.
  """
  def rent_current?(%GameState{} = game_state) do
    housing = get_housing_state(game_state)

    case housing.rent_paid_until do
      # Owned, no rent
      nil -> true
      timestamp -> System.system_time(:second) < timestamp
    end
  end

  # =============================================================================
  # Housing Management
  # =============================================================================

  @doc """
  Purchases or rents a house.
  """
  def purchase(%GameState{} = game_state, room_entity, mode \\ :buy) do
    housing_component = get_housing_component(room_entity)

    if housing_component do
      case mode do
        :buy ->
          do_purchase(game_state, room_entity, housing_component)

        :rent ->
          do_rent(game_state, room_entity, housing_component)
      end
    else
      {:error, :not_purchasable}
    end
  end

  @doc """
  Sets the player's home location.
  """
  def set_home(%GameState{} = game_state, room_id) do
    housing = get_housing_state(game_state)
    updated_housing = Map.put(housing, :home_room_id, room_id)
    {:ok, put_housing_state(game_state, updated_housing)}
  end

  @doc """
  Abandons the current home.
  """
  def abandon_home(%GameState{} = game_state) do
    {:ok, put_housing_state(game_state, @default_housing_state)}
  end

  @doc """
  Pays rent for another period.
  """
  def pay_rent(%GameState{} = game_state, weeks \\ 1) do
    housing = get_housing_state(game_state)
    current_time = System.system_time(:second)
    week_seconds = 7 * 24 * 60 * 60

    base_time = max(housing.rent_paid_until || current_time, current_time)
    new_until = base_time + weeks * week_seconds

    updated_housing = Map.put(housing, :rent_paid_until, new_until)
    {:ok, put_housing_state(game_state, updated_housing)}
  end

  # =============================================================================
  # Furniture Management
  # =============================================================================

  @doc """
  Places furniture in the home.
  """
  def place_furniture(%GameState{} = game_state, furniture_id, max_furniture \\ 20) do
    housing = get_housing_state(game_state)

    cond do
      is_nil(housing.home_room_id) ->
        {:error, :no_home}

      length(housing.furniture) >= max_furniture ->
        {:error, :furniture_limit_reached}

      true ->
        updated_housing = Map.update!(housing, :furniture, &[furniture_id | &1])
        {:ok, put_housing_state(game_state, updated_housing)}
    end
  end

  @doc """
  Removes furniture from the home.
  """
  def remove_furniture(%GameState{} = game_state, furniture_id) do
    housing = get_housing_state(game_state)

    if furniture_id in housing.furniture do
      updated_housing = Map.update!(housing, :furniture, &List.delete(&1, furniture_id))
      {:ok, put_housing_state(game_state, updated_housing), furniture_id}
    else
      {:error, :furniture_not_found}
    end
  end

  @doc """
  Lists all furniture in the home.
  """
  def list_furniture(%GameState{} = game_state) do
    housing = get_housing_state(game_state)
    housing.furniture
  end

  # =============================================================================
  # Storage Management
  # =============================================================================

  @doc """
  Stores an item in home storage.
  """
  def store_item(%GameState{} = game_state, item_id, max_storage \\ 100) do
    housing = get_housing_state(game_state)

    # Account for upgrades
    actual_max = max_storage + get_storage_bonus(housing.upgrades)

    cond do
      is_nil(housing.home_room_id) ->
        {:error, :no_home}

      length(housing.storage) >= actual_max ->
        {:error, :storage_full}

      true ->
        updated_housing = Map.update!(housing, :storage, &[item_id | &1])
        {:ok, put_housing_state(game_state, updated_housing)}
    end
  end

  @doc """
  Retrieves an item from home storage.
  """
  def retrieve_item(%GameState{} = game_state, item_id) do
    housing = get_housing_state(game_state)

    if item_id in housing.storage do
      updated_housing = Map.update!(housing, :storage, &List.delete(&1, item_id))
      {:ok, put_housing_state(game_state, updated_housing), item_id}
    else
      {:error, :item_not_found}
    end
  end

  @doc """
  Lists all items in home storage.
  """
  def list_storage(%GameState{} = game_state) do
    housing = get_housing_state(game_state)
    housing.storage
  end

  # =============================================================================
  # Upgrades
  # =============================================================================

  @doc """
  Purchases a home upgrade.
  """
  def purchase_upgrade(%GameState{} = game_state, upgrade_key) do
    housing = get_housing_state(game_state)

    if upgrade_key in housing.upgrades do
      {:error, :already_purchased}
    else
      updated_housing = Map.update!(housing, :upgrades, &[upgrade_key | &1])
      {:ok, put_housing_state(game_state, updated_housing)}
    end
  end

  @doc """
  Checks if player has an upgrade.
  """
  def has_upgrade?(%GameState{} = game_state, upgrade_key) do
    housing = get_housing_state(game_state)
    upgrade_key in housing.upgrades
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_housing_component(room_entity) do
    components = Map.get(room_entity, :components, %{})
    MapHelpers.get_flexible(components, :housing, nil)
  end

  defp do_purchase(game_state, room_entity, _housing_component) do
    room_id = room_entity[:id] || room_entity["id"]

    housing = get_housing_state(game_state)
    updated_housing = %{housing | home_room_id: room_id, rent_paid_until: nil}

    {:ok, put_housing_state(game_state, updated_housing)}
  end

  defp do_rent(game_state, room_entity, _housing_component) do
    room_id = room_entity[:id] || room_entity["id"]
    current_time = System.system_time(:second)
    week_seconds = 7 * 24 * 60 * 60

    housing = get_housing_state(game_state)

    updated_housing = %{
      housing
      | home_room_id: room_id,
        rent_paid_until: current_time + week_seconds
    }

    {:ok, put_housing_state(game_state, updated_housing)}
  end

  defp put_housing_state(%GameState{stats: stats} = game_state, housing) do
    %{game_state | stats: Map.put(stats, :housing, housing)}
  end

  defp get_storage_bonus(upgrades) do
    if "expanded_storage" in upgrades, do: 50, else: 0
  end
end
