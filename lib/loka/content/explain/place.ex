defmodule Loka.Content.Explain.Place do
  @moduledoc """
  Where a diagnostic sits in the source: `rel` (the file), `line` and, for invalid JSON, `column`,
  from the source-line index; `text/1` is the place as `Loka.Content.Explain.lines/2` prints it.
  """

  @doc "The diagnostic's `rel`, `line` and `column`, each nil when the path has no source line."
  @spec of(map(), map()) :: map()
  def of(%{"path" => path, "data" => data}, index) do
    {rel, line, column} =
      case index[prefix(path, index)] do
        nil -> {nil, nil, nil}
        {file, line, column} -> {file, line, column}
        {file, line} -> {file, data["line"] || line, nil}
      end

    %{"rel" => rel, "line" => line, "column" => column}
  end

  @doc "The place in the printed line: `file:line[:column]`, else the path, else the cartridge."
  @spec text(map()) :: String.t()
  def text(%{"rel" => nil, "path" => ""}), do: "the cartridge:"
  def text(%{"rel" => nil, "path" => path}), do: "#{path}:"
  def text(%{"rel" => rel, "line" => line, "column" => nil}), do: "#{rel}:#{line}"
  def text(%{"rel" => rel, "line" => line, "column" => column}), do: "#{rel}:#{line}:#{column}"

  @doc "The longest indexed path this path starts with, on a step boundary (a missing field has no line)."
  @spec prefix(String.t(), map()) :: String.t() | nil
  def prefix(path, index) do
    index
    |> Map.keys()
    |> Enum.filter(fn k ->
      path == k or String.starts_with?(path, k <> ".") or String.starts_with?(path, k <> "[")
    end)
    |> Enum.max_by(&byte_size/1, fn -> nil end)
  end
end
