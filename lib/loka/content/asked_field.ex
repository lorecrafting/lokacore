defmodule Loka.Content.AskedField do
  @moduledoc "The source schema of a dialogue choice's `asked` (DialogueAsked lowers it). Apart from DialogueAsked, which calls Source."

  @schema %{
    "description" =>
      "The Book dims this choice once taken; it stays usable. Lowered to the fact <dialogue>_<choice>_asked, a step that sets it and asked_when.",
    "type" => "boolean",
    "enum" => [true]
  }

  @doc "A source choice's properties (Source.contracts/0): `asked` in, the compiled `asked_when` out."
  @spec source_fields(map()) :: map()
  def source_fields(props), do: props |> Map.delete("asked_when") |> Map.put("asked", @schema)
end
