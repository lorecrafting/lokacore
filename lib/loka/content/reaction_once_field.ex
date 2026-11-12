defmodule Loka.Content.ReactionOnce.Field do
  @moduledoc """
  The source schema of a reaction's `once` and `cooldown` (ReactionOnce lowers both). Apart from
  ReactionOnce, which calls Source, so the source schema file does not grow.
  """

  @once %{
    "description" => "This rule runs at most once: lowered to the fact <rule>_done.",
    "type" => "boolean",
    "enum" => [true]
  }

  @cooldown %{
    "description" => "This rule rests this many logical seconds after it fires (fact <rule>_at).",
    "type" => "integer",
    "minimum" => 1,
    "maximum" => 2_147_483_647
  }

  @doc "A source reaction's properties (Source.contracts/0)."
  @spec source_fields(map()) :: map()
  def source_fields(props), do: props |> Map.put("once", @once) |> Map.put("cooldown", @cooldown)
end
