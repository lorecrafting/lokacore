defmodule Loka.Game.Actions.Container do
  @moduledoc """
  Container-related game actions.

  Handles opening containers, taking items, and closing containers.

  ## Actions

  - `:open_container` - Open a container entity
  - `:take_from_container` - Take an item from an open container
  - `:close_container` - Close the open container
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.Inventory.Container
  alias Loka.Framework.Inventory.ContainerRespawn
  alias Loka.Engine.{Entities, Spawner}

  @doc """
  Open a container entity.
  """
  @spec open_container(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def open_container(_ctx, entity_id) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, "You don't see that here."}

      schema ->
        entity = Entities.to_entity(schema)

        case Container.get_container(entity) do
          nil ->
            {:error, "You can't open that."}

          container ->
            if container.locked do
              {:error, container.description_closed || "It's locked."}
            else
              content_items = load_container_items(container.contents)

              result =
                Result.new(
                  state: %{
                    container: %{entity_id: entity_id, container: container}
                  },
                  events: [
                    {:container_open,
                     %{
                       entity_id: entity_id,
                       name: entity.short_desc || entity.key,
                       items: content_items
                     }}
                  ]
                )

              {:ok, result}
            end
        end
    end
  end

  @doc """
  Take an item from an open container.
  """
  @spec take_from_container(Context.t(), integer()) :: {:ok, Result.t()} | {:error, String.t()}
  def take_from_container(ctx, index) do
    open_container = ctx.container
    game_state = ctx.game_state

    if is_nil(open_container) do
      {:error, "No container is open."}
    else
      container = open_container.container

      case Container.take_item_at(container, index) do
        {:ok, updated_container, item_key} ->
          case Spawner.spawn(item_key, []) do
            {:ok, item_entity} ->
              # Add to inventory
              new_inventory = [item_entity.id | game_state.inventory || []]

              {:ok, new_game_state} =
                PlayerGameState.update_state(game_state, %{inventory: new_inventory})

              # Update container in database
              update_container_component(open_container.entity_id, updated_container)

              # Schedule respawn if needed
              if Container.state(updated_container) == :empty and
                   Container.respawn_enabled?(updated_container) do
                ContainerRespawn.schedule(open_container.entity_id)
              end

              item_name = item_entity.short_desc || item_entity.key || "something"

              result =
                Result.new(
                  state: %{
                    game_state: new_game_state,
                    container: %{open_container | container: updated_container}
                  },
                  events: [
                    {:event, "You take #{item_name}."},
                    {:inventory_update, %{action: "add", item_id: item_entity.id}},
                    {:container_update,
                     %{items: load_container_items(updated_container.contents)}}
                  ]
                )

              {:ok, result}

            {:error, _} ->
              {:error, "Failed to pick up the item."}
          end

        {:error, :index_out_of_bounds} ->
          {:error, "That item is no longer there."}

        {:error, _} ->
          {:error, "Failed to take item."}
      end
    end
  end

  @doc """
  Close the open container.
  """
  @spec close_container(Context.t()) :: {:ok, Result.t()}
  def close_container(_ctx) do
    result =
      Result.new(
        state: %{container: nil},
        events: [{:container_close, %{}}]
      )

    {:ok, result}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp load_container_items([]), do: []

  defp load_container_items(item_ids) do
    Enum.with_index(item_ids)
    |> Enum.map(fn {item_id, index} ->
      case Entities.get_entity(item_id) do
        nil ->
          %{index: index, id: item_id, name: format_item_name(item_id), key: item_id}

        schema ->
          entity = Entities.to_entity(schema)
          %{index: index, id: entity.id, name: entity.short_desc || entity.key, key: entity.key}
      end
    end)
  end

  defp update_container_component(entity_id, %Container{} = container) do
    case Entities.get_entity(entity_id) do
      nil ->
        :error

      schema ->
        components = Map.get(schema.components, "components", schema.components)
        updated_components = Map.put(components, "container", Container.to_map(container))
        Entities.update_entity(schema, %{components: updated_components})
    end
  end

  defp format_item_name(item_key) when is_binary(item_key) do
    item_key
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp format_item_name(_), do: "item"
end
