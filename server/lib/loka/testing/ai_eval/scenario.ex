defmodule Loka.Testing.AIEval.Scenario do
  @moduledoc """
  Defines the structure for AI eval scenarios.

  Each scenario is a multi-phase test that exercises the AI builder's
  ability to create, edit, modify, and delete game content.
  """

  @type expectation ::
          {:entity_exists, keyword()}
          | {:entity_not_exists, keyword()}
          | {:rooms_connected, String.t(), String.t()}
          | {:quest_validates, String.t()}
          | {:dialogue_has_nodes, String.t(), keyword()}
          | {:description_contains, keyword()}
          | {:entity_count, keyword()}
          | {:script_validates, String.t()}

  @type t :: %__MODULE__{
          name: String.t(),
          description: String.t(),
          phases: [Phase.t()]
        }

  @type phase_name :: :create | :edit | :modify | :delete

  defstruct [:name, :description, phases: []]

  defmodule Phase do
    @moduledoc "A single phase within an eval scenario."

    @type t :: %__MODULE__{
            name: Loka.Testing.AIEval.Scenario.phase_name(),
            prompt: String.t(),
            expectations: [Loka.Testing.AIEval.Scenario.expectation()],
            max_points: pos_integer()
          }

    defstruct [:name, :prompt, expectations: [], max_points: 100]
  end
end
