defmodule Loka.Testing.AIEval.Scenarios.QuestChain do
  @moduledoc """
  Quest chain eval scenario — tests creating and modifying quests.
  """

  alias Loka.Testing.AIEval.Scenario
  alias Loka.Testing.AIEval.Scenario.Phase

  @spec scenario() :: Scenario.t()
  def scenario do
    %Scenario{
      name: "quest_chain",
      description: "Create a multi-part quest with objectives and rewards",
      phases: [
        %Phase{
          name: :create,
          prompt: """
          Create these quests:
          1. A quest "herb_gathering" — gather 5 moonbloom herbs from the forest. Side quest, given by "healer_npc".
             Objectives: collect type with target "moonbloom_herb" count 5.
             Rewards: 50 xp, 20 gold.

          2. A quest "deliver_medicine" — deliver a potion to the village elder. Side quest, given by "healer_npc".
             Objectives: deliver type with target "healing_potion" to "village_elder".
             Rewards: 100 xp, 50 gold.

          Make sure both quests have good descriptions.
          """,
          expectations: [
            {:quest_validates, "herb_gathering"},
            {:quest_validates, "deliver_medicine"}
          ],
          max_points: 75
        },
        %Phase{
          name: :edit,
          prompt: """
          Update the herb_gathering quest:
          - Change the herb count from 5 to 3
          - Add a bonus objective: find a rare "starlight_bloom" (count 1)
          - Increase the XP reward to 75
          """,
          expectations: [
            {:quest_validates, "herb_gathering"},
            # Original quest preserved
            {:quest_validates, "deliver_medicine"}
          ],
          max_points: 75
        },
        %Phase{
          name: :delete,
          prompt: """
          Delete the deliver_medicine quest. The herb_gathering quest should remain.
          """,
          expectations: [
            {:entity_not_exists, key: "deliver_medicine"},
            {:quest_validates, "herb_gathering"}
          ],
          max_points: 75
        }
      ]
    }
  end
end
