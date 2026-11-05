defmodule Loka.Content.Starters.Copy do
  @moduledoc """
  A new cartridge as a copy of another for `Loka.Content.Starters` (`bin/loka new cartridge <dir>
  --from <cartridge>`, the editor's New world).
  """

  @doc """
  `cartridge <dir> --from <cartridge>`: the source's files, byte for byte, but checkpoints (saves,
  not content) and the id, which becomes the new folder's name in place so cartridge.json keeps its
  formatting. A link anywhere refuses the copy before anything is written. `hook` runs before each
  write, as for every starter.
  """
  def cartridge(from, path, hook) do
    text = File.read(Path.join(from, "cartridge.json"))
    id = with {:ok, bytes} <- text, {:ok, %{"id" => id}} <- JSON.decode(bytes), do: id

    cond do
      File.lstat(path) != {:error, :enoent} -> {:error, "#{path} exists"}
      not is_binary(id) -> {:error, "#{from} is not a cartridge: no cartridge.json with an id"}
      true -> copied(from, path, files(from, ""), {elem(text, 1), id}, hook)
    end
  catch
    {:link, rel} -> {:error, "#{from}/#{rel} is a symlink: a copy takes real files only"}
  end

  defp copied(from, path, rels, {text, id}, hook) do
    needle = ~s("id": #{JSON.encode!(id)})

    case String.split(text, needle) do
      [head, tail] ->
        manifest = head <> ~s("id": #{JSON.encode!(Path.basename(path))}) <> tail
        {:ok, Enum.map(rels, &put(from, Path.join(path, &1), &1, {manifest, hook}))}

      _ ->
        {:error, "#{from}/cartridge.json: the id is not written once as #{needle}"}
    end
  end

  defp put(from, to, rel, {manifest, hook}) do
    hook.(to, nil)
    File.mkdir_p!(Path.dirname(to))

    if rel == "cartridge.json",
      do: File.write!(to, manifest),
      else: File.cp!(Path.join(from, rel), to)

    to
  end

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
