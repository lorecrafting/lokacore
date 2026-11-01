defmodule Loka.Content.Starters do
  @moduledoc """
  `bin/loka new <kind> <name>`: writes a compiling starter for one source kind with every line a
  `~` placeholder (docs/guides/writing-the-game.md#coverage). A starter is JSON merged into the
  files it touches, plus the capabilities it needs in cartridge.json; a kind that references
  another (an item needs a room) takes the first existing one and refuses without it. A starter
  never replaces what is there: a value that differs refuses the whole starter, before any write.
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
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  def write(dir, kind, name) do
    with :ok <- valid_name(name, kind),
         :ok <- in_cartridge(dir),
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
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  @doc "The kinds `write/3` knows, sorted (the guide's coverage table lists each)."
  def kinds, do: ["cartridge" | Map.keys(Templates.kinds())] |> Enum.sort()

  # A text key may be dotted (`service.unaffordable`); every other name is a file or map key.
  defp valid_name(name, kind \\ nil) do
    pattern = if kind == "text", do: ~r/^[a-z][a-z0-9_.]{0,63}$/, else: ~r/^[a-z][a-z0-9_]{0,63}$/

    if name =~ pattern,
      do: :ok,
      else:
        {:error, "a name is lowercase letters, digits and _, 64 at most (got #{inspect(name)})"}
  end

  defp in_cartridge(dir) do
    if File.exists?(Path.join(dir, "cartridge.json")),
      do: :ok,
      else: {:error, "no cartridge.json in #{dir}: bin/loka new cartridge <dir> first"}
  end

  defp or_unknown(:error, kind),
    do: {:error, "unknown kind #{inspect(kind)}; one of: #{Enum.join(kinds(), " ")}"}

  defp or_unknown(found, _), do: found

  # The first key of each kind the template references (dirs only: an area bundle's npcs are not
  # scanned), plus every room, bundled ones too, for layout's completeness check.
  defp context(dir, needs) do
    start = %{"room_list" => rooms(dir), "layout" => layout_rows(dir)}

    Enum.reduce_while(needs, {:ok, start}, fn kind, {:ok, acc} ->
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

  defp layout_rows(dir) do
    case read(Path.join(dir, "layout.json")) do
      rows when is_list(rows) -> rows
      _ -> []
    end
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
    touched =
      for {rel, new} <- files, path = Path.join(dir, rel), do: {rel, path, read(path), new}

    case Enum.find_value(touched, fn {rel, _, old, new} -> clash(old, new, rel <> ":") end) do
      nil ->
        {:ok, touched |> Enum.map(&written/1) |> Enum.sort()}

      at ->
        {:error,
         "#{at} already has a value and a starter never replaces one; nothing was written"}
    end
  end

  defp written({_, path, old, new}) do
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, pretty(merge(old, new)))
    path
  end

  # Where the starter would replace something: a scalar or shape that differs, or a list of rows
  # that drops one. Lists of names union (below).
  defp clash(old, _, _) when old == %{}, do: nil
  defp clash(same, same, _), do: nil

  defp clash(old, new, at) when is_list(old) and is_list(new) do
    if Enum.all?(new, &is_binary/1) or old -- new == [], do: nil, else: at
  end

  defp clash(old, new, at) when is_map(old) and is_map(new) do
    Enum.find_value(new, fn {k, v} ->
      if is_map_key(old, k), do: clash(old[k], v, at <> " " <> k)
    end)
  end

  defp clash(_, _, at), do: at

  defp read(path) do
    case File.read(path) do
      {:ok, text} ->
        case JSON.decode(text) do
          {:ok, value} -> value
          _ -> throw({:bad_json, path})
        end

      _ ->
        %{}
    end
  end

  # Maps merge by key; a list of names unions (an npc's services); a list of rows (layout) replaces,
  # the template having kept the rows already placed. clash/3 has refused any other difference.
  defp merge(old, new) when is_map(old) and is_map(new),
    do: Map.merge(old, new, fn _, a, b -> merge(a, b) end)

  defp merge(old, new) when is_list(old) and is_list(new) do
    if Enum.all?(new, &is_binary/1), do: Enum.uniq(old ++ new), else: new
  end

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
