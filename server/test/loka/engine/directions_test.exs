defmodule Loka.Engine.DirectionsTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Directions

  describe "all/0" do
    test "returns all supported directions" do
      directions = Directions.all()

      assert "north" in directions
      assert "south" in directions
      assert "east" in directions
      assert "west" in directions
      assert "up" in directions
      assert "down" in directions
      assert length(directions) == 6
    end
  end

  describe "cardinal/0" do
    test "returns only cardinal directions" do
      directions = Directions.cardinal()

      assert "north" in directions
      assert "south" in directions
      assert "east" in directions
      assert "west" in directions
      assert length(directions) == 4
      refute "up" in directions
      refute "down" in directions
    end
  end

  describe "vertical/0" do
    test "returns only vertical directions" do
      directions = Directions.vertical()

      assert "up" in directions
      assert "down" in directions
      assert length(directions) == 2
      refute "north" in directions
    end
  end

  describe "offset/1" do
    test "returns correct offset for north" do
      assert {0, -1, 0} = Directions.offset("north")
    end

    test "returns correct offset for south" do
      assert {0, 1, 0} = Directions.offset("south")
    end

    test "returns correct offset for east" do
      assert {1, 0, 0} = Directions.offset("east")
    end

    test "returns correct offset for west" do
      assert {-1, 0, 0} = Directions.offset("west")
    end

    test "returns correct offset for up" do
      assert {0, 0, 1} = Directions.offset("up")
    end

    test "returns correct offset for down" do
      assert {0, 0, -1} = Directions.offset("down")
    end

    test "handles atom input" do
      assert {0, -1, 0} = Directions.offset(:north)
    end

    test "is case insensitive" do
      assert {0, -1, 0} = Directions.offset("NORTH")
      assert {0, -1, 0} = Directions.offset("North")
    end

    test "returns nil for invalid direction" do
      assert nil == Directions.offset("invalid")
      assert nil == Directions.offset("sideways")
    end
  end

  describe "offsets/0" do
    test "returns all direction offsets as a map" do
      offsets = Directions.offsets()

      assert is_map(offsets)
      assert offsets["north"] == {0, -1, 0}
      assert offsets["south"] == {0, 1, 0}
      assert offsets["east"] == {1, 0, 0}
      assert offsets["west"] == {-1, 0, 0}
      assert offsets["up"] == {0, 0, 1}
      assert offsets["down"] == {0, 0, -1}
    end
  end

  describe "opposite/1" do
    test "returns south for north" do
      assert "south" = Directions.opposite("north")
    end

    test "returns north for south" do
      assert "north" = Directions.opposite("south")
    end

    test "returns west for east" do
      assert "west" = Directions.opposite("east")
    end

    test "returns east for west" do
      assert "east" = Directions.opposite("west")
    end

    test "returns down for up" do
      assert "down" = Directions.opposite("up")
    end

    test "returns up for down" do
      assert "up" = Directions.opposite("down")
    end

    test "handles atom input" do
      assert "south" = Directions.opposite(:north)
    end

    test "is case insensitive" do
      assert "south" = Directions.opposite("NORTH")
    end

    test "returns nil for invalid direction" do
      assert nil == Directions.opposite("invalid")
    end
  end

  describe "valid?/1" do
    test "returns true for valid string directions" do
      assert Directions.valid?("north")
      assert Directions.valid?("south")
      assert Directions.valid?("east")
      assert Directions.valid?("west")
      assert Directions.valid?("up")
      assert Directions.valid?("down")
    end

    test "returns true for valid atom directions" do
      assert Directions.valid?(:north)
      assert Directions.valid?(:up)
    end

    test "is case insensitive" do
      assert Directions.valid?("NORTH")
      assert Directions.valid?("North")
    end

    test "returns false for invalid directions" do
      refute Directions.valid?("sideways")
      refute Directions.valid?("diagonal")
      refute Directions.valid?(:invalid)
    end
  end

  describe "normalize/1" do
    test "normalizes uppercase to lowercase" do
      assert "north" = Directions.normalize("NORTH")
      assert "south" = Directions.normalize("SOUTH")
    end

    test "normalizes mixed case" do
      assert "east" = Directions.normalize("East")
      assert "west" = Directions.normalize("wEsT")
    end

    test "handles atom input" do
      assert "north" = Directions.normalize(:north)
      assert "up" = Directions.normalize(:UP)
    end

    test "returns nil for invalid direction" do
      assert nil == Directions.normalize("invalid")
      assert nil == Directions.normalize(:invalid)
    end

    test "returns already lowercase direction unchanged" do
      assert "north" = Directions.normalize("north")
    end
  end

  describe "infer_from_coords/2" do
    test "infers east when moving in positive x direction" do
      assert "east" = Directions.infer_from_coords({0, 0, 0}, {1, 0, 0})
      assert "east" = Directions.infer_from_coords({5, 5, 0}, {10, 5, 0})
    end

    test "infers west when moving in negative x direction" do
      assert "west" = Directions.infer_from_coords({0, 0, 0}, {-1, 0, 0})
      assert "west" = Directions.infer_from_coords({10, 5, 0}, {5, 5, 0})
    end

    test "infers north when moving in negative y direction" do
      assert "north" = Directions.infer_from_coords({0, 0, 0}, {0, -1, 0})
      assert "north" = Directions.infer_from_coords({5, 10, 0}, {5, 5, 0})
    end

    test "infers south when moving in positive y direction" do
      assert "south" = Directions.infer_from_coords({0, 0, 0}, {0, 1, 0})
      assert "south" = Directions.infer_from_coords({5, 5, 0}, {5, 10, 0})
    end

    test "infers up when moving in positive z direction" do
      assert "up" = Directions.infer_from_coords({0, 0, 0}, {0, 0, 1})
      assert "up" = Directions.infer_from_coords({5, 5, 0}, {5, 5, 5})
    end

    test "infers down when moving in negative z direction" do
      assert "down" = Directions.infer_from_coords({0, 0, 0}, {0, 0, -1})
      assert "down" = Directions.infer_from_coords({5, 5, 5}, {5, 5, 0})
    end

    test "z direction takes priority over xy" do
      # Even with x/y offset, z offset wins
      assert "up" = Directions.infer_from_coords({0, 0, 0}, {1, 1, 1})
      assert "down" = Directions.infer_from_coords({0, 0, 0}, {1, 1, -1})
    end

    test "returns nil when no movement" do
      assert nil == Directions.infer_from_coords({0, 0, 0}, {0, 0, 0})
      assert nil == Directions.infer_from_coords({5, 5, 5}, {5, 5, 5})
    end

    test "prefers cardinal direction with larger offset for diagonals" do
      # X offset larger than Y
      assert "east" = Directions.infer_from_coords({0, 0, 0}, {5, 1, 0})
      assert "west" = Directions.infer_from_coords({0, 0, 0}, {-5, 1, 0})

      # Y offset larger than X
      assert "south" = Directions.infer_from_coords({0, 0, 0}, {1, 5, 0})
      assert "north" = Directions.infer_from_coords({0, 0, 0}, {1, -5, 0})
    end
  end
end
