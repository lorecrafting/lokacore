defmodule LokaWeb.Channels.BuilderCommands.Formatter do
  @moduledoc """
  Text formatting helpers for structured terminal output.
  """

  @doc """
  Returns the display length of a string, stripping `{{cmd:...}}` and `{{/cmd}}` markers.

  These markers are invisible to the user (parsed client-side into clickable links),
  so column alignment must use display length, not raw string length.

      iex> display_length("{{cmd:goto tavern}}tavern{{/cmd}}")
      6
      iex> display_length("plain text")
      10
  """
  def display_length(str) do
    str
    |> to_string()
    |> String.replace(~r/\{\{cmd:[^}]+\}\}/, "")
    |> String.replace("{{/cmd}}", "")
    |> String.length()
  end

  @doc """
  Formats a list of rows into aligned columns.
  Uses `display_length/1` for width calculation so `{{cmd:...}}` markup doesn't
  break column alignment.

      iex> table(["Name", "Key"], [["Bob", "bob"], ["Alice", "alice"]])
      "Name   Key\\n─────  ─────\\nBob    bob\\nAlice  alice"
  """
  def table(headers, rows, opts \\ []) do
    all = [headers | rows]
    col_count = length(headers)
    padding = Keyword.get(opts, :padding, 2)

    widths =
      Enum.map(0..(col_count - 1), fn i ->
        all
        |> Enum.map(fn row -> row |> Enum.at(i, "") |> to_string() |> display_length() end)
        |> Enum.max()
      end)

    format_row = fn row ->
      row
      |> Enum.zip(widths)
      |> Enum.map(fn {cell, width} ->
        cell_str = to_string(cell)
        pad = width - display_length(cell_str)
        cell_str <> String.duplicate(" ", max(pad, 0))
      end)
      |> Enum.join(String.duplicate(" ", padding))
      |> String.trim_trailing()
    end

    separator =
      widths
      |> Enum.map(fn w -> String.duplicate("─", w) end)
      |> Enum.join(String.duplicate(" ", padding))

    header_line = format_row.(headers)
    data_lines = Enum.map(rows, format_row)

    Enum.join([header_line, separator | data_lines], "\n")
  end

  @doc """
  Formats a titled section with indented content.

      iex> section("Rooms", "  tavern\\n  market")
      "── Rooms ──\\n  tavern\\n  market"
  """
  def section(title, content) do
    "── #{title} ──\n#{content}"
  end

  @doc """
  Formats key-value pairs into aligned output.

      iex> key_value([{"Name", "Bob"}, {"Key", "bob"}])
      "  Name: Bob\\n  Key:  bob"
  """
  def key_value(pairs) do
    max_key =
      pairs
      |> Enum.map(fn {k, _} -> String.length(to_string(k)) end)
      |> Enum.max(fn -> 0 end)

    pairs
    |> Enum.map(fn {k, v} ->
      key_str = String.pad_trailing(to_string(k), max_key)
      "  #{key_str}: #{v}"
    end)
    |> Enum.join("\n")
  end

  @doc """
  Wraps text in a simple box.

      iex> box("Hello")
      "┌───────┐\\n│ Hello │\\n└───────┘"
  """
  def box(text) do
    lines = String.split(text, "\n")
    max_width = lines |> Enum.map(&display_length/1) |> Enum.max(fn -> 0 end)

    top = "┌─#{String.duplicate("─", max_width)}─┐"
    bottom = "└─#{String.duplicate("─", max_width)}─┘"

    middle =
      Enum.map(lines, fn line ->
        pad = max_width - display_length(line)
        "│ #{line}#{String.duplicate(" ", max(pad, 0))} │"
      end)

    Enum.join([top | middle] ++ [bottom], "\n")
  end

  @doc """
  Formats a count with label, e.g. "3 rooms" or "1 room".
  """
  def count_label(n, singular, plural \\ nil) do
    plural = plural || "#{singular}s"
    if n == 1, do: "1 #{singular}", else: "#{n} #{plural}"
  end
end
