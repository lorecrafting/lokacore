defmodule Loka.Content.DialogueTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Dialogue
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Registry.init()
    Registry.clear()
    :ok
  end

  describe "get/1" do
    test "returns dialogue by key" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "test_dialogue",
          type: :dialogue,
          data: %{
            "entity_key" => "test_npc",
            "entry_node" => "greeting",
            "nodes" => %{
              "greeting" => %{"text" => "Hello!"}
            }
          }
        )

      Registry.put("test_dialogue", dialogue)

      assert {:ok, fetched} = Dialogue.get("test_dialogue")
      assert fetched.key == "test_dialogue"
    end

    test "returns error for non-dialogue" do
      {:ok, entity} = TypedObject.new(key: "not_dialogue", type: :entity)
      Registry.put("not_dialogue", entity)

      assert {:error, :not_found} = Dialogue.get("not_dialogue")
    end
  end

  describe "for_entity/1" do
    test "returns dialogues for entity" do
      {:ok, d1} =
        TypedObject.new(
          key: "dialogue1",
          type: :dialogue,
          data: %{
            "entity_key" => "npc_elder",
            "entry_node" => "greeting",
            "nodes" => %{"greeting" => %{"text" => "Hi"}}
          }
        )

      {:ok, d2} =
        TypedObject.new(
          key: "dialogue2",
          type: :dialogue,
          data: %{
            "entity_key" => "npc_elder",
            "entry_node" => "quest",
            "nodes" => %{"quest" => %{"text" => "Quest?"}}
          }
        )

      {:ok, d3} =
        TypedObject.new(
          key: "dialogue3",
          type: :dialogue,
          data: %{
            "entity_key" => "npc_guard",
            "entry_node" => "greeting",
            "nodes" => %{"greeting" => %{"text" => "Halt"}}
          }
        )

      Registry.put("dialogue1", d1)
      Registry.put("dialogue2", d2)
      Registry.put("dialogue3", d3)

      elder_dialogues = Dialogue.for_entity("npc_elder")
      assert length(elder_dialogues) == 2
      assert Enum.all?(elder_dialogues, &(Dialogue.entity_key(&1) == "npc_elder"))
    end
  end

  describe "nodes/1 and get_node/2" do
    test "returns all nodes" do
      nodes = %{
        "greeting" => %{"text" => "Hello!"},
        "farewell" => %{"text" => "Goodbye!"}
      }

      {:ok, dialogue} =
        TypedObject.new(
          key: "node_test",
          type: :dialogue,
          data: %{"entry_node" => "greeting", "nodes" => nodes}
        )

      assert Dialogue.nodes(dialogue) == nodes
    end

    test "gets specific node" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "node_test2",
          type: :dialogue,
          data: %{
            "entry_node" => "greeting",
            "nodes" => %{
              "greeting" => %{"text" => "Hello!", "choices" => []}
            }
          }
        )

      node = Dialogue.get_node(dialogue, "greeting")
      assert node["text"] == "Hello!"
    end

    test "returns nil for missing node" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "node_test3",
          type: :dialogue,
          data: %{"entry_node" => "greeting", "nodes" => %{"greeting" => %{}}}
        )

      assert Dialogue.get_node(dialogue, "missing") == nil
    end
  end

  describe "choices/2" do
    test "returns choices for node" do
      choices = [
        %{"text" => "Yes", "next" => "accept"},
        %{"text" => "No", "next" => "decline"}
      ]

      {:ok, dialogue} =
        TypedObject.new(
          key: "choice_test",
          type: :dialogue,
          data: %{
            "entry_node" => "greeting",
            "nodes" => %{
              "greeting" => %{"text" => "Question?", "choices" => choices},
              "accept" => %{"text" => "Great!"},
              "decline" => %{"text" => "Okay."}
            }
          }
        )

      assert Dialogue.choices(dialogue, "greeting") == choices
    end
  end

  describe "validate/1" do
    test "passes for valid dialogue" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "valid_dialogue",
          type: :dialogue,
          data: %{
            "entry_node" => "greeting",
            "nodes" => %{
              "greeting" => %{
                "text" => "Hello!",
                "choices" => [%{"text" => "Bye", "next" => "farewell"}]
              },
              "farewell" => %{"text" => "Goodbye!"}
            }
          }
        )

      assert :ok = Dialogue.validate(dialogue)
    end

    test "fails for dialogue without nodes" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "no_nodes",
          type: :dialogue,
          data: %{"entry_node" => "greeting"}
        )

      assert {:error, errors} = Dialogue.validate(dialogue)
      assert "dialogue must have at least one node" in errors
    end

    test "fails for missing entry node" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "bad_entry",
          type: :dialogue,
          data: %{
            "entry_node" => "missing",
            "nodes" => %{"greeting" => %{"text" => "Hi"}}
          }
        )

      assert {:error, errors} = Dialogue.validate(dialogue)
      assert Enum.any?(errors, &String.contains?(&1, "entry_node"))
    end

    test "fails for broken node links" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "broken_links",
          type: :dialogue,
          data: %{
            "entry_node" => "greeting",
            "nodes" => %{
              "greeting" => %{
                "text" => "Hi",
                "choices" => [%{"text" => "Go", "next" => "nonexistent"}]
              }
            }
          }
        )

      assert {:error, errors} = Dialogue.validate(dialogue)
      assert Enum.any?(errors, &String.contains?(&1, "broken node references"))
    end
  end
end
