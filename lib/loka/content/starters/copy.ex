defmodule Loka.Content.Starters.Copy do
  alias Loka.Content.Starters.Parts

  @moduledoc """
  A new cartridge as a copy of another for `Loka.Content.Starters` (`bin/loka new cartridge <dir>
  --from <cartridge>`, the editor's New world).
  """

  @doc """
  `cartridge <dir> --from <cartridge>`: the source's files, byte for byte, but checkpoints (saves,
  not content) and the id, which becomes the new folder's name: cartridge.json's `id` and every
  `cartridge_id` naming the source (a long-form reference) in a JSON file, which is rewritten in its
  own key order. A link anywhere refuses the copy before anything is written. `hook` runs before
  each write, as for every starter.
  """
  def cartridge(from, path, hook) do
    text = File.read(Path.join(from, "cartridge.json"))
    id = with {:ok, bytes} <- text, {:ok, %{"id" => id}} <- JSON.decode(bytes), do: id

    cond do
      File.lstat(path) != {:error, :enoent} -> {:error, "#{path} exists"}
      not is_binary(id) -> {:error, "#{from} is not a cartridge: no cartridge.json with an id"}
      true -> copied(from, path, files(from, ""), id, hook)
    end
  catch
    {:link, rel} -> {:error, "#{from}/#{rel} is a symlink: a copy takes real files only"}
  end

  defp copied(from, path, rels, id, hook) do
    swap = {id, Path.basename(path)}
    {:ok, Enum.map(rels, &put(from, Path.join(path, &1), &1, {swap, hook}))}
  end

  defp put(from, to, rel, {swap, hook}) do
    hook.(to, nil)
    File.mkdir_p!(Path.dirname(to))
    bytes = File.read!(Path.join(from, rel))
    File.write!(to, if(Path.extname(rel) == ".json", do: renamed(bytes, rel, swap), else: bytes))
    to
  end

  @ordered [
    object_push: &__MODULE__.push/3,
    object_finish: &__MODULE__.finish/2
  ]
  @doc false
  def push(key, value, acc), do: [{key, value} | acc]
  @doc false
  def finish(acc, old), do: {{:obj, Enum.reverse(acc)}, old}

  # As data, not text: prose that happens to hold the id is untouched, and a file with no reference
  # keeps its bytes.
  defp renamed(bytes, rel, swap) do
    with {tree, [], ""} <- JSON.decode(bytes, [], @ordered),
         new when new != tree <- swapped(tree, swap, rel == "cartridge.json") do
      Parts.pretty(new)
    else
      _ -> bytes
    end
  end

  defp swapped({:obj, pairs}, {id, name} = swap, top) do
    {:obj,
     for {key, value} <- pairs do
       hit = value == id and (key == "cartridge_id" or (top and key == "id"))
       {key, if(hit, do: name, else: swapped(value, swap, false))}
     end}
  end

  defp swapped(list, swap, _) when is_list(list), do: Enum.map(list, &swapped(&1, swap, false))
  defp swapped(value, _, _), do: value

  defp files(dir, rel) do
    for name <- Enum.sort(File.ls!(Path.join(dir, rel))),
        rel = if(rel == "", do: name, else: Path.join(rel, name)),
        rel != "checkpoints",
        file <-
          (case File.lstat!(Path.join(dir, rel)).type do
             :directory -> files(dir, rel)
             :regular -> [rel]
             _ -> throw({:link, rel})
           end),
        do: file
  end
end
