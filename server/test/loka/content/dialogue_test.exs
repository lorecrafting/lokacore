defmodule Loka.Content.DialogueTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Dialogue
  alias Loka.Engine.{Entity, Entities}

  defp create_dialogue(key, data) do
    entity =
      Entity.new(
        type: :dialogue,
        key: key,
        short_desc: key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns dialogue by key" do
      create_dialogue("test_dialogue", %{
        "entity_key" => "test_npc",
        "entry_node" => "greeting",
        "nodes" => %{
          "greeting" => %{"text" => "Hello!"}
        }
      })

      assert {:ok, fetched} = Dialogue.get("test_dialogue")
      assert fetched.key == "test_dialogue"
    end

    test "returns error for non-dialogue" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_dialogue",
          short_desc: "Not a dialogue",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Dialogue.get("not_dialogue")
    end
  end

  describe "for_entity/1" do
    test "returns dialogues for entity" do
      create_dialogue("dialogue1", %{
        "entity_key" => "npc_elder",
        "entry_node" => "greeting",
        "nodes" => %{"greeting" => %{"text" => "Hi"}}
      })

      create_dialogue("dialogue2", %{
        "entity_key" => "npc_elder",
        "entry_node" => "quest",
        "nodes" => %{"quest" => %{"text" => "Quest?"}}
      })

      create_dialogue("dialogue3", %{
        "entity_key" => "npc_guard",
        "entry_node" => "greeting",
        "nodes" => %{"greeting" => %{"text" => "Halt"}}
      })

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

      entity = create_dialogue("node_test", %{"entry_node" => "greeting", "nodes" => nodes})
      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert Dialogue.nodes(dialogue) == nodes
    end

    test "gets specific node" do
      entity =
        create_dialogue("node_test2", %{
          "entry_node" => "greeting",
          "nodes" => %{
            "greeting" => %{"text" => "Hello!", "choices" => []}
          }
        })

      {:ok, dialogue} = Entity.to_typed_object(entity)

      node = Dialogue.get_node(dialogue, "greeting")
      assert node["text"] == "Hello!"
    end

    test "returns nil for missing node" do
      entity =
        create_dialogue("node_test3", %{
          "entry_node" => "greeting",
          "nodes" => %{"greeting" => %{}}
        })

      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert Dialogue.get_node(dialogue, "missing") == nil
    end
  end

  describe "choices/2" do
    test "returns choices for node" do
      choices = [
        %{"text" => "Yes", "next" => "accept"},
        %{"text" => "No", "next" => "decline"}
      ]

      entity =
        create_dialogue("choice_test", %{
          "entry_node" => "greeting",
          "nodes" => %{
            "greeting" => %{"text" => "Question?", "choices" => choices},
            "accept" => %{"text" => "Great!"},
            "decline" => %{"text" => "Okay."}
          }
        })

      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert Dialogue.choices(dialogue, "greeting") == choices
    end
  end

  describe "validate/1" do
    test "passes for valid dialogue" do
      entity =
        create_dialogue("valid_dialogue", %{
          "entry_node" => "greeting",
          "nodes" => %{
            "greeting" => %{
              "text" => "Hello!",
              "choices" => [%{"text" => "Bye", "next" => "farewell"}]
            },
            "farewell" => %{"text" => "Goodbye!"}
          }
        })

      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert :ok = Dialogue.validate(dialogue)
    end

    test "fails for dialogue without nodes" do
      entity = create_dialogue("no_nodes", %{"entry_node" => "greeting"})
      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert {:error, errors} = Dialogue.validate(dialogue)
      assert "dialogue must have at least one node" in errors
    end

    test "fails for missing entry node" do
      entity =
        create_dialogue("bad_entry", %{
          "entry_node" => "missing",
          "nodes" => %{"greeting" => %{"text" => "Hi"}}
        })

      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert {:error, errors} = Dialogue.validate(dialogue)
      assert Enum.any?(errors, &String.contains?(&1, "entry_node"))
    end

    test "fails for broken node links" do
      entity =
        create_dialogue("broken_links", %{
          "entry_node" => "greeting",
          "nodes" => %{
            "greeting" => %{
              "text" => "Hi",
              "choices" => [%{"text" => "Go", "next" => "nonexistent"}]
            }
          }
        })

      {:ok, dialogue} = Entity.to_typed_object(entity)

      assert {:error, errors} = Dialogue.validate(dialogue)
      assert Enum.any?(errors, &String.contains?(&1, "broken node references"))
    end
  end
end
