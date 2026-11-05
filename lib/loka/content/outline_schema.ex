defmodule Loka.Content.OutlineSchema do
  @moduledoc """
  The JSON Schema of outline.json: the Story map's beats (docs/system/cartridge.md#source-layout),
  author notes the compiler skips; kernel/ts/play/story.ts reads them. SourceSchema writes it.
  """

  @doc "outline.json's schema."
  def schema do
    d = &Map.put(&1, "description", &2)
    beat = beat(d)

    part = %{
      "type" => "object",
      "properties" => %{
        "title" => d.(%{"type" => "string"}, "An author note; never shown to a player."),
        "minutes" => d.(%{"type" => "number", "minimum" => 0}, "The part's planned minutes."),
        "beats" => d.(%{"type" => "array", "items" => beat}, "The part's beats, in play order.")
      },
      "required" => ["beats"],
      "additionalProperties" => false
    }

    %{
      "description" =>
        "The Story map's beats: author notes at the cartridge root, never in the artifact.",
      "type" => "object",
      "properties" => %{
        "parts" => d.(%{"type" => "array", "items" => part}, "The outline's parts, in order.")
      },
      "required" => ["parts"],
      "additionalProperties" => false
    }
  end

  defp beat(d) do
    names = %{"type" => "array", "items" => %{"type" => "string", "minLength" => 1}}
    ref = %{"type" => "string", "pattern" => "^[a-z_]+(/[a-z0-9_]+){1,2}$"}

    %{
      "type" => "object",
      "properties" => %{
        "n" => d.(%{"type" => "integer"}, "The beat's number in the outline."),
        "title" => d.(%{"type" => "string"}, "An author note; never shown to a player."),
        "nodes" =>
          d.(
            %{"type" => "array", "items" => ref},
            "Short refs `<dir>/<key>` (a choice: `dialogues/<d>/<c>`) the beat binds."
          ),
        "seeds" => d.(names, "Names this beat plants; a later beat pays each."),
        "pays" => d.(names, "Names this beat pays; an earlier beat plants each.")
      },
      "required" => ["n"],
      "additionalProperties" => false
    }
  end
end
