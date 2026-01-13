alias Loka.Framework.World.RoomElements
alias Loka.Utils.MapHelpers

# Test 1: vegetation
entity1 = %{
  components: %{
    elements: %{
      vegetation: %{
        density: "dense",
        type: "forest"
      }
    }
  }
}

IO.puts("=== Test 1: Vegetation ===")
components1 = Map.get(entity1, :components, %{})
IO.inspect(components1, label: "components1")
elements_data1 = MapHelpers.get_flexible(components1, :elements, %{})
IO.inspect(elements_data1, label: "elements_data1")
vegetation1 = MapHelpers.get_flexible(elements_data1, :vegetation, %{})
IO.inspect(vegetation1, label: "vegetation1")
density1 = MapHelpers.get_flexible(vegetation1, :density, :none)
IO.inspect(density1, label: "density1")

elements1 = RoomElements.get_elements(entity1)
IO.inspect(elements1.vegetation, label: "parsed vegetation")

# Test 2: water (which works)
entity2 = %{
  components: %{
    elements: %{
      water: %{
        level: "high",
        type: "river"
      }
    }
  }
}

IO.puts("\n=== Test 2: Water ===")
elements2 = RoomElements.get_elements(entity2)
IO.inspect(elements2.water, label: "parsed water")

# Test 3: string keys
entity3 = %{
  "components" => %{
    "elements" => %{
      "water" => %{
        "level" => "medium"
      }
    }
  }
}

IO.puts("\n=== Test 3: String keys ===")
elements3 = RoomElements.get_elements(entity3)
IO.inspect(elements3.water, label: "parsed water (string keys)")
