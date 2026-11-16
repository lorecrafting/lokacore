defmodule Loka.Content.AskedField do
  @moduledoc """
  The source-only schema of a dialogue choice's `asked`, `once` and `story_point`, which the
  contract's other fields never carry: `asked` (DialogueAsked lowers it), `once` (DialogueOnce),
  and `story_point` (Dialogues.points/2 derives CompiledCartridge.story_points and strips it).
  Apart from DialogueAsked, which calls Source.
  """

  @schema %{
    "description" =>
      "The Book dims this choice once taken; it stays usable. Lowered to the fact <dialogue>_<choice>_asked, a step that sets it and asked_when.",
    "type" => "boolean",
    "enum" => [true]
  }

  # Source only (Dialogues.points/2 derives CompiledCartridge.story_points and strips it).
  @point %{
    "description" => "<story point>/<outcome>: the outcome this choice reaches; one per outcome.",
    "type" => "string",
    "pattern" => "^[a-z][a-z0-9_]{0,63}/[a-z][a-z0-9_]{0,63}$"
  }

  # Source only (DialogueOnce lowers it to a fact, a step and a policy).
  @once %{
    "description" =>
      "This choice goes away once taken: lowered to the fact <dialogue>_<choice>_done, a step that sets it and a policy that needs it unset.",
    "type" => "boolean",
    "enum" => [true]
  }

  @doc "A source choice's properties (Source.contracts/0): `asked` in, the compiled `asked_when` out."
  @spec source_fields(map()) :: map()
  def source_fields(props),
    do:
      props
      |> Map.delete("asked_when")
      |> Map.merge(%{"asked" => @schema, "once" => @once, "story_point" => @point})
end
