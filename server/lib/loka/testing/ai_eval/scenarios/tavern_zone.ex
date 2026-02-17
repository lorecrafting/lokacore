defmodule Loka.Testing.AIEval.Scenarios.TavernZone do
  @moduledoc """
  Tavern zone eval scenario — 4 phases testing create, edit, modify, delete.

  Tests the AI's ability to build a complete tavern area with rooms,
  NPCs, dialogue, and a quest, then modify and clean up content.
  """

  alias Loka.Testing.AIEval.Scenario
  alias Loka.Testing.AIEval.Scenario.Phase

  @spec scenario() :: Scenario.t()
  def scenario do
    %Scenario{
      name: "tavern_zone",
      description: "Build a complete tavern with rooms, NPCs, dialogue, and a quest",
      phases: [
        %Phase{
          name: :create,
          prompt: """
          Create a tavern zone called "rusty_anchor" with:
          - 3 rooms: main hall (rusty_anchor_main_hall), kitchen (rusty_anchor_kitchen), cellar (rusty_anchor_cellar)
          - Bidirectional exits between main hall and kitchen, and between main hall and cellar
          - An NPC bartender named "old_grim" in the main hall with a short description like "a grizzled bartender"
          - A dialogue for old_grim (key: old_grim_dialogue) about tavern rumors, with at least 3 nodes
          - A fetch quest (key: fetch_wine_barrel): retrieve a wine barrel from the cellar, given by old_grim

          Use the tools to create all of this content. Make descriptions rich and sensory.
          """,
          expectations: [
            {:entity_exists, key: "rusty_anchor_main_hall", type: :room},
            {:entity_exists, key: "rusty_anchor_kitchen", type: :room},
            {:entity_exists, key: "rusty_anchor_cellar", type: :room},
            {:entity_exists, key: "old_grim", type: :npc},
            {:rooms_connected, "rusty_anchor_main_hall", "rusty_anchor_kitchen"},
            {:rooms_connected, "rusty_anchor_main_hall", "rusty_anchor_cellar"},
            {:quest_validates, "fetch_wine_barrel"},
            {:dialogue_has_nodes, "old_grim_dialogue", min: 3}
          ],
          max_points: 100
        },
        %Phase{
          name: :edit,
          prompt: """
          Add a second floor to the tavern:
          - New room "rusty_anchor_upstairs" with a staircase exit from main hall (bidirectional)
          - New NPC "traveling_merchant" upstairs who sells potions, with a specific short description
          - A dialogue for the merchant (key: merchant_dialogue) with at least 2 nodes

          Make sure all existing content (old_grim, kitchen, cellar) is preserved.
          """,
          expectations: [
            {:entity_exists, key: "rusty_anchor_upstairs", type: :room},
            {:entity_exists, key: "traveling_merchant", type: :npc},
            {:rooms_connected, "rusty_anchor_main_hall", "rusty_anchor_upstairs"},
            # Original content still intact:
            {:entity_exists, key: "old_grim", type: :npc},
            {:entity_exists, key: "rusty_anchor_kitchen", type: :room}
          ],
          max_points: 75
        },
        %Phase{
          name: :modify,
          prompt: """
          Make these changes to the tavern:
          - Rename the NPC "old_grim" to "bartholomew" — delete old_grim and create bartholomew as a bartender NPC in the main hall
          - Update the cellar room description to mention flooding and water damage
          - Update the fetch_wine_barrel quest description to mention that the player should also bring back a special mug
          """,
          expectations: [
            {:entity_not_exists, key: "old_grim"},
            {:entity_exists, key: "bartholomew", type: :npc},
            {:description_contains, key: "rusty_anchor_cellar", text: "flood"},
            {:quest_validates, "fetch_wine_barrel"}
          ],
          max_points: 75
        },
        %Phase{
          name: :delete,
          prompt: """
          Clean up the tavern:
          - Remove the cellar room (rusty_anchor_cellar) and its exits
          - Delete the traveling merchant NPC
          - The kitchen and main hall should remain intact
          """,
          expectations: [
            {:entity_not_exists, key: "rusty_anchor_cellar"},
            {:entity_not_exists, key: "traveling_merchant"},
            {:entity_exists, key: "rusty_anchor_kitchen", type: :room},
            {:entity_exists, key: "rusty_anchor_main_hall", type: :room}
          ],
          max_points: 75
        }
      ]
    }
  end
end
