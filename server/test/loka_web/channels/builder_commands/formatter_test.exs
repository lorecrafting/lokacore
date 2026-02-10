defmodule LokaWeb.Channels.BuilderCommands.FormatterTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.BuilderCommands.Formatter

  describe "table/3" do
    test "formats headers and rows into aligned columns" do
      result = Formatter.table(["Name", "Key"], [["Bob", "bob"], ["Alice", "alice"]])

      assert result == "Name   Key\n─────  ─────\nBob    bob\nAlice  alice"
    end

    test "handles varying column widths" do
      result = Formatter.table(["ID", "Description"], [["1", "Short"], ["100", "A longer value"]])

      assert result =~ "ID   Description"
      assert result =~ "1    Short"
      assert result =~ "100  A longer value"
    end

    test "handles single column" do
      result = Formatter.table(["Name"], [["Alice"], ["Bob"]])

      # Separator width matches longest cell ("Alice" = 5 chars)
      assert result == "Name\n─────\nAlice\nBob"
    end

    test "handles empty rows" do
      result = Formatter.table(["Name", "Key"], [])

      assert result == "Name  Key\n────  ───"
    end

    test "respects custom padding" do
      result = Formatter.table(["A", "B"], [["1", "2"]], padding: 4)

      assert result =~ "A    B"
      assert result =~ "1    2"
    end

    test "trims trailing whitespace from rows" do
      result = Formatter.table(["Name", "Key"], [["Bob", "bob"]])
      lines = String.split(result, "\n")

      for line <- lines do
        assert line == String.trim_trailing(line)
      end
    end
  end

  describe "section/2" do
    test "formats titled section" do
      result = Formatter.section("Rooms", "  tavern\n  market")

      assert result == "── Rooms ──\n  tavern\n  market"
    end

    test "works with empty content" do
      result = Formatter.section("Empty", "")

      assert result == "── Empty ──\n"
    end
  end

  describe "display_length/1" do
    test "returns length of plain text" do
      assert Formatter.display_length("hello") == 5
    end

    test "strips cmd markup from length calculation" do
      assert Formatter.display_length("{{cmd:goto tavern}}tavern{{/cmd}}") == 6
    end

    test "handles multiple markup spans" do
      text = "{{cmd:info a}}a{{/cmd}} - {{cmd:look b}}b{{/cmd}}"
      # visible: "a - b" = 5
      assert Formatter.display_length(text) == 5
    end

    test "handles text with no markup" do
      assert Formatter.display_length("no markup here") == 14
    end

    test "handles empty string" do
      assert Formatter.display_length("") == 0
    end
  end

  describe "table/3 with markup" do
    test "aligns columns correctly despite cmd markup in cells" do
      rows = [
        ["{{cmd:goto tavern}}tavern{{/cmd}}", "The Tavern"],
        ["{{cmd:goto market_square}}market_square{{/cmd}}", "Market Square"]
      ]

      result = Formatter.table(["Key", "Name"], rows)
      lines = String.split(result, "\n")

      # The separator should be based on display length, not raw length
      # "market_square" is the longest key (13 chars)
      [header, separator | data_lines] = lines

      # Header "Key" is padded to display width of longest key column
      assert String.starts_with?(header, "Key")

      # Data lines: the visible text should align
      # Despite markup, padding should make columns line up visually
      Enum.each(data_lines, fn line ->
        # Strip markup to check visual alignment
        visible = String.replace(line, ~r/\{\{cmd:[^}]+\}\}/, "")
        visible = String.replace(visible, "{{/cmd}}", "")
        # All visible lines should have consistent structure
        assert visible =~ ~r/\S/
      end)

      # Separator dashes should match display widths
      [sep_key, _sep_name] = String.split(separator, ~r/\s{2,}/, parts: 2)
      assert String.length(sep_key) == 13
    end
  end

  describe "count_label/3" do
    test "singular for count of 1" do
      assert Formatter.count_label(1, "room") == "1 room"
    end

    test "plural for count of 0" do
      assert Formatter.count_label(0, "room") == "0 rooms"
    end

    test "plural for count > 1" do
      assert Formatter.count_label(5, "room") == "5 rooms"
    end

    test "custom plural form" do
      assert Formatter.count_label(3, "entity", "entities") == "3 entities"
    end

    test "custom plural not used for singular" do
      assert Formatter.count_label(1, "entity", "entities") == "1 entity"
    end
  end
end
