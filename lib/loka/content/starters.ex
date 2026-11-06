# size: allow 336, the area folder lookups (a room or starter file in any areas/<area>/) and --extends and the provider's resource start join the starter writer
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
  alias Loka.Content.Starters.{Area, Child, Copy, Merge, Parts, Templates}

  @doc """
  Writes the starter; `{:ok, paths it changed}` or `{:error, one line for the author}`. `from` is
  `{room, direction}`: a new room joined to an existing one by exits both ways, in that room's area
  folder. `before_write.(path, old bytes or nil)` runs before each file is written, so a caller can
  undo; a refusal calls it for none. `area` places every new file of the starter in `areas/<area>/`,
  and a room it needs is that area's first room; with `from`, it wins (a border room). `extends`
  makes the starter's own file a child of that abstract parent (Starters.Child).
  """
  @spec write(
          Path.t(),
          String.t(),
          String.t(),
          {String.t(), String.t()} | nil,
          (Path.t(), binary() | nil -> any()),
          {String.t() | nil, String.t() | nil}
        ) :: {:ok, [Path.t()]} | {:error, String.t()}
  def write(dir, kind, name, from \\ nil, hook \\ fn _, _ -> :ok end, place \\ {nil, nil})

  def write(_dir, "cartridge", path, from, hook, _place) do
    cond do
      File.exists?(Path.join(path, "cartridge.json")) -> {:error, "#{path}/cartridge.json exists"}
      valid_name(Path.basename(path)) != :ok -> valid_name(Path.basename(path))
      from -> Copy.cartridge(from, path, hook)
      true -> put(path, Templates.cartridge(Path.basename(path)), nil, hook)
    end
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
  end

  # An area is a folder that starts with a room of its own name.
  def write(dir, "areas", name, from, hook, {nil, up}),
    do: write(dir, "rooms", name, from, hook, {name, up})

  def write(_, "areas", name, _, _, {area, _}),
    do: {:error, "areas #{name} is its own area: drop --area #{area}"}

  def write(dir, kind, name, from, hook, {area, extends}) do
    with :ok <- valid_name(name, kind),
         :ok <- in_cartridge(dir),
         {:ok, template} <- Map.fetch(Templates.kinds(), kind) |> or_unknown(kind),
         {:ok, area} <- Area.pick(dir, kind, area, from),
         own = own(dir, kind, name, area),
         {:ok, up} <- Child.parent(dir, dir_of(kind), extends, own),
         do: build(dir, {kind, name, from, area, own}, template, hook, up)
  catch
    {:bad_json, file} -> {:error, "#{file} is not valid JSON: fix it first"}
    :bad_layout -> {:error, "layout.json: every row needs a number x, y and z: fix it first"}
    {:bad_area, file} -> {:error, "#{file} needs a rooms object: fix it first"}
  end

  defp build(dir, {kind, name, from, area, own}, {caps, needs, make}, hook, up) do
    with {:ok, context} <- context(dir, needs, area),
         {:ok, context} <- placed(context, dir, kind, name, from, own) do
      files =
        make.(name, context)
        |> owned(dir, own, up)
        |> with_capabilities(caps)
        |> kept_lines(dir, kind)
        |> with_layout(dir, context, name)

      put(dir, files, if(from, do: nil, else: own), hook)
    end
  end

  defp owned(files, dir, own, up), do: files |> Area.moved(dir, own) |> Child.extending(own, up)

  defp with_capabilities(files, caps) do
    declared = capabilities(caps)
    Map.update(files, "cartridge.json", declared, &Merge.merge(&1, declared))
  end

  defp own(dir, kind, name, nil), do: home(dir, "#{dir_of(kind)}/#{name}.json")
  defp own(_, kind, name, area), do: "areas/#{area}/#{dir_of(kind)}/#{name}.json"

  # A cutscene is a `scenes/` file; `scene` would name the writer's `.scene` format.
  defp dir_of("cutscene"), do: "scenes"
  defp dir_of(kind), do: kind

  @doc "The kinds `write/4` knows, sorted (the guide's coverage table lists each)."
  def kinds, do: ["cartridge" | Map.keys(Templates.kinds())] |> Enum.sort()

  # A text key may be dotted (`service.unaffordable`); every other name is a file or map key.
  def valid_name(name, kind \\ nil) do
    pattern = if kind == "text", do: ~r/^[a-z][a-z0-9_.]{0,63}$/, else: ~r/^[a-z][a-z0-9_]{0,63}$/

    # A template derives longer keys and text paths from the name; 32 leaves them all under theirs.
    room = if kind == "text", do: 64, else: 32

    if name =~ pattern and String.length(name) <= room,
      do: :ok,
      else:
        {:error,
         "a name is lowercase letters, digits and _, #{room} at most (got #{inspect(name)})"}
  end

  def in_cartridge(dir) do
    if File.exists?(Path.join(dir, "cartridge.json")),
      do: :ok,
      else: {:error, "no cartridge.json in #{dir}: bin/loka new cartridge <dir> first"}
  end

  defp or_unknown(:error, kind),
    do: {:error, "unknown kind #{inspect(kind)}; one of: #{Enum.join(kinds(), " ")}"}

  defp or_unknown(found, _), do: found

  # The first key of each kind the template references (dirs only: an area bundle's npcs are not
  # scanned), plus every room, bundled ones too, for layout's completeness check.
  defp context(dir, needs, area) do
    room_list = rooms(dir)
    entry = with %{"entry" => e} <- read(Path.join(dir, "cartridge.json")), do: e

    start = %{
      "room_list" => room_list,
      "layout" => layout_rows(dir),
      "entry" => (area && Area.first_room(dir, area)) || if(entry in room_list, do: entry)
    }

    Enum.reduce_while(needs, {:ok, start}, fn kind, {:ok, acc} ->
      case first(dir, kind, start["entry"], area) do
        nil ->
          {:halt, {:error, "no #{missing(kind)} yet: bin/loka new #{missing(kind)} <name> first"}}

        key ->
          {:cont, {:ok, acc |> Map.put(kind, key) |> Map.merge(starts(dir, kind, key))}}
      end
    end)
  end

  # A provider holds the resource's own start: resources.ex:109-116 refuses one outside min..max.
  defp starts(dir, "resources", key),
    do: %{"resource_start" => read(Path.join(dir, "resources.json"))["resources"][key]["start"]}

  defp starts(_, _, _), do: %{}

  defp placed(context, dir, kind, name, from, own) do
    with :ok <- new_room(dir, kind, name, context, own), do: joined(context, dir, name, from)
  end

  # A rerun finds its own file; another file holding the room would be a duplicate definition.
  defp new_room(dir, kind, name, c, own) do
    if kind == "rooms" and name in c["room_list"] and !File.exists?(Path.join(dir, own)),
      do: {:error, "a room #{name} already exists in another file"},
      else: :ok
  end

  defp joined(context, _, _, nil), do: {:ok, context}

  defp joined(context, dir, name, {room, way}) do
    back = Barriers.opposite(way)

    cond do
      # An authored room: a compiler key, up to 64; the starter derives nothing from it.
      !(room =~ ~r/^[a-z][a-z0-9_]{0,63}$/) ->
        {:error, "--from: a room is lowercase letters, digits and _, 64 at most (got #{room})"}

      !back ->
        {:error, "--from: a direction is north, south, east, west, up or down (got #{way})"}

      room == name ->
        {:error, "--from: a room cannot join itself"}

      !File.exists?(Path.join(dir, home(dir, "rooms/#{room}.json"))) ->
        {:error, "--from: no rooms/#{room}.json"}

      true ->
        {:ok, Map.put(context, "from", {room, way, back})}
    end
  end

  defp with_layout(%{"layout.json" => _} = files, _, _, _), do: files

  defp with_layout(files, dir, c, name) do
    if File.exists?(Path.join(dir, "layout.json")) do
      rooms =
        Enum.uniq(
          c["room_list"] ++ Enum.flat_map(files, fn {rel, b} -> rooms_in(Path.split(rel), b) end)
        )

      Map.put(files, "layout.json", Templates.with_rows(c["layout"], rooms, name, c["from"]))
    else
      files
    end
  end

  defp rooms_in(["rooms", file], _), do: [Path.basename(file, ".json")]
  defp rooms_in(["areas", _ | rel], body), do: rooms_in(rel, body)
  defp rooms_in(_, _), do: []

  defp rooms(dir) do
    bundled =
      for a <- Path.wildcard(Path.join(dir, "areas/*.json")),
          r <- area_rooms(a),
          do: r

    plain = for r <- own_files(dir, "rooms"), do: Path.basename(r, ".json")
    Enum.sort(bundled ++ plain)
  end

  defp area_rooms(file) do
    case read(file) do
      %{"rooms" => %{} = rooms} -> Map.keys(rooms)
      area when is_map(area) and not is_map_key(area, "rooms") -> []
      _ -> throw({:bad_area, file})
    end
  end

  defp layout_rows(dir) do
    case read(Path.join(dir, "layout.json")) do
      rows when is_list(rows) ->
        if Enum.all?(rows, &placed_row?/1), do: rows, else: throw(:bad_layout)

      _ ->
        []
    end
  end

  defp placed_row?(row), do: is_map(row) and Enum.all?(~w(x y z), &is_number(row[&1]))

  @single ~w(facts resources attributes)
  defp first(dir, kind, _, _) when kind in @single do
    case read(Path.join(dir, "#{kind}.json")) do
      %{^kind => defs} when map_size(defs) > 0 -> defs |> Map.keys() |> Enum.min()
      _ -> nil
    end
  end

  # "entry" is a room reference, bundled or not; "rooms" is a room with its own file to merge into.
  defp first(dir, "entry", entry, area), do: entry || first(dir, "rooms", entry, area)

  # An area file may name only the root's and its own area's definitions (area_crossing).
  defp first(dir, kind, entry, area) do
    keys = for p <- own_files(dir, kind, area || "*"), do: Path.basename(p, ".json")
    if kind == "rooms" and entry in keys, do: entry, else: List.first(keys)
  end

  # One file per definition, at the root or in an area folder (`area`, or any); sorted by key.
  defp own_files(dir, kind, area \\ "*") do
    (Path.wildcard(Path.join([dir, kind, "*.json"])) ++
       Path.wildcard(Path.join([dir, "areas", area, kind, "*.json"])))
    |> Enum.sort_by(&Path.basename/1)
  end

  defp missing("entry"), do: "rooms"
  defp missing(kind), do: kind

  defp capabilities(caps),
    do: %{"requires" => %{"capabilities" => Map.new(caps, &{&1, 1})}}

  # A line kinds share (`transport.unaffordable`) stays as the author filled it: a second transport
  # asks for no new words. `new text <key>` names its one line, so a rerun still refuses there.
  defp kept_lines(%{"text.json" => new} = files, dir, kind) when kind != "text" do
    case read(Path.join(dir, "text.json")) do
      %{} = old -> %{files | "text.json" => Map.reject(new, fn {k, _} -> is_binary(old[k]) end)}
      _ -> files
    end
  end

  defp kept_lines(files, _, _), do: files

  # `own`, the file this starter names, is the author's once it exists: a rerun checks it, and never
  # adds back what the author removed. A file an area folder holds is written there.
  def put(dir, files, own, hook) do
    touched =
      for {rel, new} <- files,
          rel = home(dir, rel),
          path = Path.join(dir, rel),
          do: {rel, path, read(path), new}

    case Enum.find_value(touched, fn {rel, _, old, new} -> Merge.clash(old, new, rel <> ":") end) do
      nil ->
        {:ok, touched |> Enum.reject(&authored?(&1, own)) |> write_all(hook)}

      at ->
        {:error, refusal(at, own)}
    end
  end

  defp write_all(touched, hook), do: touched |> Enum.flat_map(&written(&1, hook)) |> Enum.sort()

  defp authored?({rel, path, _, _}, own), do: rel == own and File.exists?(path)

  # `~` is the starter's stand-in, so words go back to it. Any other value only comes back outside
  # `own`, which a rerun never writes: emptying it there would break the compile.
  defp refusal(at, own) do
    said = "#{at} already has a value and a starter never replaces one; nothing was written"
    other = if own == nil, do: "use another --from direction, or ", else: ""

    cond do
      at =~ ": exits " ->
        said <> ". That exit is taken: #{other}move it in both rooms' files and rerun"

      own != nil and String.starts_with?(at, own <> ":") ->
        said <>
          ". If it is words, set it to ~ and rerun; keep any other value and skip this rerun"

      # A second population wants these too; deleting them orphans the first one's corpse items.
      at =~ ": world death " ->
        said <>
          ". A cartridge has one death setup: keep it, then copy the first population's populations, npcs (_npc) and items (_item, _corpse) files under the new name and point the new population file's npc, item and corpse at the copies"

      true ->
        said <> ". If it is words, set it to ~; delete any other value; then rerun"
    end
  end

  # An unchanged file keeps its bytes, the author's formatting too.
  defp written({_, path, old, new}, hook) do
    case Merge.merge(old, new) do
      ^old ->
        []

      merged ->
        hook.(path, if(File.exists?(path), do: File.read!(path)))
        File.mkdir_p!(Path.dirname(path))
        File.write!(path, Parts.pretty(merged))
        [path]
    end
  end

  defdelegate home(dir, rel), to: Area
  defdelegate read(path), to: Area
end
