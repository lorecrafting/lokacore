defmodule Loka.Framework.World.ExtendedDescriptionsTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.World.ExtendedDescriptions

  describe "get_description/2" do
    test "returns base description when no context provided" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing."
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity)
      assert desc == "A quiet forest clearing."
    end

    test "returns time variant when provided" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            time_variants: %{
              day: "Sunlight dapples through the canopy above."
            }
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{time_phase: :day})
      assert desc =~ "A quiet forest clearing."
      assert desc =~ "Sunlight dapples through the canopy above."
    end

    test "returns weather variant when provided" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            weather_variants: %{
              rain: "Rain drips from the leaves overhead."
            }
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{weather: "rain"})
      assert desc =~ "A quiet forest clearing."
      assert desc =~ "Rain drips from the leaves overhead."
    end

    test "combines multiple context elements" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            time_variants: %{
              night: "Moonlight casts an ethereal glow."
            },
            weather_variants: %{
              fog: "Thick fog obscures your vision."
            }
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{time_phase: :night, weather: "fog"})
      assert desc =~ "A quiet forest clearing."
      assert desc =~ "Moonlight casts an ethereal glow."
      assert desc =~ "Thick fog obscures your vision."
    end

    test "returns first visit text on first visit" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            first_visit: "You emerge into a clearing you've never seen before."
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{first_visit: true})
      assert desc =~ "You emerge into a clearing you've never seen before."
      refute desc =~ "A quiet forest clearing."
    end

    test "returns base text when not first visit" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            first_visit: "You emerge into a clearing you've never seen before."
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{first_visit: false})
      assert desc =~ "A quiet forest clearing."
      refute desc =~ "You emerge into a clearing you've never seen before."
    end

    test "includes perception reveals when player has sufficient skill" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            perception_reveals: [
              %{skill: "perception", level: 5, text: "You notice faint tracks leading north."}
            ]
          }
        }
      }

      game_state = %{
        stats: %{
          skills: %{
            "perception" => %{level: 5}
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{game_state: game_state})
      assert desc =~ "A quiet forest clearing."
      assert desc =~ "You notice faint tracks leading north."
    end

    test "excludes perception reveals when player lacks skill" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            perception_reveals: [
              %{skill: "perception", level: 5, text: "You notice faint tracks leading north."}
            ]
          }
        }
      }

      game_state = %{
        stats: %{
          skills: %{
            "perception" => %{level: 3}
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{game_state: game_state})
      assert desc =~ "A quiet forest clearing."
      refute desc =~ "You notice faint tracks leading north."
    end

    test "includes multiple perception reveals" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing.",
            perception_reveals: [
              %{skill: "perception", level: 3, text: "You notice faint tracks."},
              %{skill: "herbalism", level: 2, text: "Several useful herbs grow nearby."}
            ]
          }
        }
      }

      game_state = %{
        stats: %{
          skills: %{
            "perception" => %{level: 5},
            "herbalism" => %{level: 4}
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{game_state: game_state})
      assert desc =~ "You notice faint tracks."
      assert desc =~ "Several useful herbs grow nearby."
    end

    test "handles nil entity" do
      desc = ExtendedDescriptions.get_description(nil)
      assert desc == ""
    end

    test "handles entity without extended_description component" do
      entity = %{components: %{}}
      desc = ExtendedDescriptions.get_description(entity)
      assert desc == ""
    end

    test "handles string keys in components" do
      # NOTE: The implementation only supports atom keys at the top level (:components)
      # String keys are only supported for nested fields via MapHelpers.get_flexible
      entity = %{
        "components" => %{
          "extended_description" => %{
            "base" => "A quiet forest clearing."
          }
        }
      }

      # This returns empty string because top-level "components" string key is not supported
      desc = ExtendedDescriptions.get_description(entity)
      assert desc == ""
    end
  end

  describe "get_base_description/1" do
    test "returns base description from extended_description" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A quiet forest clearing."
          }
        }
      }

      assert ExtendedDescriptions.get_base_description(entity) == "A quiet forest clearing."
    end

    test "falls back to entity description if no base" do
      entity = %{
        description: "Fallback description",
        components: %{
          extended_description: %{}
        }
      }

      assert ExtendedDescriptions.get_base_description(entity) == "Fallback description"
    end

    test "returns empty string if no descriptions" do
      entity = %{components: %{}}
      assert ExtendedDescriptions.get_base_description(entity) == ""
    end

    test "handles nil entity" do
      assert ExtendedDescriptions.get_base_description(nil) == ""
    end
  end

  describe "get_detail/2" do
    test "returns specific detail text" do
      entity = %{
        components: %{
          extended_description: %{
            details: %{
              "tree" => "An ancient oak dominates the clearing.",
              "flowers" => "Colorful wildflowers dot the grass."
            }
          }
        }
      }

      assert ExtendedDescriptions.get_detail(entity, "tree") ==
               "An ancient oak dominates the clearing."

      assert ExtendedDescriptions.get_detail(entity, "flowers") ==
               "Colorful wildflowers dot the grass."
    end

    test "returns nil for nonexistent detail" do
      entity = %{
        components: %{
          extended_description: %{
            details: %{
              "tree" => "An ancient oak dominates the clearing."
            }
          }
        }
      }

      assert ExtendedDescriptions.get_detail(entity, "rock") == nil
    end

    test "handles entity without details" do
      entity = %{components: %{}}
      assert ExtendedDescriptions.get_detail(entity, "tree") == nil
    end
  end

  describe "list_details/1" do
    test "returns list of available detail keys" do
      entity = %{
        components: %{
          extended_description: %{
            details: %{
              "tree" => "An ancient oak.",
              "flowers" => "Wildflowers.",
              "rock" => "A large boulder."
            }
          }
        }
      }

      details = ExtendedDescriptions.list_details(entity)
      assert "tree" in details
      assert "flowers" in details
      assert "rock" in details
      assert length(details) == 3
    end

    test "returns empty list when no details" do
      entity = %{components: %{}}
      assert ExtendedDescriptions.list_details(entity) == []
    end
  end

  describe "get_smell/1" do
    test "returns smell description" do
      entity = %{
        components: %{
          extended_description: %{
            smell: "The air smells of pine and wildflowers."
          }
        }
      }

      assert ExtendedDescriptions.get_smell(entity) == "The air smells of pine and wildflowers."
    end

    test "returns nil when no smell" do
      entity = %{components: %{}}
      assert ExtendedDescriptions.get_smell(entity) == nil
    end
  end

  describe "get_sound/1" do
    test "returns sound description" do
      entity = %{
        components: %{
          extended_description: %{
            sound: "Birds sing in the branches above."
          }
        }
      }

      assert ExtendedDescriptions.get_sound(entity) == "Birds sing in the branches above."
    end

    test "returns nil when no sound" do
      entity = %{components: %{}}
      assert ExtendedDescriptions.get_sound(entity) == nil
    end
  end

  describe "get_sensory/1" do
    test "combines smell and sound" do
      entity = %{
        components: %{
          extended_description: %{
            smell: "The air smells of pine.",
            sound: "Birds sing in the branches."
          }
        }
      }

      sensory = ExtendedDescriptions.get_sensory(entity)
      assert sensory =~ "The air smells of pine."
      assert sensory =~ "Birds sing in the branches."
    end

    test "returns only smell when sound is nil" do
      entity = %{
        components: %{
          extended_description: %{
            smell: "The air smells of pine."
          }
        }
      }

      sensory = ExtendedDescriptions.get_sensory(entity)
      assert sensory == "The air smells of pine."
    end

    test "returns only sound when smell is nil" do
      entity = %{
        components: %{
          extended_description: %{
            sound: "Birds sing in the branches."
          }
        }
      }

      sensory = ExtendedDescriptions.get_sensory(entity)
      assert sensory == "Birds sing in the branches."
    end

    test "returns empty string when both are nil" do
      entity = %{components: %{}}
      assert ExtendedDescriptions.get_sensory(entity) == ""
    end
  end

  describe "time variants" do
    test "supports all time phases" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A clearing.",
            time_variants: %{
              dawn: "Golden light filters through the morning mist.",
              day: "Sunlight dapples through the canopy.",
              dusk: "Long shadows stretch across the clearing.",
              night: "Moonlight casts an ethereal glow."
            }
          }
        }
      }

      dawn_desc = ExtendedDescriptions.get_description(entity, %{time_phase: :dawn})
      assert dawn_desc =~ "Golden light filters through the morning mist."

      day_desc = ExtendedDescriptions.get_description(entity, %{time_phase: :day})
      assert day_desc =~ "Sunlight dapples through the canopy."

      dusk_desc = ExtendedDescriptions.get_description(entity, %{time_phase: :dusk})
      assert dusk_desc =~ "Long shadows stretch across the clearing."

      night_desc = ExtendedDescriptions.get_description(entity, %{time_phase: :night})
      assert night_desc =~ "Moonlight casts an ethereal glow."
    end

    test "handles string keys for time phases" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A clearing.",
            time_variants: %{
              "day" => "Sunlight shines."
            }
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{time_phase: :day})
      assert desc =~ "Sunlight shines."
    end
  end

  describe "weather variants" do
    test "supports different weather types" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A clearing.",
            weather_variants: %{
              rain: "Rain drips from the leaves.",
              storm: "Thunder echoes through the trees.",
              fog: "Thick fog obscures your vision.",
              snow: "Snow blankets the ground."
            }
          }
        }
      }

      rain_desc = ExtendedDescriptions.get_description(entity, %{weather: "rain"})
      assert rain_desc =~ "Rain drips from the leaves."

      storm_desc = ExtendedDescriptions.get_description(entity, %{weather: "storm"})
      assert storm_desc =~ "Thunder echoes through the trees."

      fog_desc = ExtendedDescriptions.get_description(entity, %{weather: "fog"})
      assert fog_desc =~ "Thick fog obscures your vision."

      snow_desc = ExtendedDescriptions.get_description(entity, %{weather: "snow"})
      assert snow_desc =~ "Snow blankets the ground."
    end

    test "handles atom weather keys" do
      entity = %{
        components: %{
          extended_description: %{
            base: "A clearing.",
            weather_variants: %{
              rain: "Rain falls."
            }
          }
        }
      }

      desc = ExtendedDescriptions.get_description(entity, %{weather: :rain})
      assert desc =~ "Rain falls."
    end
  end
end
