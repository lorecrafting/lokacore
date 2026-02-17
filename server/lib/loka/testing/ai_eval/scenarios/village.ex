defmodule Loka.Testing.AIEval.Scenarios.Village do
  @moduledoc """
  Village zone eval scenario — tests creating a multi-room village area.
  """

  alias Loka.Testing.AIEval.Scenario
  alias Loka.Testing.AIEval.Scenario.Phase

  @spec scenario() :: Scenario.t()
  def scenario do
    %Scenario{
      name: "village",
      description: "Build a village square with connected buildings and NPCs",
      phases: [
        %Phase{
          name: :create,
          prompt: """
          Create a village zone with these rooms:
          - village_square: The central village square, a bustling area
          - village_blacksmith: A smithy with forge sounds and heat
          - village_general_store: A small shop with various goods

          Connect them: square connects to both blacksmith and general store (bidirectional exits).

          Create two NPCs:
          - iron_hans: A blacksmith NPC in the blacksmith shop
          - merchant_ada: A shopkeeper in the general store

          Write rich, sensory descriptions for all rooms.
          """,
          expectations: [
            {:entity_exists, key: "village_square", type: :room},
            {:entity_exists, key: "village_blacksmith", type: :room},
            {:entity_exists, key: "village_general_store", type: :room},
            {:entity_exists, key: "iron_hans", type: :npc},
            {:entity_exists, key: "merchant_ada", type: :npc},
            {:rooms_connected, "village_square", "village_blacksmith"},
            {:rooms_connected, "village_square", "village_general_store"}
          ],
          max_points: 100
        },
        %Phase{
          name: :edit,
          prompt: """
          Expand the village:
          - Add a village_inn room connected to the village square (bidirectional)
          - Add an innkeeper NPC "jolly_marta" in the inn
          - Create a dialogue for jolly_marta (key: marta_dialogue) where she offers room and board, at least 3 nodes
          """,
          expectations: [
            {:entity_exists, key: "village_inn", type: :room},
            {:entity_exists, key: "jolly_marta", type: :npc},
            {:rooms_connected, "village_square", "village_inn"},
            {:dialogue_has_nodes, "marta_dialogue", min: 3},
            # Original content preserved
            {:entity_exists, key: "iron_hans", type: :npc},
            {:entity_exists, key: "village_blacksmith", type: :room}
          ],
          max_points: 75
        }
      ]
    }
  end
end
