defmodule Loka.Content.Mounts do
  @moduledoc """
  Toolbox row 43b (mechanics.md Mounts): world.mount names a bool pair
  fact (per_subject, scopes ["player"]) as riding; an NPC's mount needs world.mount and an
  authored NPC, never a spawn template (SCHEMA_VIOLATION). Twin of
  kernel/ts/src/content/cartridge_mounts.ts.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  @path ["world", "mount"]

  @doc "Expands world.mount's short riding fact reference."
  @spec settings(map(), map()) :: map()
  def settings(%{"world" => %{"mount" => _}} = settings, m),
    do: update_in(settings, @path ++ ["riding"], &ref(&1, "fact", m))

  def settings(settings, _), do: settings

  @spec check(map() | nil, map(), {term(), map()}) :: [map()]
  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    mount = get_in(settings, @path)
    npcs(defs, mount) ++ if(mount, do: world(m, defs, mount), else: [])
  end

  defp npcs(defs, mount) do
    for {_, {rel, steps, %{"mount" => _} = n}} <- defs["npc"] || %{},
        !mount or n["spawn_template"] == true,
        do: bad(at(rel, steps ++ ["mount"]))
  end

  defp world(m, defs, mount) do
    reference("cartridge.json", @path, {"riding", "fact"}, mount, m, defs) ++
      case resolve(mount["riding"], "fact", m, defs) do
        {_, _,
         %{"per_subject" => true, "scopes" => ["player"], "value_type" => %{"type" => "bool"}}} ->
          []

        {_, _, _} ->
          [bad(at("cartridge.json", @path ++ ["riding"]))]

        _ ->
          []
      end
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
