# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     Loka.Repo.insert!(%Loka.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias Loka.Engine.Entities

IO.puts("Checking database seeds...")

# =============================================================================
# ADMIN USER (DEV/TEST ONLY)
# =============================================================================
if Mix.env() in [:dev, :test] do
  alias Loka.Accounts
  alias Loka.Repo

  admin_email = "admin@loka.local"

  case Accounts.get_player_by_email(admin_email) do
    nil ->
      IO.puts("Creating default admin user...")
      IO.puts("  Email: #{admin_email}")
      IO.puts("  Password: adminadmin12")

      # Create admin player
      {:ok, admin_player} =
        %Loka.Accounts.Player{}
        |> Loka.Accounts.Player.email_changeset(%{email: admin_email})
        |> Loka.Accounts.Player.password_changeset(%{password: "adminadmin12"},
          hash_password: true
        )
        |> Ecto.Changeset.put_change(
          :confirmed_at,
          DateTime.utc_now() |> DateTime.truncate(:second)
        )
        |> Loka.Accounts.Player.admin_changeset(%{is_admin: true})
        |> Repo.insert()

      IO.puts("✓ Admin user created successfully (#{admin_player.email})")

    %{is_admin: true} = existing_admin ->
      IO.puts("✓ Admin user already exists (#{existing_admin.email})")

    existing_player ->
      IO.puts("✓ User exists but is not admin, promoting to admin...")
      {:ok, _} = Accounts.set_admin(existing_player, true)
      IO.puts("✓ Promoted #{existing_player.email} to admin")
  end
else
  IO.puts("Skipping admin user creation (production environment)")
end

# =============================================================================
# DEMO WORLD (DISABLED)
# =============================================================================
# The demo world (room_oak_tree, etc.) is no longer created here.
# The game world from priv/world/prototypes/ is spawned via
# WorldLoader.spawn_world() on application startup instead.
#
# This avoids conflicts between the demo world and the real game world.
# =============================================================================

# Skip demo world creation - game world is spawned on app start
existing_world = Entities.get_entity_by_key("awakening_clearing")

if existing_world do
  IO.puts("Game world already exists. Skipping demo content...")
else
  IO.puts("Note: Game world will be spawned on application startup via WorldLoader.spawn_world()")

  IO.puts("Skipping legacy demo world creation...")
end

