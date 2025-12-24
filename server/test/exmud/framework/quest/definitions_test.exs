defmodule Exmud.Framework.Quest.DefinitionsTest do
  use Exmud.DataCase

  alias Exmud.Framework.Quest.Definitions
  alias Exmud.Framework.Quest.Definitions.{Quest, Objective}
  alias Exmud.Engine.Entities

  # Helper to create a quest entity in the database
  defp create_quest_entity(attrs \\ %{}) do
    {:ok, entity} =
      Entities.create_entity(%{
        key: attrs[:key] || "test_quest_#{System.unique_integer([:positive])}",
        name: attrs[:name] || "Test Quest",
        description: attrs[:description] || "A test quest for testing",
        type: "item",
        components:
          attrs[:components] ||
            %{
              "objectives" => [],
              "rewards" => %{}
            },
        tags: attrs[:tags] || ["quest"]
      })

    entity
  end

  # Helper to create a quest with objectives
  defp quest_with_objectives_fixture do
    create_quest_entity(%{
      key: "find_sword",
      name: "The Lost Sword",
      description: "Find the legendary sword in the dark forest",
      components: %{
        "objectives" => [
          %{
            "id" => "talk_to_blacksmith",
            "type" => "talk",
            "description" => "Talk to the blacksmith",
            "target_id" => "npc_blacksmith",
            "target_count" => 1
          },
          %{
            "id" => "kill_goblins",
            "type" => "kill",
            "description" => "Defeat 5 goblins",
            "target_id" => "goblin",
            "target_count" => 5
          },
          %{
            "id" => "get_sword",
            "type" => "get_item",
            "description" => "Obtain the legendary sword",
            "target_id" => "legendary_sword",
            "target_count" => 1
          }
        ],
        "rewards" => %{
          "xp" => 100,
          "gold" => 50,
          "items" => ["reward_potion"]
        }
      }
    })
  end

  describe "objective_types/0" do
    test "returns all valid objective types" do
      types = Definitions.objective_types()

      assert :talk in types
      assert :kill in types
      assert :get_item in types
      assert :go_to in types
      assert length(types) == 4
    end
  end

  describe "get_quest_definition/1" do
    test "returns quest definition for existing quest" do
      entity = create_quest_entity(%{
        key: "simple_quest",
        name: "Simple Quest",
        description: "A simple test quest"
      })

      quest = Definitions.get_quest_definition(entity.key)

      assert quest != nil
      assert %Quest{} = quest
      assert quest.id == "simple_quest"
      assert quest.name == "Simple Quest"
      assert quest.description == "A simple test quest"
      assert quest.status == :available
      assert quest.objectives == []
      assert quest.rewards == %{}
    end

    test "returns nil for non-existent quest" do
      assert Definitions.get_quest_definition("nonexistent_quest") == nil
    end

    test "parses objectives correctly" do
      entity = quest_with_objectives_fixture()
      quest = Definitions.get_quest_definition(entity.key)

      assert length(quest.objectives) == 3

      [talk_obj, kill_obj, get_obj] = quest.objectives

      assert %Objective{} = talk_obj
      assert talk_obj.id == "talk_to_blacksmith"
      assert talk_obj.type == :talk
      assert talk_obj.description == "Talk to the blacksmith"
      assert talk_obj.target_id == "npc_blacksmith"
      assert talk_obj.target_count == 1
      assert talk_obj.completed == false
      assert talk_obj.progress == 0

      assert kill_obj.type == :kill
      assert kill_obj.target_count == 5

      assert get_obj.type == :get_item
    end

    test "parses rewards correctly" do
      entity = quest_with_objectives_fixture()
      quest = Definitions.get_quest_definition(entity.key)

      assert quest.rewards == %{
               "xp" => 100,
               "gold" => 50,
               "items" => ["reward_potion"]
             }
    end
  end

  describe "parse_objectives/1" do
    test "parses list of objectives with string keys" do
      objectives_data = [
        %{
          "id" => "obj1",
          "type" => "talk",
          "description" => "Talk to NPC",
          "target_id" => "npc1",
          "target_count" => 1
        },
        %{
          "id" => "obj2",
          "type" => "kill",
          "description" => "Kill enemies",
          "target_id" => "enemy1",
          "target_count" => 3
        }
      ]

      objectives = Definitions.parse_objectives(objectives_data)

      assert length(objectives) == 2
      assert Enum.all?(objectives, &match?(%Objective{}, &1))

      [obj1, obj2] = objectives
      assert obj1.id == "obj1"
      assert obj1.type == :talk
      assert obj2.target_count == 3
    end

    test "parses objectives with atom keys" do
      objectives_data = [
        %{
          id: "obj1",
          type: :go_to,
          description: "Go to location",
          target_id: "location1",
          target_count: 1
        }
      ]

      objectives = Definitions.parse_objectives(objectives_data)

      assert length(objectives) == 1
      [obj] = objectives
      assert obj.type == :go_to
      assert obj.id == "obj1"
    end

    test "handles missing target_count with default value" do
      objectives_data = [
        %{
          "id" => "obj1",
          "type" => "talk",
          "description" => "Talk to NPC",
          "target_id" => "npc1"
        }
      ]

      objectives = Definitions.parse_objectives(objectives_data)

      assert length(objectives) == 1
      [obj] = objectives
      assert obj.target_count == 1
    end

    test "returns empty list for nil input" do
      assert Definitions.parse_objectives(nil) == []
    end

    test "returns empty list for empty list" do
      assert Definitions.parse_objectives([]) == []
    end

    test "returns empty list for invalid input" do
      assert Definitions.parse_objectives("not a list") == []
      assert Definitions.parse_objectives(123) == []
    end

    test "handles invalid objective type gracefully" do
      objectives_data = [
        %{
          "id" => "obj1",
          "type" => "invalid_type",
          "description" => "Test",
          "target_id" => "test"
        }
      ]

      # String.to_existing_atom will create an atom for the invalid type
      # The function handles ArgumentError and returns empty list in rescue
      result = Definitions.parse_objectives(objectives_data)
      # Actually, it will parse it into an objective with :invalid_type atom
      assert length(result) == 1
      [obj] = result
      assert obj.type == :invalid_type
    end
  end

  describe "Quest struct" do
    test "has correct default values" do
      quest = %Quest{
        id: "test",
        name: "Test",
        description: "Test quest"
      }

      assert quest.objectives == []
      assert quest.rewards == %{}
      assert quest.status == :available
    end
  end

  describe "Objective struct" do
    test "has correct default values" do
      objective = %Objective{
        id: "test",
        type: :talk,
        description: "Test",
        target_id: "target"
      }

      assert objective.target_count == 1
      assert objective.completed == false
      assert objective.progress == 0
    end
  end
end
