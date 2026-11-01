defmodule Loka.Content.SourceLines do
  @moduledoc "Where each source path sits: a JSON scan and a scene's own lines, for the compiler's words."

  alias Loka.Content.{SceneFiles, Source, SourceFiles}

  @doc "Source path => `{file, line}`, or `{file, line, column}` for a file that is not valid JSON."
  @spec index(Path.t()) :: %{String.t() => tuple()}
  def index(dir) do
    dir
    |> SourceFiles.paths()
    |> Enum.reduce(%{}, fn rel, acc ->
      text = File.read!(Path.join(dir, rel))

      if String.ends_with?(rel, ".scene"),
        do: scene(rel, text, acc),
        else: json(rel, text, acc)
    end)
  end

  defp scene(rel, text, acc) do
    text
    |> SceneFiles.lines()
    |> Enum.reduce(Map.put(acc, Source.at(rel, []), {rel, 1}), fn {steps, n}, acc ->
      Map.put(acc, Source.at(rel, steps), {rel, n})
    end)
  end

  defp json(rel, text, acc) do
    case JSON.decode(text) do
      {:ok, _} ->
        {_, _, acc} = value(text, [], 1, rel, Map.put(acc, Source.at(rel, []), {rel, 1}))
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
      {scalar, line} -> {Regex.replace(~r/^[^,\]\}\s]+/, scalar, ""), line, acc}
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
          value(rest, at, after_colon, rel, Map.put(acc, Source.at(rel, at), {rel, line}))

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
          value(item, at, line, rel, Map.put(acc, Source.at(rel, at), {rel, line}))

        items(rest, steps, i + 1, line, rel, acc)
    end
  end

  defp ws(<<?\n, rest::binary>>, line), do: ws(rest, line + 1)
  defp ws(<<c, rest::binary>>, line) when c in [?\s, ?\t, ?\r], do: ws(rest, line)
  defp ws(rest, line), do: {rest, line}

  defp string_rest(string), do: Regex.replace(~r/^"(?:[^"\\]|\\.)*"/s, string, "")
end
