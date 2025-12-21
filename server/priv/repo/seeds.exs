# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     Exmud.Repo.insert!(%Exmud.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias Exmud.Engine.Entities

IO.puts("Seeding demo world...")

# =============================================================================
# ROOMS
# =============================================================================

# Check if rooms already exist to avoid duplicates
existing_oak = Entities.get_entity_by_key("room_oak_tree")

if existing_oak do
  IO.puts("Demo world already seeded. Skipping...")
else
  IO.puts("Creating rooms...")

  {:ok, oak_tree} =
    Entities.create_entity(%{
      type: :room,
      key: "room_oak_tree",
      name: "Under a Giant Oak Tree",
      description:
        "A serene and rustic space nestled beneath the sprawling branches of a majestic oak. " <>
          "The air is fragrant with the earthy scent of moss and wildflowers, providing a tranquil " <>
          "retreat from the world. Above, the oak's massive limbs cradle a dense canopy, filtering " <>
          "sunlight into dappled patterns that dance across the ground."
    })

  {:ok, deep_forest} =
    Entities.create_entity(%{
      type: :room,
      key: "room_deep_forest",
      name: "Deep Forest",
      description:
        "The forest grows thick and dark here. Ancient trees tower overhead, their gnarled branches " <>
          "intertwining to form a living ceiling that blocks most of the sky. The undergrowth is dense " <>
          "with ferns and moss, and the air carries the damp smell of decaying leaves. Strange sounds " <>
          "echo in the distance."
    })

  {:ok, village_path} =
    Entities.create_entity(%{
      type: :room,
      key: "room_village_path",
      name: "Village Path",
      description:
        "A well-worn dirt path winds its way toward civilization. Wheel ruts and footprints mark " <>
          "the passage of countless travelers. Wildflowers line the edges, and in the distance, " <>
          "you can make out the faint outline of thatched roofs. The sounds of village life drift " <>
          "on the breeze."
    })

  {:ok, river_bank} =
    Entities.create_entity(%{
      type: :room,
      key: "room_river_bank",
      name: "River Bank",
      description:
        "The gentle sound of flowing water fills the air as a clear river winds past smooth stones " <>
          "and sandy banks. Willows dip their branches into the current, and dragonflies dart across " <>
          "the surface. The water looks cool and inviting, reflecting the sky like a rippling mirror."
    })

  IO.puts("Created 4 rooms.")

  # =============================================================================
  # EXITS (Bidirectional connections)
  # =============================================================================

  IO.puts("Creating exits...")

  # Oak Tree exits
  {:ok, _} =
    Entities.create_entity(%{
      type: :exit,
      key: "exit_oak_north",
      name: "north",
      description: "A path leads deeper into the forest.",
      location_id: oak_tree.id,
      components: %{
        "direction" => "north",
        "destination_id" => deep_forest.id,
        "destination_name" => "Deep Forest"
      }
    })

  {:ok, _} =
    Entities.create_entity(%{
      type: :exit,
      key: "exit_oak_east",
      name: "east",
      description: "A path leads toward the village.",
      location_id: oak_tree.id,
      components: %{
        "direction" => "east",
        "destination_id" => village_path.id,
        "destination_name" => "Village Path"
      }
    })

  {:ok, _} =
    Entities.create_entity(%{
      type: :exit,
      key: "exit_oak_west",
      name: "west",
      description: "A path leads to the river.",
      location_id: oak_tree.id,
      components: %{
        "direction" => "west",
        "destination_id" => river_bank.id,
        "destination_name" => "River Bank"
      }
    })

  # Deep Forest exits (back to Oak)
  {:ok, _} =
    Entities.create_entity(%{
      type: :exit,
      key: "exit_forest_south",
      name: "south",
      description: "A path leads back to the oak tree.",
      location_id: deep_forest.id,
      components: %{
        "direction" => "south",
        "destination_id" => oak_tree.id,
        "destination_name" => "Under a Giant Oak Tree"
      }
    })

  # Village Path exits (back to Oak)
  {:ok, _} =
    Entities.create_entity(%{
      type: :exit,
      key: "exit_village_west",
      name: "west",
      description: "A path leads back toward the forest.",
      location_id: village_path.id,
      components: %{
        "direction" => "west",
        "destination_id" => oak_tree.id,
        "destination_name" => "Under a Giant Oak Tree"
      }
    })

  # River Bank exits (back to Oak)
  {:ok, _} =
    Entities.create_entity(%{
      type: :exit,
      key: "exit_river_east",
      name: "east",
      description: "A path leads back to the oak tree.",
      location_id: river_bank.id,
      components: %{
        "direction" => "east",
        "destination_id" => oak_tree.id,
        "destination_name" => "Under a Giant Oak Tree"
      }
    })

  IO.puts("Created 6 exits.")

  # =============================================================================
  # NPCs
  # =============================================================================

  IO.puts("Creating NPCs...")

  {:ok, _druid} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_druid",
      name: "druid",
      description:
        "An elderly druid in flowing dark green robes. Silver hair cascades down to weathered " <>
          "shoulders, and wise eyes peer out from beneath heavy brows. Ancient runes are " <>
          "embroidered along the hem of the robes, glowing faintly with mystical energy.",
      location_id: oak_tree.id,
      components: %{
        "short_desc" => "in dark green robes hobbles over an altar preparing a ceremony",
        "conversant" => %{
          "dialogue_tree_id" => "druid_greeting"
        },
        "quest_giver" => %{
          "quests" => ["quest_find_leaf"]
        },
        "dialogue_tree" => %{
          "start" => %{
            "text" => "Greetings, traveler. The forest spirits whisper of your arrival. What brings you to this sacred grove?",
            "choices" => [
              %{"text" => "I seek adventure and purpose.", "next" => "quest_offer"},
              %{"text" => "Tell me about this place.", "next" => "about_grove"},
              %{"text" => "I was just passing through.", "next" => "farewell"}
            ]
          },
          "quest_offer" => %{
            "text" => "Ah, a seeker of purpose. The oak tree above us is ancient and wise, but it grows weak. I require a special leaf—one touched by golden light—for a ceremony of renewal. Would you find it for me?",
            "choices" => [
              %{"text" => "I will find this leaf for you.", "next" => "quest_accepted", "action" => ["accept_quest", "quest_find_leaf"]},
              %{"text" => "Perhaps another time.", "next" => "farewell"}
            ]
          },
          "quest_accepted" => %{
            "text" => "Blessings upon you, traveler. The leaf you seek glimmers with golden veins. It should be here beneath the oak, resting upon the ground. Return it to me when you find it.",
            "choices" => [
              %{"text" => "I will return soon.", "next" => nil}
            ]
          },
          "about_grove" => %{
            "text" => "This grove has stood for a thousand years, a sanctuary where the veil between worlds grows thin. Many travelers pass through seeking wisdom or respite. The oak tree watches over all who enter with peaceful hearts.",
            "choices" => [
              %{"text" => "It's beautiful here.", "next" => "start"},
              %{"text" => "Thank you for sharing.", "next" => "farewell"}
            ]
          },
          "farewell" => %{
            "text" => "May the forest spirits guide your path, traveler. Return whenever the road grows weary.",
            "choices" => []
          }
        }
      }
    })

  {:ok, _explorer} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_explorer",
      name: "explorer",
      description:
        "A grizzled explorer with sun-weathered skin and a thousand-yard stare. Scars crisscross " <>
          "exposed forearms, each one a story. A battered leather pack hangs from one shoulder, " <>
          "stuffed with maps and trinkets from distant lands.",
      location_id: oak_tree.id,
      components: %{
        "short_desc" => "A grizzled",
        "suffix" => "latches onto his canteen full of rum sits here",
        "conversant" => %{
          "dialogue_tree_id" => "explorer_greeting"
        }
      }
    })

  {:ok, _adventurer} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_adventurer",
      name: "adventurer",
      description:
        "A dark-eyed adventurer in practical traveling clothes. Despite the relaxed posture, " <>
          "there's a coiled readiness about them, like a spring waiting to be released. A " <>
          "well-maintained sword hangs at their hip.",
      location_id: oak_tree.id,
      components: %{
        "short_desc" => "A dark eyed",
        "suffix" => "waits here patiently",
        "conversant" => %{
          "dialogue_tree_id" => "adventurer_greeting"
        }
      }
    })

  IO.puts("Created 3 NPCs.")

  # =============================================================================
  # ITEMS
  # =============================================================================

  IO.puts("Creating items...")

  {:ok, _leaf} =
    Entities.create_entity(%{
      type: :item,
      key: "item_ancient_leaf",
      name: "leaf",
      description:
        "An ancient oak leaf, perfectly preserved despite its apparent age. Golden veins " <>
          "run through the deep green surface, and it feels warm to the touch. There's " <>
          "something magical about it.",
      location_id: oak_tree.id,
      components: %{
        "desc" => "An ancient golden",
        "suffix" => "has meandered its way to the ground"
      }
    })

  {:ok, _chalice} =
    Entities.create_entity(%{
      type: :item,
      key: "item_golden_chalice",
      name: "chalice",
      description:
        "A golden chalice of exquisite craftsmanship. Intricate patterns of vines and leaves " <>
          "are etched into its surface. Despite being on the ground, it gleams as if freshly " <>
          "polished.",
      location_id: oak_tree.id,
      components: %{
        "desc" => "A golden",
        "suffix" => "sits here on the floor"
      }
    })

  {:ok, _sword} =
    Entities.create_entity(%{
      type: :item,
      key: "item_practice_sword",
      name: "sword",
      description:
        "A dusty wooden practice sword, well-worn from countless training sessions. Despite " <>
          "its humble appearance, the balance is surprisingly good. Notches along the blade " <>
          "tell of many sparring matches.",
      location_id: oak_tree.id,
      components: %{
        "desc" => "A dusty wooden practice",
        "suffix" => "sits here on the ground",
        "equipable" => %{
          "slot" => "weapon",
          "bonuses" => %{"attack" => 2}
        }
      }
    })

  IO.puts("Created 3 items.")

  # =============================================================================
  # QUEST
  # =============================================================================

  IO.puts("Creating quest...")

  {:ok, _quest} =
    Entities.create_entity(%{
      type: :item,
      key: "quest_find_leaf",
      name: "The Druid's Request",
      description: "Find the ancient leaf for the druid's ceremony.",
      components: %{
        "quest" => %{
          "title" => "The Druid's Request",
          "description" =>
            "The druid needs an ancient leaf for an important ceremony. " <>
              "Find the golden leaf somewhere beneath the oak tree.",
          "objectives" => %{
            "find_leaf" => %{
              "type" => "get_item",
              "target" => "item_ancient_leaf",
              "description" => "Find the ancient golden leaf",
              "required" => 1
            }
          },
          "rewards" => %{
            "xp" => 50,
            "gold" => 10
          }
        }
      }
    })

  IO.puts("Created 1 quest.")

  IO.puts("")
  IO.puts("Demo world seeding complete!")
  IO.puts("  - 4 rooms")
  IO.puts("  - 6 exits")
  IO.puts("  - 3 NPCs")
  IO.puts("  - 3 items")
  IO.puts("  - 1 quest")
end
