defmodule Loka.Framework.World.RoomElementsTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.World.RoomElements

  describe "get_elements/1" do
    test "returns default elements for nil entity" do
      elements = RoomElements.get_elements(nil)

      assert elements.water.level == :none
      assert elements.darkness.level == :none
      assert elements.elevation.type == :ground
      assert elements.terrain.type == :normal
      assert elements.temperature.level == :normal
      assert elements.vegetation.density == :none
    end

    test "returns default elements for entity without elements component" do
      entity = %{components: %{}}
      elements = RoomElements.get_elements(entity)

      assert elements.water.level == :none
      assert elements.darkness.level == :none
      assert elements.elevation.type == :ground
      assert elements.terrain.type == :normal
      assert elements.temperature.level == :normal
      assert elements.vegetation.density == :none
    end

    test "parses water element" do
      entity = %{
        components: %{
          elements: %{
            water: %{
              level: "high",
              type: "river"
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.water.level == :high
      assert elements.water.type == "river"
    end

    test "parses darkness element" do
      entity = %{
        components: %{
          elements: %{
            darkness: %{
              level: "total",
              light_required: true
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.darkness.level == :total
      assert elements.darkness.light_required == true
    end

    test "parses elevation element" do
      entity = %{
        components: %{
          elements: %{
            elevation: %{
              type: "elevated",
              height: 5
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.elevation.type == :elevated
      assert elements.elevation.height == 5
    end

    test "parses terrain element" do
      entity = %{
        components: %{
          elements: %{
            terrain: %{
              type: "rough",
              movement_cost: 1.5
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.terrain.type == :rough
      assert elements.terrain.movement_cost == 1.5
    end

    test "parses temperature element" do
      entity = %{
        components: %{
          elements: %{
            temperature: %{
              level: "cold"
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.temperature.level == :cold
    end

    test "parses vegetation element" do
      entity = %{
        components: %{
          elements: %{
            vegetation: %{
              density: "high",
              type: "forest"
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.vegetation.density == :high
      assert elements.vegetation.type == "forest"
    end

    test "handles string keys in components" do
      entity = %{
        components: %{
          "elements" => %{
            "water" => %{
              "level" => "medium"
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.water.level == :medium
    end

    test "handles atom level values" do
      entity = %{
        components: %{
          elements: %{
            water: %{level: :high}
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.water.level == :high
    end

    test "uses default movement cost based on terrain type" do
      entity = %{
        components: %{
          elements: %{
            terrain: %{type: "difficult"}
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.terrain.type == :difficult
      assert elements.terrain.movement_cost == 1.5
    end

    test "allows custom movement cost override" do
      entity = %{
        components: %{
          elements: %{
            terrain: %{
              type: "normal",
              movement_cost: 2.0
            }
          }
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.terrain.type == :normal
      assert elements.terrain.movement_cost == 2.0
    end
  end

  describe "get_element/2" do
    test "returns specific element" do
      entity = %{
        components: %{
          elements: %{
            water: %{level: "high"}
          }
        }
      }

      water = RoomElements.get_element(entity, :water)
      assert water.level == :high
    end

    test "returns default for missing element" do
      entity = %{components: %{}}

      water = RoomElements.get_element(entity, :water)
      assert water.level == :none
    end
  end

  describe "get_fire_modifier/1" do
    test "returns 0 for no water" do
      entity = %{components: %{}}
      assert RoomElements.get_fire_modifier(entity) == 0.0
    end

    test "returns -0.1 for low water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "low"}}
        }
      }

      assert RoomElements.get_fire_modifier(entity) == -0.1
    end

    test "returns -0.25 for medium water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "medium"}}
        }
      }

      assert RoomElements.get_fire_modifier(entity) == -0.25
    end

    test "returns -0.5 for high water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "high"}}
        }
      }

      assert RoomElements.get_fire_modifier(entity) == -0.5
    end
  end

  describe "get_lightning_modifier/1" do
    test "returns 0 for no water" do
      entity = %{components: %{}}
      assert RoomElements.get_lightning_modifier(entity) == 0.0
    end

    test "returns 0.1 for low water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "low"}}
        }
      }

      assert RoomElements.get_lightning_modifier(entity) == 0.1
    end

    test "returns 0.25 for medium water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "medium"}}
        }
      }

      assert RoomElements.get_lightning_modifier(entity) == 0.25
    end

    test "returns 0.5 for high water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "high"}}
        }
      }

      assert RoomElements.get_lightning_modifier(entity) == 0.5
    end
  end

  describe "get_accuracy_modifier/2" do
    test "returns 0 for no darkness" do
      entity = %{components: %{}}
      assert RoomElements.get_accuracy_modifier(entity) == 0
    end

    test "returns 0 with light source regardless of darkness" do
      entity = %{
        components: %{
          elements: %{darkness: %{level: "total"}}
        }
      }

      assert RoomElements.get_accuracy_modifier(entity, true) == 0
    end

    test "returns -0.1 for dim darkness without light" do
      entity = %{
        components: %{
          elements: %{darkness: %{level: "dim"}}
        }
      }

      assert RoomElements.get_accuracy_modifier(entity, false) == -0.1
    end

    test "returns -0.25 for dark darkness without light" do
      entity = %{
        components: %{
          elements: %{darkness: %{level: "dark"}}
        }
      }

      assert RoomElements.get_accuracy_modifier(entity, false) == -0.25
    end

    test "returns -0.5 for total darkness without light" do
      entity = %{
        components: %{
          elements: %{darkness: %{level: "total"}}
        }
      }

      assert RoomElements.get_accuracy_modifier(entity, false) == -0.5
    end
  end

  describe "get_movement_cost/1" do
    test "returns 1.0 for normal terrain" do
      entity = %{components: %{}}
      assert RoomElements.get_movement_cost(entity) == 1.0
    end

    test "returns 1.25 for rough terrain" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "rough"}}
        }
      }

      assert RoomElements.get_movement_cost(entity) == 1.25
    end

    test "returns 1.5 for difficult terrain" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "difficult"}}
        }
      }

      assert RoomElements.get_movement_cost(entity) == 1.5
    end

    test "returns 999 for impassable terrain" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "impassable"}}
        }
      }

      assert RoomElements.get_movement_cost(entity) == 999
    end
  end

  describe "requires_light?/1" do
    test "returns false for no darkness" do
      entity = %{components: %{}}
      refute RoomElements.requires_light?(entity)
    end

    test "returns false when light not required" do
      entity = %{
        components: %{
          elements: %{
            darkness: %{
              level: "dim",
              light_required: false
            }
          }
        }
      }

      refute RoomElements.requires_light?(entity)
    end

    test "returns true when light is required" do
      entity = %{
        components: %{
          elements: %{
            darkness: %{
              level: "total",
              light_required: true
            }
          }
        }
      }

      assert RoomElements.requires_light?(entity)
    end
  end

  describe "passable?/1" do
    test "returns true for normal terrain" do
      entity = %{components: %{}}
      assert RoomElements.passable?(entity)
    end

    test "returns true for rough terrain" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "rough"}}
        }
      }

      assert RoomElements.passable?(entity)
    end

    test "returns true for difficult terrain" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "difficult"}}
        }
      }

      assert RoomElements.passable?(entity)
    end

    test "returns false for impassable terrain" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "impassable"}}
        }
      }

      refute RoomElements.passable?(entity)
    end
  end

  describe "get_temperature_modifier/1" do
    test "returns 0 for normal temperature" do
      entity = %{components: %{}}
      assert RoomElements.get_temperature_modifier(entity) == 0
    end

    test "returns -2 for freezing temperature" do
      entity = %{
        components: %{
          elements: %{temperature: %{level: "freezing"}}
        }
      }

      assert RoomElements.get_temperature_modifier(entity) == -2
    end

    test "returns -1 for cold temperature" do
      entity = %{
        components: %{
          elements: %{temperature: %{level: "cold"}}
        }
      }

      assert RoomElements.get_temperature_modifier(entity) == -1
    end

    test "returns 1 for hot temperature" do
      entity = %{
        components: %{
          elements: %{temperature: %{level: "hot"}}
        }
      }

      assert RoomElements.get_temperature_modifier(entity) == 1
    end

    test "returns 2 for scorching temperature" do
      entity = %{
        components: %{
          elements: %{temperature: %{level: "scorching"}}
        }
      }

      assert RoomElements.get_temperature_modifier(entity) == 2
    end
  end

  describe "has_water?/1" do
    test "returns false for no water" do
      entity = %{components: %{}}
      refute RoomElements.has_water?(entity)
    end

    test "returns true for low water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "low"}}
        }
      }

      assert RoomElements.has_water?(entity)
    end

    test "returns true for medium water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "medium"}}
        }
      }

      assert RoomElements.has_water?(entity)
    end

    test "returns true for high water" do
      entity = %{
        components: %{
          elements: %{water: %{level: "high"}}
        }
      }

      assert RoomElements.has_water?(entity)
    end
  end

  describe "has_vegetation?/1" do
    test "returns false for no vegetation" do
      entity = %{components: %{}}
      refute RoomElements.has_vegetation?(entity)
    end

    test "returns false for sparse vegetation" do
      entity = %{
        components: %{
          elements: %{vegetation: %{density: :sparse}}
        }
      }

      refute RoomElements.has_vegetation?(entity)
    end

    test "returns true for normal vegetation" do
      entity = %{
        components: %{
          elements: %{vegetation: %{density: :normal}}
        }
      }

      assert RoomElements.has_vegetation?(entity)
    end

    test "returns true for dense vegetation" do
      entity = %{
        components: %{
          elements: %{vegetation: %{density: :dense}}
        }
      }

      assert RoomElements.has_vegetation?(entity)
    end
  end

  describe "level parsing" do
    test "parses all valid level strings" do
      for level_str <- ["none", "low", "medium", "high"] do
        entity = %{
          components: %{
            elements: %{water: %{level: level_str}}
          }
        }

        elements = RoomElements.get_elements(entity)
        assert elements.water.level == String.to_atom(level_str)
      end
    end

    test "defaults to :none for invalid level" do
      entity = %{
        components: %{
          elements: %{water: %{level: "invalid"}}
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.water.level == :none
    end
  end

  describe "darkness level parsing" do
    test "parses all valid darkness levels" do
      for level_str <- ["none", "dim", "dark", "total"] do
        entity = %{
          components: %{
            elements: %{darkness: %{level: level_str}}
          }
        }

        elements = RoomElements.get_elements(entity)
        assert elements.darkness.level == String.to_atom(level_str)
      end
    end

    test "defaults to :none for invalid darkness level" do
      entity = %{
        components: %{
          elements: %{darkness: %{level: "invalid"}}
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.darkness.level == :none
    end
  end

  describe "elevation type parsing" do
    test "parses all valid elevation types" do
      for type_str <- ["underground", "ground", "elevated"] do
        entity = %{
          components: %{
            elements: %{elevation: %{type: type_str}}
          }
        }

        elements = RoomElements.get_elements(entity)
        assert elements.elevation.type == String.to_atom(type_str)
      end
    end

    test "defaults to :ground for invalid elevation type" do
      entity = %{
        components: %{
          elements: %{elevation: %{type: "invalid"}}
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.elevation.type == :ground
    end
  end

  describe "terrain type parsing" do
    test "parses all valid terrain types" do
      for type_str <- ["normal", "rough", "difficult", "impassable"] do
        entity = %{
          components: %{
            elements: %{terrain: %{type: type_str}}
          }
        }

        elements = RoomElements.get_elements(entity)
        assert elements.terrain.type == String.to_atom(type_str)
      end
    end

    test "defaults to :normal for invalid terrain type" do
      entity = %{
        components: %{
          elements: %{terrain: %{type: "invalid"}}
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.terrain.type == :normal
    end
  end

  describe "temperature level parsing" do
    test "parses all valid temperature levels" do
      for level_str <- ["freezing", "cold", "normal", "hot", "scorching"] do
        entity = %{
          components: %{
            elements: %{temperature: %{level: level_str}}
          }
        }

        elements = RoomElements.get_elements(entity)
        assert elements.temperature.level == String.to_atom(level_str)
      end
    end

    test "defaults to :normal for invalid temperature level" do
      entity = %{
        components: %{
          elements: %{temperature: %{level: "invalid"}}
        }
      }

      elements = RoomElements.get_elements(entity)
      assert elements.temperature.level == :normal
    end
  end
end
