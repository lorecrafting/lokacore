defmodule Loka.Content.BellCue do
  @moduledoc "The chapter's explicit audible area and event source references."
  import Loka.Content.Source, only: [diag: 2, at: 2, ref: 3]

  def check(_, _, {_, %{"world" => world}}, _) when not is_map_key(world, "bell_cue"), do: []
  def check(nil, _, _, _), do: []

  # ponytail: one declared cue checks its finite fact, rooms and text together. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  def check(m, defs, {_, %{"world" => %{"bell_cue" => cue}}}, {_, text}) do
    fact = cue["fact"]
    rooms = cue["rooms"]

    checks =
      [{fact, "fact", ["world", "bell_cue", "fact"]}] ++
        Enum.map(Enum.with_index(rooms), fn {r, i} ->
          {r, "room", ["world", "bell_cue", "rooms", i]}
        end)

    refs =
      for {r, kind, path} <- checks,
          r != ref(r["key"], kind, m) or not Map.has_key?(defs[kind], r["key"]),
          do: diag("UNRESOLVED_REFERENCE", at("cartridge.json", path))

    refs ++
      if(is_map(text) and Map.has_key?(text, cue["text"]),
        do: [],
        else: [diag("UNRESOLVED_TEXT_KEY", at("cartridge.json", ["world", "bell_cue", "text"]))]
      )
  end

  def check(_, _, _, _), do: []
end
