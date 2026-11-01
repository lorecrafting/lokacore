defmodule Loka.Content.Starters do
  @moduledoc """
  `bin/loka new <kind> <name>`: writes a compiling starter for one source kind with every line a
  `~` placeholder (docs/guides/writing-the-game.md#coverage). A starter is JSON merged into the
  files it touches, plus the capabilities it needs in cartridge.json; a kind that references
  another (an item needs a room) takes the first existing one, the entry for a room, and refuses
  without it. A starter never replaces what is there: a value that differs refuses the whole
  starter, before any write. Every starter adds the rows an existing layout.json lacks.
  """
  alias Loka.Content.Barriers
  alias Loka.Content.Starters.Templates

  @doc """
  Writes the starter; `{:ok, paths it changed}` or `{:error, one line for the author}`. `from` is
  `{room, direction}`: a new room joined to an existing one by exits both ways.
  """
  @spec write(Path.t(), String.t(), String.t(), {String.t(), String.t()} | nil) ::
          {:ok, [Path.t()]} | {:error, String.t()}
  def write(dir, kind, name, from \\ nil)

  def write(_dir, "cartridge", path, _from) do
    cond do
      File.exists?(Path.join(path, "cartridge.json")) -> {:error, "#{path}/cartridge.json exists"}
      valid_name(Path.basename(path)) != :ok -> valid_name(Path.basename(path))
      true -> put(path, Templates.cartridge(Path.basename(path)))
    end
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  def write(dir, kind, name, from) do
    with :ok <- valid_name(name, kind),
         :ok <- in_cartridge(dir),
         {:ok, {caps, needs, make}} <- Map.fetch(Templates.kinds(), kind) |> or_unknown(kind),
         {:ok, context} <- context(dir, needs),
         {:ok, context} <- joined(context, dir, name, from) do
      files = with_capabilities(make.(name, context), caps)
      put(dir, with_layout(files, dir, context))
    end
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  defp with_capabilities(files, caps) do
    declared = capabilities(caps)
    Map.update(files, "cartridge.json", declared, &merge(&1, declared))
  end

  @doc "The kinds `write/4` knows, sorted (the guide's coverage table lists each)."
  def kinds, do: ["cartridge" | Map.keys(Templates.kinds())] |> Enum.sort()

  # A text key may be dotted (`service.unaffordable`); every other name is a file or map key.
  defp valid_name(name, kind \\ nil) do
    pattern = if kind == "text", do: ~r/^[a-z][a-z0-9_.]{0,63}$/, else: ~r/^[a-z][a-z0-9_]{0,63}$/

    # scenes and topics also write <name>_quest or <name>_known, under the same 64.
    room = if kind in ~w(scenes topics), do: 58, else: 64

    if name =~ pattern and String.length(name) <= room,
      do: :ok,
      else:
        {:error,
         "a name is lowercase letters, digits and _, #{room} at most (got #{inspect(name)})"}
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
    room_list = rooms(dir)
    entry = with %{"entry" => e} <- read(Path.join(dir, "cartridge.json")), do: e

    start = %{
      "room_list" => room_list,
      "layout" => layout_rows(dir),
      "entry" => if(entry in room_list, do: entry)
    }

    Enum.reduce_while(needs, {:ok, start}, fn kind, {:ok, acc} ->
      case first(dir, kind, start["entry"]) do
        nil ->
          {:halt, {:error, "no #{missing(kind)} yet: bin/loka new #{missing(kind)} <name> first"}}

        key ->
          {:cont, {:ok, Map.put(acc, kind, key)}}
      end
    end)
  end

  defp joined(context, _, _, nil), do: {:ok, context}

  defp joined(context, dir, name, {room, way}) do
    back = Barriers.opposite(way)

    cond do
      valid_name(room) != :ok ->
        valid_name(room)

      !back ->
        {:error, "--from: a direction is north, south, east, west, up or down (got #{way})"}

      room == name ->
        {:error, "--from: a room cannot join itself"}

      !File.exists?(Path.join(dir, "rooms/#{room}.json")) ->
        {:error, "--from: no rooms/#{room}.json"}

      true ->
        {:ok, Map.put(context, "from", {room, way, back})}
    end
  end

  defp with_layout(%{"layout.json" => _} = files, _, _), do: files

  defp with_layout(files, dir, c) do
    if File.exists?(Path.join(dir, "layout.json")) do
      rooms =
        Enum.uniq(c["room_list"] ++ Enum.flat_map(files, fn {rel, b} -> rooms_in(rel, b) end))

      Map.put(files, "layout.json", Templates.with_rows(c["layout"], rooms))
    else
      files
    end
  end

  defp rooms_in("rooms/" <> file, _), do: [Path.basename(file, ".json")]
  defp rooms_in("areas/" <> _, body), do: Map.keys(body["rooms"])
  defp rooms_in(_, _), do: []

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
  defp first(dir, kind, _) when kind in @single do
    case read(Path.join(dir, "#{kind}.json")) do
      %{^kind => defs} when map_size(defs) > 0 -> defs |> Map.keys() |> Enum.min()
      _ -> nil
    end
  end

  # "entry" is a room reference, bundled or not; "rooms" is a room with its own file to merge into.
  defp first(dir, "entry", entry), do: entry || first(dir, "rooms", entry)

  defp first(dir, kind, entry) do
    keys = for p <- Path.wildcard(Path.join([dir, kind, "*.json"])), do: Path.basename(p, ".json")
    if kind == "rooms" and entry in keys, do: entry, else: List.first(keys)
  end

  defp missing("entry"), do: "rooms"
  defp missing(kind), do: kind

  defp capabilities(caps),
    do: %{"requires" => %{"capabilities" => Map.new(caps, &{&1, 1})}}

  defp put(dir, files) do
    touched =
      for {rel, new} <- files, path = Path.join(dir, rel), do: {rel, path, read(path), new}

    case Enum.find_value(touched, fn {rel, _, old, new} -> clash(old, new, rel <> ":") end) do
      nil ->
        {:ok, touched |> Enum.flat_map(&written/1) |> Enum.sort()}

      at ->
        {:error,
         "#{at} already has a value and a starter never replaces one; nothing was written"}
    end
  end

  # An unchanged file keeps its bytes, the author's formatting too.
  defp written({_, path, old, new}) do
    case merge(old, new) do
      ^old ->
        []

      merged ->
        File.mkdir_p!(Path.dirname(path))
        File.write!(path, pretty(merged))
        [path]
    end
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
