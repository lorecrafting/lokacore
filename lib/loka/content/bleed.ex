defmodule Loka.Content.Bleed do
  @moduledoc "Checks the one authored hound bleed and directly held bandage declaration."
  import Loka.Content.Source, only: [at: 2, diag: 2]
  alias Loka.Content.Refs

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    bleeds = defs["bleed"] || %{}

    hits =
      for {_, {rel, _, n}} <- defs["npc"],
          hit = get_in(n, ["attack", "on_positive_hit"]),
          hit,
          do: {rel, n, hit}

    items = for {_, {rel, _, i}} <- defs["item"], b = i["bandage"], b, do: {rel, i, b}

    if bleeds == %{} and hits == [] and items == [],
      do: [],
      else: verify(m, defs, text, bleeds, hits, items)
  end

  defp verify(m, defs, text, bleeds, hits, items) do
    gate(m) ++ values(bleeds) ++ producers(m, defs, hits) ++ bandages(m, defs, text, items)
  end

  defp gate(m) do
    caps = m["requires"]["capabilities"]

    [major, minor] =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if caps["bleed"] == 1 and caps["combat"] == 1 and caps["skills"] == 1 and
         caps["food"] == 1 and (major > 1 or (major == 1 and minor >= 30)),
       do: [],
       else: [diag("KERNEL_API_RANGE_INVALID", at("cartridge.json", ["requires", "kernel_api"]))]
  end

  defp values(bleeds) do
    for {_, {rel, _, b}} <- bleeds,
        b["tick_every"] >= b["duration"],
        do: diag("SCHEMA_VIOLATION", at(rel, ["tick_every"]))
  end

  defp producers(m, defs, hits) do
    Enum.flat_map(hits, fn {rel, n, hit} ->
      valid_hound =
        n["spawn_template"] == true and
          Enum.any?(defs["population_bundle"], fn {_, {_, _, bundle}} ->
            bundle["npc"]["key"] == n["key"]
          end)

      Refs.reference(rel, ["attack", "on_positive_hit"], {"effect", "bleed"}, hit, m, defs) ++
        if(valid_hound,
          do: [],
          else: [diag("SCHEMA_VIOLATION", at(rel, ["attack", "on_positive_hit"]))]
        )
    end)
  end

  defp bandages(m, defs, text, items) do
    Enum.flat_map(items, fn {rel, i, b} ->
      Refs.reference(rel, ["bandage"], {"effect", "bleed"}, b, m, defs) ++
        Refs.reference(rel, ["bandage"], {"skill", "skill"}, b, m, defs) ++
        if(valid_item?(i, b, text),
          do: [],
          else: [diag("SCHEMA_VIOLATION", at(rel, ["bandage"]))]
        )
    end)
  end

  defp valid_item?(item, bandage, text),
    do:
      bandage["action"] == "bandage" and Map.has_key?(text, bandage["narration"]) and
        item["container"] != true and item["slot"] == nil and item["edible"] == nil
end
