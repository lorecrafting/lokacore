defmodule Loka.Content.Starters.Area do
  @moduledoc """
  Area folders for `Loka.Content.Starters`: which file holds a definition, and where `--area` puts a
  new one (cartridge area layout design, section 7).
  """

  @doc "The one area folder's copy of `rel` (`areas/<area>/<rel>`), else the root one (a new file)."
  def home(dir, rel) do
    case Path.wildcard(Path.join([dir, "areas/*", rel])) do
      [found] -> Path.relative_to(found, dir)
      _ -> rel
    end
  end

  @doc "The decoded JSON at `path`, `%{}` when it is missing; throws `{:bad_json, path}`."
  def read(path) do
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

  @doc "The area a starter goes into: `area` once checked, else the `from` room's area folder."
  def pick(_, _, nil, nil), do: {:ok, nil}

  # A bundled or root room's new neighbour goes to the root.
  def pick(dir, _, nil, {room, _}) do
    case Path.split(home(dir, "rooms/#{room}.json")) do
      ["areas", area | _] -> {:ok, area}
      _ -> {:ok, nil}
    end
  end

  def pick(dir, kind, area, _) do
    cond do
      !(area =~ ~r/^[a-z][a-z0-9_]{0,63}$/) ->
        {:error, "--area: an area is lowercase letters, digits and _, 64 at most (got #{area})"}

      kind != "rooms" and first_room(dir, area) == nil ->
        {:error, "no rooms in areas/#{area} yet: bin/loka new areas #{area} first"}

      true ->
        {:ok, area}
    end
  end

  @doc "The first room file in `areas/<area>/rooms/`, or nil."
  def first_room(dir, area) do
    case Path.wildcard(Path.join([dir, "areas", area, "rooms/*.json"])) do
      [first | _] -> Path.basename(first, ".json")
      [] -> nil
    end
  end

  @doc "Moves the template's root body for `own` (`areas/<area>/<rel>`) to `own`."
  def moved(files, "areas/" <> _ = own) do
    case Map.pop(files, own |> Path.split() |> Enum.drop(2) |> Path.join()) do
      {nil, files} -> files
      {body, files} -> Map.put(files, own, body)
    end
  end

  def moved(files, _root), do: files
end
