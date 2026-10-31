defmodule Loka.Content.Starters do
  @moduledoc """
  `bin/loka new <kind> <name>`: writes a compiling starter for one source kind with every line a
  `~` placeholder (docs/guides/writing-the-game.md#coverage). A starter is JSON merged into the
  files it touches, plus the capabilities it needs in cartridge.json; a kind that references
  another (an item needs a room) takes the first existing one and refuses without it.
  """
  alias Loka.Content.Starters.Templates

  @doc "Writes the starter; `{:ok, written paths}` or `{:error, one line for the author}`."
  @spec write(Path.t(), String.t(), String.t()) :: {:ok, [Path.t()]} | {:error, String.t()}
  def write(_dir, "cartridge", path) do
    cond do
      File.exists?(Path.join(path, "cartridge.json")) -> {:error, "#{path}/cartridge.json exists"}
      valid_name(Path.basename(path)) != :ok -> valid_name(Path.basename(path))
      true -> put(path, Templates.cartridge(Path.basename(path)))
    end
  end

  def write(dir, kind, name) do
    with :ok <- valid_name(name),
         {:ok, {caps, needs, make}} <- Map.fetch(Templates.kinds(), kind) |> or_unknown(kind),
         {:ok, context} <- context(dir, needs) do
      files =
        Map.update(
          make.(name, context),
          "cartridge.json",
          capabilities(caps),
          &merge(&1, capabilities(caps))
        )

      put(dir, files)
    end
  end

  @doc "The kinds `write/3` knows, sorted (the guide's coverage table lists each)."
  def kinds, do: ["cartridge" | Map.keys(Templates.kinds())] |> Enum.sort()

  defp valid_name(name) do
    if name =~ ~r/^[a-z][a-z0-9_]{0,63}$/,
      do: :ok,
      else:
        {:error, "a name is lowercase letters, digits and _, 64 at most (got #{inspect(name)})"}
  end

  defp or_unknown(:error, kind),
    do: {:error, "unknown kind #{inspect(kind)}; one of: #{Enum.join(kinds(), " ")}"}

  defp or_unknown(found, _), do: found

  # The first key of each kind the template references (dirs only: an area bundle's npcs are not
  # scanned), plus every room, bundled ones too, for layout's completeness check.
  defp context(dir, needs) do
    Enum.reduce_while(needs, {:ok, %{"room_list" => rooms(dir)}}, fn kind, {:ok, acc} ->
      case first(dir, kind) do
        nil -> {:halt, {:error, "no #{kind} yet: bin/loka new #{kind} <name> first"}}
        key -> {:cont, {:ok, Map.put(acc, kind, key)}}
      end
    end)
  end

  defp rooms(dir) do
    bundled =
      for a <- Path.wildcard(Path.join(dir, "areas/*.json")),
          r <- Map.keys(read(a)["rooms"] || %{}),
          do: r

    plain = for r <- Path.wildcard(Path.join(dir, "rooms/*.json")), do: Path.basename(r, ".json")
    Enum.sort(bundled ++ plain)
  end

  @single ~w(facts resources attributes)
  defp first(dir, kind) when kind in @single do
    case read(Path.join(dir, "#{kind}.json")) do
      %{^kind => defs} when map_size(defs) > 0 -> defs |> Map.keys() |> Enum.min()
      _ -> nil
    end
  end

  defp first(dir, kind) do
    case Path.wildcard(Path.join([dir, kind, "*.json"])) do
      [] -> nil
      paths -> paths |> Enum.min() |> Path.basename(".json")
    end
  end

  defp capabilities(caps),
    do: %{"requires" => %{"capabilities" => Map.new(caps, &{&1, 1})}}

  defp put(dir, files) do
    paths =
      for {rel, content} <- files, path = Path.join(dir, rel) do
        File.mkdir_p!(Path.dirname(path))
        File.write!(path, pretty(merge(read(path), content)))
        path
      end

    {:ok, Enum.sort(paths)}
  end

  defp read(path) do
    case File.read(path) do
      {:ok, text} -> JSON.decode!(text)
      _ -> %{}
    end
  end

  # Maps merge by key; a list or scalar in the starter replaces (layout lists every room afresh).
  defp merge(old, new) when is_map(old) and is_map(new),
    do: Map.merge(old, new, fn _, a, b -> merge(a, b) end)

  defp merge(_, new), do: new

  @doc false
  # Two-space JSON the author edits and the column's source finder reads one `"key":` per line.
  def pretty(value), do: IO.iodata_to_binary([pretty(value, ""), "\n"])

  defp pretty(map, pad) when is_map(map) and map_size(map) > 0 do
    rows =
      for {k, v} <- Enum.sort(map), do: [pad, "  ", JSON.encode!(k), ": ", pretty(v, pad <> "  ")]

    ["{\n", Enum.intersperse(rows, ",\n"), "\n", pad, "}"]
  end

  defp pretty(list, pad) when is_list(list) and list != [] do
    rows = for v <- list, do: [pad, "  ", pretty(v, pad <> "  ")]
    ["[\n", Enum.intersperse(rows, ",\n"), "\n", pad, "]"]
  end

  defp pretty(value, _), do: JSON.encode!(value)
end
