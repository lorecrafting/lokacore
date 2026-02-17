defmodule Loka.Testing.AIEval.Scenarios.ScriptCreation do
  @moduledoc """
  Script creation eval scenario — tests creating and modifying Elixir scripts.
  """

  alias Loka.Testing.AIEval.Scenario
  alias Loka.Testing.AIEval.Scenario.Phase

  @spec scenario() :: Scenario.t()
  def scenario do
    %Scenario{
      name: "script_creation",
      description: "Create Elixir scripts for NPC behaviors",
      phases: [
        %Phase{
          name: :create,
          prompt: """
          Create two scripts:

          1. A script "greeting_script" with hook "on_enter" that emits a greeting message
             when a player enters the room. The source should use emit.() to send a message.

          2. A script "patrol_script" with hook "behavior" that makes an NPC move between rooms.
             The source should use room_exits.() to get available exits and teleport.() to move.

          Use the create_script tool for both. Make sure each has a valid hook and source code
          that uses dot-call syntax for bindings (e.g., emit.(), teleport.(), room_exits.()).
          """,
          expectations: [
            {:script_validates, "greeting_script"},
            {:script_validates, "patrol_script"}
          ],
          max_points: 75
        },
        %Phase{
          name: :edit,
          prompt: """
          Update the greeting_script:
          - Add a time check so it only greets during daytime (use current_hour.())
          - If night, emit a different message about the NPC being asleep
          """,
          expectations: [
            {:script_validates, "greeting_script"},
            {:script_validates, "patrol_script"}
          ],
          max_points: 75
        },
        %Phase{
          name: :delete,
          prompt: """
          Delete the patrol_script. The greeting_script should remain intact.
          """,
          expectations: [
            {:entity_not_exists, key: "patrol_script"},
            {:script_validates, "greeting_script"}
          ],
          max_points: 75
        }
      ]
    }
  end
end
