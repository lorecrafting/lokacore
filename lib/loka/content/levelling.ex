defmodule Loka.Content.Levelling do
  @moduledoc "Checks toolbox row 4 world.levelling and experience.grant steps; twin of cartridge_levelling.ts."
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 4, ref: 3]
  alias Loka.Content.Refs

  def settings(%{"world" => %{"levelling" => %{"kills" => kills}}} = settings, m),
    do:
      put_in(
        settings,
        ["world", "levelling", "kills"],
        Enum.map(kills, fn k -> Map.update!(k, "npc", &ref(&1, "npc", m)) end)
      )

  def settings(settings, _), do: settings

  def check(m, defs, {_, settings}, text) do
    levelling = get_in(settings, ["world", "levelling"])

    grants =
      for {_, {rel, [], r}} <- defs["reaction"] || %{},
          {%{"op" => "experience.grant"}, i} <- Enum.with_index(r["apply"]),
          do: at(rel, ["apply", i, "op"])

    api(m, levelling != nil or grants != []) ++
      if(levelling,
        do: declared(levelling, m, defs, text),
        else: Enum.map(grants, &diag("SCHEMA_VIOLATION", &1))
      )
  end

  defp api(m, needed) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if needed and version < [1, 42],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp declared(l, m, defs, text) do
    owner(m) ++ rising(l["thresholds"]) ++ kills(l["kills"] || [], m, defs) ++ line(l, text)
  end

  @path ["world", "levelling"]

  defp owner(m) do
    if m["requires"]["capabilities"]["attributes"] == 1,
      do: [],
      else: [
        diag(
          "UNDECLARED_CAPABILITY",
          at("cartridge.json", @path),
          %{"capability" => "attributes"},
          [
            "attributes@1"
          ]
        )
      ]
  end

  defp rising(thresholds) do
    for {[a, b], i} <- Enum.with_index(Enum.chunk_every(thresholds, 2, 1, :discard), 1),
        b <= a,
        do: diag("SCHEMA_VIOLATION", at("cartridge.json", @path ++ ["thresholds", i]))
  end

  defp kills(kills, m, defs) do
    for {k, i} <- Enum.with_index(kills),
        e <- Refs.reference("cartridge.json", @path ++ ["kills", i], "npc", k, m, defs),
        do: e
  end

  defp line(l, text) do
    if text == :unknown or is_map_key(text, l["level_up"]),
      do: [],
      else: [diag("UNRESOLVED_REFERENCE", at("cartridge.json", @path ++ ["level_up"]))]
  end
end
