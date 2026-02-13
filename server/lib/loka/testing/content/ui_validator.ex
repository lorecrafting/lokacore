defmodule Loka.Testing.Content.UIValidator do
  @moduledoc """
  Validates that game data aligns with UI expectations.

  Ensures that entity components and tags match what the UI expects:
  - NPCs with `dialogue_tree` component can be talked to (not old `dialogue` format)
  - NPCs with `shop` component have valid sells/buys lists
  - NPCs tagged `quest_giver` have associated quests
  - NPCs with `combatant` component can be attacked (unless tagged `friendly`)
  - Items with `equipable` component have valid slot definitions
  - Items with `crafting_tool` component have valid recipe references

  ## Usage

      {:ok, results} = UIValidator.validate()

  ## Result Structure

      %{
        entities_checked: 50,
        errors: [
          {:old_dialogue_format, "npc_key", "uses dialogue instead of dialogue_tree"},
          {:empty_shop_sells, "npc_key", "shop component has no sells"},
          {:quest_giver_no_quest, "npc_key", "tagged quest_giver but gives no quests"}
        ],
        warnings: [
          {:shop_sells_missing_item, "npc_key", "sells nonexistent_item"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader
  alias Loka.Framework.Quest.Definitions

  @type validation_result :: %{
          entities_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:old_dialogue_format, String.t(), String.t()}
          | {:empty_shop_sells, String.t(), String.t()}
          | {:missing_combatant, String.t(), String.t()}

  @type warning ::
          {:shop_sells_missing_item, String.t(), String.t()}
          | {:quest_giver_no_quest, String.t(), String.t()}
          | {:equipable_invalid_slot, String.t(), String.t()}

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates all entities for UI consistency.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    prototypes = TypedObjectLoader.all()

    npcs = Enum.filter(prototypes, fn p -> p.subtype == "npc" or p.subtype == :npc end)
    items = Enum.filter(prototypes, fn p -> p.subtype == "item" or p.subtype == :item end)

    npc_results = Enum.flat_map(npcs, &validate_npc/1)
    item_results = Enum.flat_map(items, &validate_item/1)

    all_results = npc_results ++ item_results

    errors = Enum.filter(all_results, &match?({:error, _}, &1)) |> Enum.map(&elem(&1, 1))
    warnings = Enum.filter(all_results, &match?({:warning, _}, &1)) |> Enum.map(&elem(&1, 1))

    Logger.info(
      "UIValidator: Checked #{length(npcs) + length(items)} entities, #{length(errors)} errors, #{length(warnings)} warnings"
    )

    {:ok,
     %{
       entities_checked: length(npcs) + length(items),
       errors: errors,
       warnings: warnings
     }}
  end

  # =============================================================================
  # NPC Validation
  # =============================================================================

  defp validate_npc(npc) do
    key = npc.key
    components = npc.components || %{}
    tags = npc.tags || []

    results = []

    # Check for old dialogue format (should use dialogue_tree instead)
    results =
      if has_component?(components, "dialogue") and
           not has_component?(components, "dialogue_tree") do
        [
          {:error,
           {:old_dialogue_format, key, "uses 'dialogue' component instead of 'dialogue_tree'"}}
          | results
        ]
      else
        results
      end

    # Check shop component validity
    results =
      if has_component?(components, "shop") do
        shop = get_component(components, "shop")
        sells = get_in_flex(shop, ["sells"]) || get_in_flex(shop, [:sells]) || []
        buys = get_in_flex(shop, ["buys"]) || get_in_flex(shop, [:buys]) || []

        # Validate sells references
        invalid_sells =
          sells
          |> Enum.reject(fn item_key ->
            case TypedObjectLoader.get(item_key) do
              {:ok, _} -> true
              _ -> false
            end
          end)

        shop_warnings =
          Enum.map(invalid_sells, fn item_key ->
            {:warning, {:shop_sells_missing_item, key, "sells non-existent item '#{item_key}'"}}
          end)

        # Validate buys references
        invalid_buys =
          buys
          |> Enum.reject(fn item_key ->
            case TypedObjectLoader.get(item_key) do
              {:ok, _} -> true
              _ -> false
            end
          end)

        buys_warnings =
          Enum.map(invalid_buys, fn item_key ->
            {:warning, {:shop_buys_missing_item, key, "buys non-existent item '#{item_key}'"}}
          end)

        results ++ shop_warnings ++ buys_warnings
      else
        results
      end

    # Check quest_giver tag has corresponding quests
    results =
      if "quest_giver" in tags do
        # Check if any quest references this NPC as giver
        quests = Definitions.all_quest_definitions()

        has_quest =
          Enum.any?(quests, fn quest ->
            quest.giver == key
          end)

        if has_quest do
          results
        else
          [
            {:warning,
             {:quest_giver_no_quest, key, "tagged quest_giver but no quests reference this NPC"}}
            | results
          ]
        end
      else
        results
      end

    # Check combatant-required NPCs
    results =
      if "hostile" in tags and not has_component?(components, "combatant") do
        [
          {:error, {:missing_combatant, key, "tagged hostile but missing combatant component"}}
          | results
        ]
      else
        results
      end

    results
  end

  # =============================================================================
  # Item Validation
  # =============================================================================

  defp validate_item(item) do
    key = item.key
    components = item.components || %{}

    results = []

    # Check equipable component has valid slot
    # Uses the full LegendMUD-style slot list from Equipable module
    # Also allows legacy slot names (weapon, armor, accessory) which get auto-mapped
    results =
      if has_component?(components, "equipable") do
        equipable = get_component(components, "equipable")
        slot = get_in_flex(equipable, ["slot"]) || get_in_flex(equipable, [:slot])

        # Full slot list from Loka.Framework.Inventory.Equipable
        valid_slots =
          ~w(head neck torso about arms hands waist legs feet held wielded finger_left finger_right wrist_left wrist_right)

        # Legacy slots that get auto-mapped: weapon->wielded, armor->torso, accessory->held
        legacy_slots = ~w(weapon armor accessory body off_hand)

        all_valid = valid_slots ++ legacy_slots

        if slot && slot not in all_valid do
          [
            {:warning, {:equipable_invalid_slot, key, "equipable slot '#{slot}' not recognized"}}
            | results
          ]
        else
          results
        end
      else
        results
      end

    # Check crafting_tool component has valid recipes
    results =
      if has_component?(components, "crafting_tool") do
        crafting_tool = get_component(components, "crafting_tool")

        recipes =
          get_in_flex(crafting_tool, ["recipes_enabled"]) ||
            get_in_flex(crafting_tool, [:recipes_enabled]) || []

        alias Loka.Content.Recipe, as: ContentRecipe

        invalid_recipes =
          recipes
          |> Enum.reject(fn recipe_key ->
            case ContentRecipe.get(recipe_key) do
              {:ok, _} -> true
              _ -> false
            end
          end)

        recipe_warnings =
          Enum.map(invalid_recipes, fn recipe_key ->
            {:warning,
             {:crafting_tool_invalid_recipe, key,
              "references non-existent recipe '#{recipe_key}'"}}
          end)

        results ++ recipe_warnings
      else
        results
      end

    results
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp has_component?(components, name) do
    Map.has_key?(components, name) or Map.has_key?(components, String.to_atom(name))
  end

  defp get_component(components, name) do
    Map.get(components, name) || Map.get(components, String.to_atom(name))
  end

  defp get_in_flex(map, keys) when is_map(map) and is_list(keys) do
    Enum.reduce_while(keys, nil, fn key, _acc ->
      case Map.get(map, key) do
        nil -> {:cont, nil}
        value -> {:halt, value}
      end
    end)
  end

  defp get_in_flex(_, _), do: nil
end