# Legacy demo world code (disabled)
if false do
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
            "text" =>
              "Greetings, traveler. The forest spirits whisper of your arrival. What brings you to this sacred grove?",
            "choices" => [
              %{"text" => "I seek adventure and purpose.", "next" => "quest_offer"},
              %{"text" => "Tell me about this place.", "next" => "about_grove"},
              %{"text" => "I was just passing through.", "next" => "farewell"}
            ]
          },
          "quest_offer" => %{
            "text" =>
              "Ah, a seeker of purpose. The oak tree above us is ancient and wise, but it grows weak. I require a special leaf—one touched by golden light—for a ceremony of renewal. Would you find it for me?",
            "choices" => [
              %{
                "text" => "I will find this leaf for you.",
                "next" => "quest_accepted",
                "action" => ["accept_quest", "quest_find_leaf"]
              },
              %{"text" => "Perhaps another time.", "next" => "farewell"}
            ]
          },
          "quest_accepted" => %{
            "text" =>
              "Blessings upon you, traveler. The leaf you seek glimmers with golden veins. It should be here beneath the oak, resting upon the ground. Return it to me when you find it.",
            "choices" => [
              %{"text" => "I will return soon.", "next" => nil}
            ]
          },
          "about_grove" => %{
            "text" =>
              "This grove has stood for a thousand years, a sanctuary where the veil between worlds grows thin. Many travelers pass through seeking wisdom or respite. The oak tree watches over all who enter with peaceful hearts.",
            "choices" => [
              %{"text" => "It's beautiful here.", "next" => "start"},
              %{"text" => "Thank you for sharing.", "next" => "farewell"}
            ]
          },
          "farewell" => %{
            "text" =>
              "May the forest spirits guide your path, traveler. Return whenever the road grows weary.",
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

  # =============================================================================
  # COMBATANT NPCs
  # =============================================================================

  IO.puts("Creating combatant NPCs...")

  {:ok, _wolf} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_wolf",
      name: "wolf",
      description:
        "A gray wolf with matted fur and hungry yellow eyes. Scars crisscross its muzzle, " <>
          "evidence of countless battles for survival. It watches you warily, muscles tensed " <>
          "and ready to spring.",
      location_id: deep_forest.id,
      components: %{
        "short_desc" => "A gray",
        "suffix" => "prowls through the undergrowth",
        "combatant" => %{
          "level" => 1,
          "health" => %{"current" => 30, "max" => 30},
          "stats" => %{"attack" => 5, "defense" => 2},
          "xp_reward" => 25,
          "gold_reward" => 5
        }
      }
    })

  {:ok, _bandit} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_bandit",
      name: "bandit",
      description:
        "A rough-looking bandit in tattered leather armor. A cruel sneer twists their face " <>
          "as they eye your belongings. A rusty dagger gleams in one hand.",
      location_id: village_path.id,
      components: %{
        "short_desc" => "A rough-looking",
        "suffix" => "lurks near the road",
        "combatant" => %{
          "level" => 2,
          "health" => %{"current" => 50, "max" => 50},
          "stats" => %{"attack" => 8, "defense" => 3},
          "xp_reward" => 40,
          "gold_reward" => 15
        },
        "conversant" => %{
          "dialogue_tree_id" => "bandit_greeting"
        },
        "dialogue_tree" => %{
          "start" => %{
            "text" => "Hand over your gold and nobody gets hurt!",
            "choices" => [
              %{"text" => "I don't have any gold.", "next" => "threaten"},
              %{"text" => "You'll have to take it from me.", "next" => "fight"}
            ]
          },
          "threaten" => %{
            "text" => "Then you'll pay with your hide! Prepare yourself!",
            "choices" => []
          },
          "fight" => %{
            "text" => "So be it! Draw your weapon!",
            "choices" => []
          }
        }
      }
    })

  IO.puts("Created 2 combatant NPCs.")

  # =============================================================================
  # SKILL TRAINER NPCs
  # =============================================================================

  IO.puts("Creating skill trainer NPCs...")

  {:ok, _combat_trainer} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_combat_trainer",
      name: "combat instructor",
      description:
        "A grizzled warrior with countless scars marking their arms and face. Despite their age, " <>
          "they move with the fluid grace of a seasoned fighter. A well-worn training sword hangs at their belt.",
      location_id: village_path.id,
      components: %{
        "short_desc" => "A grizzled",
        "suffix" => "practices sword forms nearby",
        "conversant" => %{
          "dialogue_tree_id" => "combat_trainer_greeting"
        },
        "skill_trainer" => %{
          "category" => "combat"
        },
        "dialogue_tree" => %{
          "start" => %{
            "text" =>
              "Greetings, warrior. I've trained many fighters in my time. If you have skill points to spend, I can teach you the ways of combat.",
            "choices" => [
              %{
                "text" => "Teach me Power Strike (2 SP)",
                "next" => "learn_power_strike",
                "action" => ["learn_skill", "power_strike", 2]
              },
              %{
                "text" => "Teach me Critical Eye (3 SP)",
                "next" => "learn_critical_eye",
                "action" => ["learn_skill", "critical_eye", 3]
              },
              %{
                "text" => "Teach me Berserker Rage (4 SP)",
                "next" => "learn_berserker_rage",
                "action" => ["learn_skill", "berserker_rage", 4]
              },
              %{"text" => "Perhaps another time.", "next" => "farewell"}
            ]
          },
          "learn_power_strike" => %{
            "text" =>
              "Power Strike. A simple but effective technique. Put your whole body behind the blow, not just your arm.",
            "choices" => [
              %{"text" => "What else can you teach me?", "next" => "start"},
              %{"text" => "Thank you.", "next" => "farewell"}
            ]
          },
          "learn_critical_eye" => %{
            "text" =>
              "Ah, the Critical Eye. Learn to spot your enemy's weaknesses. Strike where they are most vulnerable.",
            "choices" => [
              %{"text" => "What else can you teach me?", "next" => "start"},
              %{"text" => "Thank you.", "next" => "farewell"}
            ]
          },
          "learn_berserker_rage" => %{
            "text" =>
              "Berserker Rage is dangerous. You sacrifice defense for overwhelming offense. Use it wisely.",
            "choices" => [
              %{"text" => "What else can you teach me?", "next" => "start"},
              %{"text" => "Thank you.", "next" => "farewell"}
            ]
          },
          "farewell" => %{
            "text" => "Train hard, warrior. The road ahead is dangerous.",
            "choices" => []
          }
        }
      }
    })

  {:ok, _defense_trainer} =
    Entities.create_entity(%{
      type: :npc,
      key: "npc_defense_trainer",
      name: "shield master",
      description:
        "A heavily built warrior clad in dented but well-maintained armor. They carry a massive tower shield " <>
          "that looks impossibly heavy. Their eyes are calm and patient.",
      location_id: river_bank.id,
      components: %{
        "short_desc" => "A heavily armored",
        "suffix" => "meditates by the water's edge",
        "conversant" => %{
          "dialogue_tree_id" => "defense_trainer_greeting"
        },
        "skill_trainer" => %{
          "category" => "defense"
        },
        "dialogue_tree" => %{
          "start" => %{
            "text" =>
              "The best warriors are those who live to fight another day. I can teach you the art of defense, if you have skill points to spend.",
            "choices" => [
              %{
                "text" => "Teach me Shield Wall (2 SP)",
                "next" => "learn_shield_wall",
                "action" => ["learn_skill", "shield_wall", 2]
              },
              %{
                "text" => "Teach me Parry (3 SP)",
                "next" => "learn_parry",
                "action" => ["learn_skill", "parry", 3]
              },
              %{
                "text" => "Teach me Fortitude (4 SP)",
                "next" => "learn_fortitude",
                "action" => ["learn_skill", "fortitude", 4]
              },
              %{"text" => "Perhaps another time.", "next" => "farewell"}
            ]
          },
          "learn_shield_wall" => %{
            "text" =>
              "Shield Wall. Plant your feet, raise your shield, and become an immovable object.",
            "choices" => [
              %{"text" => "What else can you teach me?", "next" => "start"},
              %{"text" => "Thank you.", "next" => "farewell"}
            ]
          },
          "learn_parry" => %{
            "text" =>
              "To parry is to redirect force. Let your enemy's strength become their weakness.",
            "choices" => [
              %{"text" => "What else can you teach me?", "next" => "start"},
              %{"text" => "Thank you.", "next" => "farewell"}
            ]
          },
          "learn_fortitude" => %{
            "text" =>
              "Fortitude comes from within. Strengthen your body, strengthen your spirit.",
            "choices" => [
              %{"text" => "What else can you teach me?", "next" => "start"},
              %{"text" => "Thank you.", "next" => "farewell"}
            ]
          },
          "farewell" => %{
            "text" => "May your shield never falter.",
            "choices" => []
          }
        }
      }
    })

  IO.puts("Created 2 skill trainer NPCs.")

  # =============================================================================
  # DEMO LUA SCRIPTS
  # =============================================================================

  alias Loka.Engine.Scripts

  IO.puts("Creating demo Lua scripts...")

  # Script 1: NPC Greeting - React when player enters room
  {:ok, _} =
    Scripts.create_script(%{
      name: "npc_greeting_on_enter",
      description:
        "Makes an NPC greet players when they enter the room. Demonstrates on_enter hook and game.message API.",
      hook: "on_enter",
      enabled: true,
      source: ~S"""
      -- NPC Greeting Script
      -- Hook: on_enter
      -- Purpose: Demonstrate reacting to player entering a room

      -- The entity table contains info about the NPC this script is attached to
      local npc_name = entity.name or "stranger"

      -- The context table contains event-specific data
      local player_name = context.player_name or "traveler"

      -- Send a greeting message to the player
      game.message(context.player_id, "The " .. npc_name .. " looks up and nods at you.")

      -- Log for debugging
      game.log("NPC " .. npc_name .. " greeted player " .. player_name)

      -- Return true to allow the event to continue
      return true
      """
    })

  # Script 2: Room Trap - Trigger effect when player enters
  {:ok, _} =
    Scripts.create_script(%{
      name: "room_trap_spike",
      description:
        "A spike trap that damages players. Demonstrates conditional logic and health modification.",
      hook: "on_enter",
      enabled: true,
      source: ~S"""
      -- Spike Trap Script
      -- Hook: on_enter
      -- Purpose: Demonstrate room-based trap that affects player health

      -- Check if trap is armed (using entity component data)
      local trap_armed = true  -- In real use, check entity.components.trap.armed

      if trap_armed then
        -- Calculate damage
        local base_damage = 10
        local player_armor = context.player_armor or 0
        local actual_damage = math.max(1, base_damage - player_armor)

        -- Send damage message
        game.message(context.player_id, "You step on a hidden pressure plate! Spikes shoot up from the ground, dealing " .. actual_damage .. " damage!")

        -- Log the event
        game.log("Trap triggered on player " .. (context.player_name or "unknown") .. " for " .. actual_damage .. " damage")

        -- Return damage value (game engine handles health reduction)
        return { damage = actual_damage, trap_type = "spike" }
      else
        -- Trap already triggered
        game.message(context.player_id, "You notice a disabled spike trap on the floor.")
        return true
      end
      """
    })

  # Script 3: Item Use - Healing Potion
  {:ok, _} =
    Scripts.create_script(%{
      name: "item_healing_potion",
      description:
        "A healing potion that restores health. Demonstrates on_use hook and player stat modification.",
      hook: "on_use",
      enabled: true,
      source: ~S"""
      -- Healing Potion Script
      -- Hook: on_use
      -- Purpose: Demonstrate consumable item that heals the player

      -- Base healing amount from item component
      local heal_amount = 25

      -- Check if player is at full health
      local current_hp = context.player_health or 100
      local max_hp = context.player_max_health or 100

      if current_hp >= max_hp then
        game.message(context.player_id, "You are already at full health!")
        return { consumed = false, reason = "full_health" }
      end

      -- Calculate actual healing (don't overheal)
      local actual_heal = math.min(heal_amount, max_hp - current_hp)

      -- Send success message
      game.message(context.player_id, "You drink the healing potion and recover " .. actual_heal .. " health!")

      -- Log for tracking
      game.log("Player healed for " .. actual_heal .. " HP")

      -- Return healing data for engine to apply
      return {
        consumed = true,
        heal = actual_heal,
        effect = "healing"
      }
      """
    })

  # Script 4: NPC Patrol - Periodic movement
  {:ok, _} =
    Scripts.create_script(%{
      name: "npc_patrol_behavior",
      description:
        "Makes an NPC patrol between waypoints. Demonstrates on_tick hook and movement logic.",
      hook: "on_tick",
      enabled: true,
      source: ~S"""
      -- NPC Patrol Script
      -- Hook: on_tick
      -- Purpose: Demonstrate periodic behavior - NPC moves between patrol points

      -- Patrol configuration (normally from entity.components.patrol)
      local patrol_points = {"room_oak_tree", "room_deep_forest", "room_river_bank"}
      local current_index = context.patrol_index or 1
      local move_chance = 0.3  -- 30% chance to move each tick

      -- Random check - don't move every tick
      if math.random() > move_chance then
        return { moved = false }
      end

      -- Calculate next patrol point
      local next_index = current_index + 1
      if next_index > #patrol_points then
        next_index = 1
      end

      local next_room = patrol_points[next_index]

      -- Log the movement
      game.log(entity.name .. " is patrolling to " .. next_room)

      -- Return movement instruction for engine
      return {
        moved = true,
        destination = next_room,
        patrol_index = next_index,
        message = "The " .. entity.name .. " wanders off."
      }
      """
    })

  # Script 5: Quest Progress Tracker
  {:ok, _} =
    Scripts.create_script(%{
      name: "quest_objective_tracker",
      description:
        "Tracks quest objective completion. Demonstrates custom hook for quest events.",
      hook: "custom",
      enabled: true,
      source: ~S"""
      -- Quest Objective Tracker
      -- Hook: custom (called by quest system)
      -- Purpose: Demonstrate quest progress tracking and rewards

      -- Quest data from context
      local quest_id = context.quest_id or "unknown"
      local objective_id = context.objective_id or "unknown"
      local objective_type = context.objective_type or "unknown"
      local current_progress = context.progress or 0
      local target_count = context.target or 1

      -- Check if objective is complete
      local is_complete = current_progress >= target_count

      if is_complete then
        -- Objective complete message
        game.message(context.player_id, "Quest objective complete: " .. objective_id)
        game.log("Quest " .. quest_id .. " objective " .. objective_id .. " completed!")

        -- Check if all objectives done (simplified)
        local all_complete = context.all_objectives_complete or false

        if all_complete then
          game.message(context.player_id, "Quest '" .. quest_id .. "' is ready to turn in!")
          return { complete = true, quest_complete = true }
        end

        return { complete = true, quest_complete = false }
      else
        -- Progress update message
        local progress_text = current_progress .. "/" .. target_count
        game.message(context.player_id, "Quest progress: " .. objective_id .. " (" .. progress_text .. ")")

        return { complete = false, progress = current_progress }
      end
      """
    })

  # Script 6: Combat - On Attack Hook
  {:ok, _} =
    Scripts.create_script(%{
      name: "combat_on_attack",
      description:
        "Handles combat attack calculations. Demonstrates on_attack hook and damage formulas.",
      hook: "on_attack",
      enabled: true,
      source: ~S"""
      -- Combat Attack Script
      -- Hook: on_attack
      -- Purpose: Demonstrate combat damage calculation

      -- Attacker stats from context
      local attacker_str = context.attacker_strength or 10
      local attacker_weapon = context.weapon_damage or 0

      -- Defender stats (this entity)
      local defender_def = context.defender_defense or 0
      local defender_armor = context.armor_value or 0

      -- Calculate base damage
      local base_damage = attacker_str + attacker_weapon

      -- Apply defense reduction
      local damage_reduction = defender_def + defender_armor
      local final_damage = math.max(1, base_damage - damage_reduction)

      -- Variance (+/- 20%)
      local variance = 0.2
      local min_damage = math.floor(final_damage * (1 - variance))
      local max_damage = math.ceil(final_damage * (1 + variance))
      local actual_damage = math.random(min_damage, max_damage)

      -- Log combat
      game.log(context.attacker_name .. " attacks " .. entity.name .. " for " .. actual_damage .. " damage")

      -- Return damage result
      return {
        damage = actual_damage,
        hit = true,
        critical = false
      }
      """
    })

  # Script 7: Environment - Day/Night cycle effects
  {:ok, _} =
    Scripts.create_script(%{
      name: "environment_day_night",
      description:
        "Modifies room description based on time of day. Demonstrates on_look hook with context data.",
      hook: "on_look",
      enabled: true,
      source: ~S"""
      -- Day/Night Environment Script
      -- Hook: on_look
      -- Purpose: Demonstrate dynamic room descriptions based on game time

      -- Get current game time (0-23 hours)
      local hour = context.game_hour or 12

      -- Determine time of day
      local time_period = "day"
      local description_suffix = ""

      if hour >= 6 and hour < 12 then
        time_period = "morning"
        description_suffix = " The morning sun casts long shadows through the trees."
      elseif hour >= 12 and hour < 18 then
        time_period = "afternoon"
        description_suffix = " Warm afternoon light filters through the leaves above."
      elseif hour >= 18 and hour < 21 then
        time_period = "evening"
        description_suffix = " The sky is painted in shades of orange and purple as the sun sets."
      else
        time_period = "night"
        description_suffix = " Stars twinkle overhead, and the world is bathed in moonlight."
      end

      -- Log for debugging
      game.log("Room viewed during " .. time_period .. " (hour: " .. hour .. ")")

      -- Return description modifier
      return {
        append_description = description_suffix,
        time_period = time_period,
        lighting = time_period == "night" and "dark" or "light"
      }
      """
    })

  # Script 8: Interactive Object - Lever/Switch
  {:ok, _} =
    Scripts.create_script(%{
      name: "interactive_lever",
      description:
        "A lever that can be pulled to trigger effects. Demonstrates on_use with state tracking.",
      hook: "on_use",
      enabled: true,
      source: ~S"""
      -- Interactive Lever Script
      -- Hook: on_use
      -- Purpose: Demonstrate stateful interactive objects

      -- Current lever state (would come from entity.components.lever)
      local is_pulled = context.lever_state or false

      if is_pulled then
        -- Lever is already pulled, reset it
        game.message(context.player_id, "You push the lever back to its original position. You hear a grinding sound as something resets.")
        game.log("Lever reset by player")

        return {
          new_state = false,
          effect = "reset",
          sound = "grinding"
        }
      else
        -- Pull the lever
        game.message(context.player_id, "You pull the lever. There's a loud click, followed by the sound of stone grinding against stone!")
        game.log("Lever pulled by player")

        return {
          new_state = true,
          effect = "activate",
          sound = "click_and_grind",
          -- Trigger linked events
          triggers = {"open_secret_door", "disable_trap"}
        }
      end
      """
    })

  IO.puts("Created 8 demo Lua scripts.")

  IO.puts("")
  IO.puts("Demo world seeding complete!")
  IO.puts("  - 4 rooms")
  IO.puts("  - 6 exits")
  IO.puts("  - 7 NPCs (3 friendly, 2 combatants, 2 skill trainers)")
  IO.puts("  - 3 items")
  IO.puts("  - 1 quest")
  IO.puts("  - 8 demo scripts")
end
