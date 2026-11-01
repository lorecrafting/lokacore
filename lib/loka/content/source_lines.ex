defmodule Loka.Content.SourceLines do
  @moduledoc "Where each source path sits: a JSON scan and a scene's own lines, for the compiler's words."

  alias Loka.Content.{CutFiles, SceneFiles, Source, SourceFiles}

  @doc "Source path => `{file, line}`, or `{file, line, column}` for a file that is not valid JSON."
  @spec index(Path.t()) :: %{String.t() => tuple()}
  def index(dir) do
    paths = SourceFiles.paths(dir)
    scenes = for rel <- paths, scene?(rel), into: %{}, do: {json_half(rel), rel}

    # Scenes first: a same-key JSON file merges over its scene, so its lines win.
    paths
    |> Enum.sort_by(&(not scene?(&1)))
    |> Enum.reduce(%{}, fn rel, acc ->
      # Gone since the compile (a save in progress): the line is lost, not the diagnostics.
      with {:ok, text} <- File.read(Path.join(dir, rel)) do
        read(rel, text, scenes, acc)
      else
        {:error, _} -> acc
      end
    end)
  end

  defp read(rel, text, scenes, acc) do
    if scene?(rel), do: scene(rel, text, acc), else: json(rel, text, scenes, acc)
  end

  defp scene?(rel), do: String.ends_with?(rel, [".scene", ".cut"])

  # The JSON file a scene file merges with.
  defp json_half(rel) do
    if Path.extname(rel) == ".cut",
      do: Path.rootname(rel) <> ".json",
      else: "dialogues/" <> Path.basename(rel, ".scene") <> ".json"
  end

  defp scene(rel, text, acc) do
    if(Path.extname(rel) == ".cut", do: CutFiles.lines(text), else: SceneFiles.lines(text))
    |> Enum.reduce(Map.put(acc, Source.at(rel, []), {rel, 1}), fn {steps, n}, acc ->
      Map.put(acc, Source.at(rel, steps), {rel, n})
    end)
  end

  defp json(rel, text, scenes, acc) do
    case JSON.decode(text) do
      {:ok, _} ->
        scene = scenes[rel]

        {_, _, acc} =
          value(text, [], 1, {scene || rel, rel}, Map.put(acc, Source.at(rel, []), {rel, 1}))

        acc

      {:error, reason} ->
        {line, column} = position(text, offset(reason))
        Map.put(acc, Source.at(rel, []), {rel, line, column})
    end
  end

  defp offset(:unexpected_end), do: nil
  defp offset(e), do: elem(e, 1)

  defp position(text, nil), do: position(text, byte_size(text))

  defp position(text, offset) do
    before = binary_part(text, 0, min(offset, byte_size(text)))
    lines = String.split(before, "\n")
    {length(lines), String.length(List.last(lines)) + 1}
  end

  # A walk over text JSON.decode already accepted: {rest, line, index with each key's line}.
  defp value(text, steps, line, rel, acc) do
    case ws(text, line) do
      {"{" <> rest, line} -> members(rest, steps, line, rel, acc)
      {"[" <> rest, line} -> items(rest, steps, 0, line, rel, acc)
      {"\"" <> _ = string, line} -> {string_rest(string), line, acc}
      {scalar, line} -> {scalar_rest(scalar), line, acc}
    end
  end

  defp members(text, steps, line, rel, acc) do
    case ws(text, line) do
      {"}" <> rest, line} ->
        {rest, line, acc}

      {"," <> rest, line} ->
        members(rest, steps, line, rel, acc)

      {"\"" <> _ = string, line} ->
        rest = string_rest(string)
        key = JSON.decode!(binary_part(string, 0, byte_size(string) - byte_size(rest)))
        {":" <> rest, after_colon} = ws(rest, line)
        at = steps ++ [key]

        {rest, line, acc} =
          value(rest, at, after_colon, rel, mark(acc, rel, at, line))

        members(rest, steps, line, rel, acc)
    end
  end

  defp items(text, steps, i, line, rel, acc) do
    case ws(text, line) do
      {"]" <> rest, line} ->
        {rest, line, acc}

      {"," <> rest, line} ->
        items(rest, steps, i, line, rel, acc)

      {item, line} ->
        at = steps ++ [i]

        {rest, line, acc} =
          value(item, at, line, rel, mark(acc, rel, at, line))

        items(rest, steps, i + 1, line, rel, acc)
    end
  end

  defp ws(<<?\n, rest::binary>>, line), do: ws(rest, line + 1)
  defp ws(<<c, rest::binary>>, line) when c in [?\s, ?\t, ?\r], do: ws(rest, line)
  defp ws(rest, line), do: {rest, line}

  # {the path's file, where it is written}: a sidecar's fields sit on its scene's paths.
  defp mark(acc, {path_file, file}, steps, line),
    do: Map.put(acc, Source.at(path_file, steps), {file, line})

  defp string_rest(<<?", rest::binary>>), do: after_quote(rest)

  defp after_quote(<<?\\, _, rest::binary>>), do: after_quote(rest)
  defp after_quote(<<?", rest::binary>>), do: rest
  defp after_quote(<<_, rest::binary>>), do: after_quote(rest)

  defp scalar_rest(<<c, _::binary>> = rest) when c in [?,, ?], ?}, ?\s, ?\t, ?\r, ?\n], do: rest
  defp scalar_rest(<<_, rest::binary>>), do: scalar_rest(rest)
  defp scalar_rest(""), do: ""
end
