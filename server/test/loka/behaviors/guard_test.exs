defmodule Loka.Behaviors.GuardTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Guard
  alias Loka.Engine.Entity

  defp make_guard(config_overrides \\ %{}) do
    config = Map.merge(%{"attack_tags" => ["criminal"]}, config_overrides)

    %Entity{
      id: "guard1",
      type: :npc,
      key: "town_guard",
      short_desc: "a town guard",
      location_id: "room1",
      components: %{
        "behavior_config" => %{"guard" => config}
      }
    }
  end

  describe "on_event/3 with :entity_entered" do
    test "attacks entity with matching tags" do
      guard = make_guard()
      criminal = %Entity{id: "p1", type: :character, key: "player", tags: ["criminal"]}

      assert {:halt, returned} = Guard.on_event(guard, :entity_entered, %{entity: criminal})
      assert returned.id == "guard1"
    end

    test "ignores entity without matching tags" do
      guard = make_guard()
      friendly = %Entity{id: "p1", type: :character, key: "player", tags: ["friendly"]}

      assert {:ok, _} = Guard.on_event(guard, :entity_entered, %{entity: friendly})
    end

    test "ignores when no attack_tags configured" do
      guard = make_guard(%{"attack_tags" => []})
      criminal = %Entity{id: "p1", type: :character, key: "player", tags: ["criminal"]}

      assert {:ok, _} = Guard.on_event(guard, :entity_entered, %{entity: criminal})
    end

    test "ignores nil entered entity" do
      guard = make_guard()

      assert {:ok, _} = Guard.on_event(guard, :entity_entered, %{entity: nil})
    end
  end

  describe "on_event/3 with :before_move" do
    test "blocks movement in restricted direction" do
      guard = make_guard(%{"block_directions" => ["north"], "block_message" => "No passage."})

      assert {:halt, _, %{blocked: true, message: "No passage."}} =
               Guard.on_event(guard, :before_move, %{direction: "north"})
    end

    test "allows movement in non-restricted direction" do
      guard = make_guard(%{"block_directions" => ["north"]})

      assert {:ok, _} = Guard.on_event(guard, :before_move, %{direction: "south"})
    end

    test "uses default block message" do
      guard = make_guard(%{"block_directions" => ["north"]})

      assert {:halt, _, %{message: "The guard blocks your way."}} =
               Guard.on_event(guard, :before_move, %{direction: "north"})
    end
  end

  describe "on_event/3 with :damage_taken" do
    test "flees when health below wimpy threshold" do
      guard =
        make_guard(%{"wimpy_threshold" => 20})
        |> Map.put(
          :components,
          Map.merge(make_guard(%{"wimpy_threshold" => 20}).components, %{
            "combatant" => %{"health" => %{"current" => 10, "max" => 100}}
          })
        )

      assert {:halt, _} = Guard.on_event(guard, :damage_taken, %{})
    end

    test "does not flee when health above wimpy threshold" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        components: %{
          "combatant" => %{"health" => %{"current" => 80, "max" => 100}},
          "behavior_config" => %{"guard" => %{"wimpy_threshold" => 20}}
        }
      }

      assert {:ok, _} = Guard.on_event(guard, :damage_taken, %{})
    end

    test "does not flee when wimpy_threshold is 0" do
      guard = %Entity{
        id: "guard1",
        type: :npc,
        key: "town_guard",
        components: %{
          "combatant" => %{"health" => %{"current" => 5, "max" => 100}},
          "behavior_config" => %{"guard" => %{}}
        }
      }

      assert {:ok, _} = Guard.on_event(guard, :damage_taken, %{})
    end
  end

  describe "on_event/3 with other events" do
    test "passes through unhandled events" do
      guard = make_guard()

      assert {:ok, _} = Guard.on_event(guard, :unknown_event, %{})
    end
  end
end
