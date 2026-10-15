defmodule Loka.Content.Theft do
  @moduledoc """
  Toolbox rows 33 and 34 (mechanics.md Theft, fence and witnessed offense): world.theft needs
  kernel_api 1.94, names this cartridge's skill, attribute and an instance-scoped per_subject bool
  stolen fact, and every bank vault NPC then carries a get lock. Twin of
  kernel/ts/src/content/cartridge_theft.ts.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  @path ["world", "theft"]

  @doc "Expands world.theft's short skill, attribute and stolen fact references."
  @spec settings(map(), map()) :: map()
  def settings(%{"world" => %{"theft" => _}} = settings, m),
    do:
      settings
      |> update_in(@path ++ ["skill"], &ref(&1, "skill", m))
      |> update_in(@path ++ ["attribute"], &ref(&1, "attribute", m))
      |> update_in(@path ++ ["stolen"], &ref(&1, "fact", m))

  def settings(settings, _), do: settings

  @spec check(map() | nil, map(), {term(), map()}, {term(), map() | :unknown} | nil) :: [map()]
  def check(nil, _, _, _), do: []
  def check(_, _, _, nil), do: []

  def check(m, defs, {_, %{"world" => %{"theft" => t}}}, {_, text}) do
    floor =
      if version(m) < [1, 94],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    refs =
      Enum.flat_map(
        [{"skill", "skill"}, {"attribute", "attribute"}, {"stolen", "fact"}],
        &reference("cartridge.json", @path, &1, t, m, defs)
      )

    floor ++ refs ++ stolen(t, m, defs) ++ narration(t, text) ++ vaults(m, defs)
  end

  def check(_, _, _, _), do: []

  defp stolen(t, m, defs) do
    case resolve(t["stolen"], "fact", m, defs) do
      {_, _,
       %{"per_subject" => true, "scopes" => ["instance"], "value_type" => %{"type" => "bool"}}} ->
        []

      {_, _, _} ->
        [diag("FACT_SCOPE_UNSUPPORTED", at("cartridge.json", @path ++ ["stolen"]))]

      _ ->
        []
    end
  end

  defp narration(_, :unknown), do: []

  defp narration(t, text) do
    for {field, key} <- t["narration"],
        not is_map_key(text || %{}, key),
        do:
          diag(
            "UNRESOLVED_REFERENCE",
            at("cartridge.json", @path ++ ["narration", field]),
            %{"target" => key}
          )
  end

  # No pickpocketing the shared pool: a bank vault NPC needs a get lock.
  defp vaults(m, defs) do
    for {_, {rel, steps, %{"benefit" => %{"kind" => k, "vault" => v}}}} <- defs["service"] || %{},
        k in ~w(deposit withdraw),
        not match?({_, _, %{"locks" => %{"get" => _}}}, resolve(v, "npc", m, defs)),
        do:
          diag("SCHEMA_VIOLATION", at(rel, steps ++ ["benefit", "vault"]), %{
            "error" => "invalid_value"
          })
  end

  defp version(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
