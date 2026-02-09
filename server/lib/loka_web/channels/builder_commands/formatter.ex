defmodule LokaWeb.Channels.BuilderCommands.Formatter do
  @moduledoc """
  Text formatting helpers for structured terminal output.
  """

  @doc """
  Formats a list of rows into aligned columns.

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
        |> Enum.map(fn row -> row |> Enum.at(i, "") |> to_string() |> String.length() end)
        |> Enum.max()
      end)

    format_row = fn row ->
      row
      |> Enum.zip(widths)
      |> Enum.map(fn {cell, width} -> String.pad_trailing(to_string(cell), width) end)
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
    max_width = lines |> Enum.map(&String.length/1) |> Enum.max(fn -> 0 end)

    top = "┌─#{String.duplicate("─", max_width)}─┐"
    bottom = "└─#{String.duplicate("─", max_width)}─┘"

    middle =
      Enum.map(lines, fn line ->
        "│ #{String.pad_trailing(line, max_width)} │"
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
