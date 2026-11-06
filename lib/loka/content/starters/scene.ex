defmodule Loka.Content.Starters.Scene do
  @moduledoc """
  `bin/loka new scene <npc> <key>`: `scenes/<key>.scene` for an existing NPC (its own file, at the
  root or in an area folder, or an area bundle's), in that NPC's area folder, with one `~` line and
  one `- ~` choice, never over an existing file. The one text starter; the JSON ones are in Loka.Content.Starters.
  """
  alias Loka.Content.Starters

  @dialogue %{"requires" => %{"capabilities" => %{"dialogue" => 1}}}

  @spec write(Path.t(), String.t(), String.t(), (Path.t(), binary() | nil -> any())) ::
          {:ok, [Path.t()]} | {:error, String.t()}
  def write(dir, key, npc, hook \\ fn _, _ -> :ok end) do
    with :ok <- Starters.valid_name(key),
         :ok <- Starters.in_cartridge(dir),
         :ok <- free(dir, key, npc),
         {:ok, written} <- Starters.put(dir, %{"cartridge.json" => @dialogue}, nil, hook) do
      path = Path.join([dir, area_of(dir, npc), "scenes/#{key}.scene"])
      hook.(path, nil)
      File.mkdir_p!(Path.dirname(path))
      # A choice needs a reply to compile.
      File.write!(path, "npc: #{npc}\n\n#{npc}: ~\n- ~\n  #{npc}: ~\n")
      {:ok, Enum.sort([path | written])}
    end
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  # The scene's dialogue key is also a `dialogues/` scene's, and its JSON half's (SourceLines), at
  # the root or in an area folder.
  defp free(dir, key, npc) do
    taken =
      ~w(scenes/#{key}.scene dialogues/#{key}.scene dialogues/#{key}.json)
      |> Enum.map(&Starters.home(dir, &1))
      |> Enum.find(&File.exists?(Path.join(dir, &1)))

    cond do
      !holder(dir, npc) -> {:error, "no NPC #{npc}: bin/loka new npcs #{npc} first"}
      taken -> {:error, "#{taken} exists: a starter never replaces it"}
      true -> :ok
    end
  end

  # The file that holds the NPC (its own, at the root or in an area folder, or an area bundle), or
  # nil. The key pattern (not the starter's 32-character cap) keeps a path out of the lookup.
  defp holder(dir, npc) do
    bundled = &match?(%{"npcs" => %{^npc => _}}, Starters.read(&1))

    cond do
      !(npc =~ ~r/^[a-z][a-z0-9_]{0,63}$/) ->
        nil

      File.exists?(Path.join(dir, own = Starters.home(dir, "npcs/#{npc}.json"))) ->
        own

      b = Enum.find(Path.wildcard(Path.join(dir, "areas/*.json")), bundled) ->
        Path.relative_to(b, dir)

      true ->
        nil
    end
  end

  # A scene goes to its NPC's area folder (cartridge area layout design, section 7), else the root.
  defp area_of(dir, npc) do
    case Loka.Content.Areas.area_of(holder(dir, npc)) do
      nil -> ""
      area -> "areas/#{area}"
    end
  end
end
