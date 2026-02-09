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

  describe "key_value/1" do
    test "formats key-value pairs with alignment" do
      result = Formatter.key_value([{"Name", "Bob"}, {"Key", "bob"}])

      # Keys are padded to max key length, colon follows padded key
      assert result == "  Name: Bob\n  Key : bob"
    end

    test "aligns to longest key" do
      result = Formatter.key_value([{"ID", "1"}, {"Description", "A thing"}])

      assert result =~ "  ID         : 1"
      assert result =~ "  Description: A thing"
    end

    test "handles single pair" do
      result = Formatter.key_value([{"Name", "Alice"}])

      assert result == "  Name: Alice"
    end
  end

  describe "box/1" do
    test "wraps text in a box" do
      result = Formatter.box("Hello")

      assert result == "┌───────┐\n│ Hello │\n└───────┘"
    end

    test "handles multiline text" do
      result = Formatter.box("Line 1\nLine 2")

      assert result =~ "┌────────┐"
      assert result =~ "│ Line 1 │"
      assert result =~ "│ Line 2 │"
      assert result =~ "└────────┘"
    end

    test "pads shorter lines to max width" do
      result = Formatter.box("Short\nA longer line")

      lines = String.split(result, "\n")
      # All lines should be same length
      lengths = Enum.map(lines, &String.length/1)
      assert length(Enum.uniq(lengths)) == 1
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
