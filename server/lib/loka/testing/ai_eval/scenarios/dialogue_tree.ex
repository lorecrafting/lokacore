defmodule Loka.Testing.AIEval.Scenarios.DialogueTree do
  @moduledoc """
  Dialogue tree eval scenario — tests creating complex dialogue with branching.
  """

  alias Loka.Testing.AIEval.Scenario
  alias Loka.Testing.AIEval.Scenario.Phase

  @spec scenario() :: Scenario.t()
  def scenario do
    %Scenario{
      name: "dialogue_tree",
      description: "Create a multi-branch dialogue tree with player choices",
      phases: [
        %Phase{
          name: :create,
          prompt: """
          Create a dialogue tree for an NPC named "wise_sage" (key: sage_dialogue).

          The dialogue should:
          - Start with a greeting where the sage asks what the player seeks
          - Have at least 4 nodes total
          - Include at least 3 player choices in the first node
          - One branch leads to quest information
          - One branch leads to lore about the world
          - One branch ends the conversation

          Use the create_dialogue tool. The entity_key should be "wise_sage".
          Make the text feel natural with personality.
          """,
          expectations: [
            {:dialogue_has_nodes, "sage_dialogue", min: 4}
          ],
          max_points: 100
        },
        %Phase{
          name: :edit,
          prompt: """
          Expand the sage_dialogue:
          - Add a new branch about a hidden dungeon (at least 2 new nodes)
          - The dungeon branch should be accessible from the greeting node
          """,
          expectations: [
            {:dialogue_has_nodes, "sage_dialogue", min: 5}
          ],
          max_points: 75
        },
        %Phase{
          name: :modify,
          prompt: """
          Update the sage_dialogue:
          - Change the greeting text to mention the sage studying an ancient scroll
          - Make the lore branch more detailed
          """,
          expectations: [
            {:dialogue_has_nodes, "sage_dialogue", min: 5}
          ],
          max_points: 75
        }
      ]
    }
  end
end
