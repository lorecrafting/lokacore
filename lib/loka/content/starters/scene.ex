defmodule Loka.Content.Starters.Scene do
  @moduledoc """
  `bin/loka new scene <npc> <key>`: `scenes/<key>.scene` for an existing NPC (its own file or an
  area bundle's) with one `~` line and one `- ~` choice, never over an existing file. The one text
  starter; the JSON ones are in Loka.Content.Starters.
  """
  alias Loka.Content.Starters

  @dialogue %{"requires" => %{"capabilities" => %{"dialogue" => 1}}}

  @spec write(Path.t(), String.t(), String.t(), (Path.t(), binary() | nil -> any())) ::
          {:ok, [Path.t()]} | {:error, String.t()}
  def write(dir, key, npc, hook) do
    with :ok <- Starters.valid_name(key),
         :ok <- Starters.in_cartridge(dir),
         :ok <- free(dir, key, npc),
         {:ok, written} <- Starters.put(dir, %{"cartridge.json" => @dialogue}, nil, hook) do
      path = Path.join(dir, "scenes/#{key}.scene")
      hook.(path, nil)
      File.mkdir_p!(Path.dirname(path))
      # A choice needs a reply to compile.
      File.write!(path, "npc: #{npc}\n\n#{npc}: ~\n- ~\n  #{npc}: ~\n")
      {:ok, Enum.sort([path | written])}
    end
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  # The scene's dialogue key is also a `dialogues/` scene's, and its JSON half's (SourceLines).
  defp free(dir, key, npc) do
    taken =
      Enum.find(
        ~w(scenes/#{key}.scene dialogues/#{key}.scene dialogues/#{key}.json),
        &File.exists?(Path.join(dir, &1))
      )

    cond do
      !npc?(dir, npc) -> {:error, "no NPC #{npc}: bin/loka new npcs #{npc} first"}
      taken -> {:error, "#{taken} exists: a starter never replaces it"}
      true -> :ok
    end
  end

  # The key pattern (not the starter's 32-character cap) keeps a path out of the lookup.
  defp npc?(dir, npc) do
    npc =~ ~r/^[a-z][a-z0-9_]{0,63}$/ and
      (File.exists?(Path.join(dir, "npcs/#{npc}.json")) or
         Enum.any?(
           Path.wildcard(Path.join(dir, "areas/*.json")),
           &match?(%{"npcs" => %{^npc => _}}, Starters.read(&1))
         ))
  end
end
