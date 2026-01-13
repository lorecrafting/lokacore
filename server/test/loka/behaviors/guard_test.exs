defmodule Loka.Behaviors.GuardTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Guard
  alias Loka.Engine.{Entity, Event}

  describe "supported_types/0" do
    test "supports npc type" do
      assert :npc in Guard.supported_types()
    end
  end

  describe "handle_event/3 with :entity_entered" do
    test "attacks entity with matching tags" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        short_desc: "a town guard",
        location_id: "room1",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{
              "attack_tags" => ["criminal", "hostile"]
            }
          }
        }
      }

      criminal = %Entity{
        id: "player1",
        type: :player,
        key: "player",
        tags: ["criminal"]
      }

      event = Event.new(:entity_entered, %{payload: %{entity: criminal}})

      assert {:handled, _state, events} = Guard.handle_event(guard, event, %{})

      # Should emit initiate_combat event
      combat_event = Enum.find(events, &(&1.type == :initiate_combat))
      assert combat_event
      assert combat_event.payload[:attacker_id] == "guard1"
      assert combat_event.payload[:target_id] == "player1"
    end

    test "shouts before attacking when configured" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        short_desc: "a town guard",
        location_id: "room1",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{
              "attack_tags" => ["criminal"],
              "shout_on_attack" => "Stop criminal!"
            }
          }
        }
      }

      criminal = %Entity{id: "player1", type: :player, key: "player", tags: ["criminal"]}
      event = Event.new(:entity_entered, %{payload: %{entity: criminal}})

      assert {:handled, _state, events} = Guard.handle_event(guard, event, %{})

      say_event = Enum.find(events, &(&1.type == :say))
      assert say_event
      assert say_event.payload[:text] == "Stop criminal!"
    end

    test "ignores entity without matching tags" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{"attack_tags" => ["criminal"]}
          }
        }
      }

      friendly = %Entity{id: "player1", type: :player, key: "player", tags: ["friendly"]}
      event = Event.new(:entity_entered, %{payload: %{entity: friendly}})

      assert {:ok, _state} = Guard.handle_event(guard, event, %{})
    end

    test "ignores when no attack_tags configured" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        attributes: %{"behavior_config" => %{"guard" => %{}}}
      }

      criminal = %Entity{id: "player1", type: :player, key: "player", tags: ["criminal"]}
      event = Event.new(:entity_entered, %{payload: %{entity: criminal}})

      assert {:ok, _state} = Guard.handle_event(guard, event, %{})
    end
  end

  describe "handle_event/3 with :before_move" do
    test "blocks movement in restricted direction" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{
              "block_directions" => ["north", "east"],
              "block_message" => "The guard bars your path."
            }
          }
        }
      }

      event = Event.new(:before_move, %{payload: %{direction: "north"}})

      assert {:halt, "The guard bars your path."} = Guard.handle_event(guard, event, %{})
    end

    test "allows movement in non-restricted direction" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{"block_directions" => ["north"]}
          }
        }
      }

      event = Event.new(:before_move, %{payload: %{direction: "south"}})

      assert {:ok, _state} = Guard.handle_event(guard, event, %{})
    end

    test "uses default block message" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{"block_directions" => ["north"]}
          }
        }
      }

      event = Event.new(:before_move, %{payload: %{direction: "north"}})

      assert {:halt, "The guard blocks your way."} = Guard.handle_event(guard, event, %{})
    end
  end

  describe "handle_event/3 with :damage_taken" do
    test "flees when health below wimpy threshold" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        components: %{
          "combatant" => %{"health" => %{"current" => 10, "max" => 100}}
        },
        attributes: %{
          "behavior_config" => %{
            "guard" => %{"wimpy_threshold" => 20}
          }
        }
      }

      event = Event.new(:damage_taken, %{payload: %{damage: 5}})

      assert {:handled, _state, events} = Guard.handle_event(guard, event, %{})

      flee_event = Enum.find(events, &(&1.type == :flee))
      assert flee_event
      assert flee_event.payload[:entity_id] == "guard1"
    end

    test "does not flee when health above wimpy threshold" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        components: %{
          "combatant" => %{"health" => %{"current" => 80, "max" => 100}}
        },
        attributes: %{
          "behavior_config" => %{
            "guard" => %{"wimpy_threshold" => 20}
          }
        }
      }

      event = Event.new(:damage_taken, %{payload: %{damage: 5}})

      assert {:ok, _state} = Guard.handle_event(guard, event, %{})
    end

    test "does not flee when wimpy_threshold is 0" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        components: %{
          "combatant" => %{"health" => %{"current" => 5, "max" => 100}}
        },
        attributes: %{
          "behavior_config" => %{"guard" => %{}}
        }
      }

      event = Event.new(:damage_taken, %{payload: %{damage: 5}})

      assert {:ok, _state} = Guard.handle_event(guard, event, %{})
    end
  end

  describe "handle_event/3 with other events" do
    test "passes through unhandled events" do
      guard = %Entity{id: "guard1", type: :npc, key: "guard", attributes: %{}}
      event = Event.new_unchecked(:unknown_event, %{})

      assert {:ok, _state} = Guard.handle_event(guard, event, %{})
    end
  end
end
