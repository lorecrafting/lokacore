defmodule Loka.Game.Actions.Gathering do
  @moduledoc """
  Gathering and crafting game actions.

  Handles resource gathering from nodes and item crafting.

  ## Actions

  - `:gather` - Gather resources from a gathering node
  - `:craft` - Craft an item using a recipe
  """

  require Logger

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Engine.{Entity, Spawner}

  @doc """
  Gather resources from a gathering node in the room.
  """
  @spec gather(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def gather(ctx, node_type) do
    room = ctx.room
    character = ctx.character
    gathering_node = room[:gathering_node]

    Logger.debug("[GATHERING] Gather attempt: node_type=#{node_type} room=#{room[:key]}")

    if gathering_node && gathering_node.type == node_type do
      gathered_items = roll_gathering_yields(gathering_node.yields || [])

      event_text =
        if Enum.empty?(gathered_items) do
          Logger.info("[GATHERING] Nothing found: node_type=#{node_type}")
          "You search the #{String.downcase(gathering_node.name)} but find nothing useful."
        else
          items_list =
            gathered_items
            |> Enum.map(fn {item_key, qty} -> "#{qty}x #{format_item_name(item_key)}" end)
            |> Enum.join(", ")

          Logger.info(
            "[GATHERING] Gathered: node_type=#{node_type} items=#{inspect(gathered_items)}"
          )

          (gathering_node[:gather_message] ||
             "You harvest from the #{String.downcase(gathering_node.name)}.") <>
            " You find #{items_list}."
        end

      # Spawn items and add to inventory
      spawned_ids =
        Enum.flat_map(gathered_items, fn {item_key, qty} ->
          Enum.map(1..qty, fn _ ->
            case Spawner.spawn(item_key, []) do
              {:ok, entity} -> entity.id
              _ -> nil
            end
          end)
        end)
        |> Enum.reject(&is_nil/1)

      inventory = Entity.get_component(character, "inventory") || []
      new_inventory = spawned_ids ++ inventory
      new_character = Entity.add_component(character, "inventory", new_inventory)

      events =
        [{:event, event_text}] ++
          Enum.map(spawned_ids, fn id ->
            {:inventory_update, %{action: "add", item_id: id}}
          end)

      result =
        Result.new(
          state: %{character: new_character},
          events: events
        )

      {:ok, result}
    else
      Logger.debug("[GATHERING] Nothing to gather: node_type=#{node_type} room=#{room[:key]}")
      {:error, "Nothing to gather here."}
    end
  end

  @doc """
  Craft an item using a recipe.

  Delegates to `Loka.Framework.Crafting` which handles quest progress tracking.
  """
  @spec craft(Context.t(), String.t(), String.t() | nil) ::
          {:ok, Result.t()} | {:error, String.t()}
  def craft(_ctx, _recipe_key, _tool_id) do
    # V2: Crafting system deleted, will be reimplemented as entity behavior
    {:error, "Crafting is not yet available."}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp roll_gathering_yields(yields) when is_list(yields) do
    yields
    |> Enum.filter(fn yield ->
      chance = yield["chance"] || yield[:chance] || 1.0
      :rand.uniform() <= chance
    end)
    |> Enum.map(fn yield ->
      item_key = yield["item"] || yield[:item]
      quantity = roll_quantity(yield["quantity"] || yield[:quantity] || 1)
      {item_key, quantity}
    end)
  end

  defp roll_gathering_yields(_), do: []

  defp roll_quantity(quantity) when is_integer(quantity), do: quantity

  defp roll_quantity([min, max]) when is_integer(min) and is_integer(max),
    do: Enum.random(min..max)

  defp roll_quantity(_), do: 1

  defp format_item_name(item_key) when is_binary(item_key) do
    item_key
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp format_item_name(_), do: "item"
end
