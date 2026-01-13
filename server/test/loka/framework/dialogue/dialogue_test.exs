defmodule Loka.Framework.DialogueTest do
  use Loka.DataCase

  alias Loka.Framework.Dialogue

  import Loka.EngineFixtures

  # Helper to create an NPC with a dialogue tree
  defp npc_with_dialogue_fixture(dialogue_tree) do
    components = %{
      "dialogue_tree" => dialogue_tree
    }

    npc_fixture(%{name: "Test NPC", components: components})
  end

  # Sample dialogue tree for testing
  defp simple_dialogue_tree do
    %{
      "start" => %{
        "text" => "Greetings, traveler!",
        "choices" => [
          %{"text" => "Hello", "next" => "hello_response"},
          %{"text" => "Goodbye", "next" => nil}
        ]
      },
      "hello_response" => %{
        "text" => "How can I help you today?",
        "choices" => [
          %{"text" => "Tell me about quests", "next" => "quest_info"},
          %{"text" => "Nothing, thanks", "next" => nil}
        ]
      },
      "quest_info" => %{
        "text" => "I have a quest for you.",
        "choices" => [
          %{"text" => "Accept quest", "next" => nil, "action" => ["accept_quest", "find_leaf"]},
          %{"text" => "Maybe later", "next" => nil}
        ]
      }
    }
  end

  # Dialogue tree with quest filtering
  defp quest_filtered_dialogue_tree do
    %{
      "start" => %{
        "text" => "Hello again!",
        "choices" => [
          %{
            "text" => "I'm ready for the quest",
            "next" => "offer_quest",
            "action" => ["accept_quest", "find_leaf"]
          },
          %{"text" => "Just passing by", "next" => nil}
        ]
      },
      "offer_quest" => %{
        "text" => "Great! Find me a magic leaf.",
        "choices" => [
          %{"text" => "Okay!", "next" => nil}
        ]
      }
    }
  end

  # Dialogue tree with completed variants
  defp completed_variant_dialogue_tree do
    %{
      "start" => %{
        "text" => "Hello, traveler!",
        "completed_variant" => "start_completed",
        "completed_quest" => "find_leaf",
        "choices" => [
          %{"text" => "Hi", "next" => nil}
        ]
      },
      "start_completed" => %{
        "text" => "Thank you for finding the leaf!",
        "choices" => [
          %{"text" => "You're welcome", "next" => nil}
        ]
      }
    }
  end

  # Dialogue tree with multiple completed variants
  defp multi_completed_variants_dialogue_tree do
    %{
      "start" => %{
        "text" => "Greetings!",
        "completed_variants" => %{
          "quest_a" => "completed_a",
          "quest_b" => "completed_b"
        },
        "choices" => [
          %{"text" => "Hello", "next" => nil}
        ]
      },
      "completed_a" => %{
        "text" => "Thanks for completing Quest A!",
        "choices" => [
          %{"text" => "Sure", "next" => nil}
        ]
      },
      "completed_b" => %{
        "text" => "Thanks for completing Quest B!",
        "choices" => [
          %{"text" => "Sure", "next" => nil}
        ]
      }
    }
  end

  # Dialogue tree with show_if conditions
  defp conditional_dialogue_tree do
    %{
      "start" => %{
        "text" => "Hello!",
        "choices" => [
          %{
            "text" => "About that quest...",
            "next" => nil,
            "show_if" => %{"quest_active" => "find_leaf"}
          },
          %{
            "text" => "I completed your quest!",
            "next" => nil,
            "show_if" => %{"quest_completed" => "find_leaf"}
          },
          %{
            "text" => "Do you have any quests?",
            "next" => nil,
            "show_if" => %{"quest_not_active" => "find_leaf"}
          },
          %{
            "text" => "Goodbye",
            "next" => nil
          }
        ]
      }
    }
  end

  # Dialogue tree with various action types
  defp action_dialogue_tree do
    %{
      "start" => %{
        "text" => "What do you need?",
        "choices" => [
          %{"text" => "Accept quest", "next" => nil, "action" => ["accept_quest", "test_quest"]},
          %{
            "text" => "Get item",
            "next" => nil,
            "action" => ["give_item", "magic_sword", "5"]
          },
          %{"text" => "Set flag", "next" => nil, "action" => ["set_flag", "met_npc"]},
          %{"text" => "Just talk", "next" => nil}
        ]
      }
    }
  end

  describe "start_conversation/2" do
    test "starts conversation with valid NPC" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      assert node.id == "start"
      assert node.text == "Greetings, traveler!"
      assert length(node.choices) == 2
      assert Enum.at(node.choices, 0).text == "Hello"
      assert Enum.at(node.choices, 0).next == "hello_response"
      assert Enum.at(node.choices, 1).text == "Goodbye"
      assert Enum.at(node.choices, 1).next == nil
    end

    test "returns error for non-existent NPC" do
      fake_id = Ecto.UUID.generate()

      assert {:error, :npc_not_found} = Dialogue.start_conversation(fake_id)
    end

    test "returns error for NPC without dialogue tree" do
      npc = npc_fixture()

      assert {:error, :no_dialogue} = Dialogue.start_conversation(npc.id)
    end

    test "returns error when dialogue tree has no start node" do
      tree = %{"other_node" => %{"text" => "Test", "choices" => []}}
      npc = npc_with_dialogue_fixture(tree)

      assert {:error, :no_start_node} = Dialogue.start_conversation(npc.id)
    end

    test "filters quest choices based on completed quests" do
      npc = npc_with_dialogue_fixture(quest_filtered_dialogue_tree())
      player_quests = %{"completed" => ["find_leaf"]}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      # The accept_quest choice should be filtered out
      assert length(node.choices) == 1
      assert Enum.at(node.choices, 0).text == "Just passing by"
    end

    test "filters quest choices based on active quests" do
      npc = npc_with_dialogue_fixture(quest_filtered_dialogue_tree())
      player_quests = %{"active" => %{"find_leaf" => %{}}}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      # The accept_quest choice should be filtered out
      assert length(node.choices) == 1
      assert Enum.at(node.choices, 0).text == "Just passing by"
    end

    test "uses completed variant when quest is completed" do
      npc = npc_with_dialogue_fixture(completed_variant_dialogue_tree())
      player_quests = %{"completed" => ["find_leaf"]}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      assert node.text == "Thank you for finding the leaf!"
    end

    test "uses normal variant when quest is not completed" do
      npc = npc_with_dialogue_fixture(completed_variant_dialogue_tree())
      player_quests = %{"completed" => []}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      assert node.text == "Hello, traveler!"
    end

    test "uses correct completed variant from multiple options" do
      npc = npc_with_dialogue_fixture(multi_completed_variants_dialogue_tree())
      player_quests = %{"completed" => ["quest_b"]}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      assert node.text == "Thanks for completing Quest B!"
    end

    test "filters choices based on show_if conditions - quest_active" do
      npc = npc_with_dialogue_fixture(conditional_dialogue_tree())
      player_quests = %{"active" => %{"find_leaf" => %{}}}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      choice_texts = Enum.map(node.choices, & &1.text)
      assert "About that quest..." in choice_texts
      refute "I completed your quest!" in choice_texts
      refute "Do you have any quests?" in choice_texts
      assert "Goodbye" in choice_texts
    end

    test "filters choices based on show_if conditions - quest_completed" do
      npc = npc_with_dialogue_fixture(conditional_dialogue_tree())
      player_quests = %{"completed" => ["find_leaf"]}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      choice_texts = Enum.map(node.choices, & &1.text)
      refute "About that quest..." in choice_texts
      assert "I completed your quest!" in choice_texts
      # quest_not_active is true when quest is not in active map (even if completed)
      assert "Do you have any quests?" in choice_texts
      assert "Goodbye" in choice_texts
    end

    test "filters choices based on show_if conditions - quest_not_active" do
      npc = npc_with_dialogue_fixture(conditional_dialogue_tree())
      player_quests = %{"active" => %{}}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      choice_texts = Enum.map(node.choices, & &1.text)
      refute "About that quest..." in choice_texts
      refute "I completed your quest!" in choice_texts
      assert "Do you have any quests?" in choice_texts
      assert "Goodbye" in choice_texts
    end

    test "supports player_quests with atom keys" do
      npc = npc_with_dialogue_fixture(quest_filtered_dialogue_tree())
      player_quests = %{completed: ["find_leaf"]}

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      # Should still filter correctly with atom keys
      assert length(node.choices) == 1
    end
  end

  describe "choose_option/4" do
    test "chooses first option and returns next node" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, node, %{action: nil}} =
               Dialogue.choose_option(npc.id, 0, "start")

      assert node.id == "hello_response"
      assert node.text == "How can I help you today?"
      assert length(node.choices) == 2
    end

    test "chooses option that ends conversation" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, :end, %{action: nil}} = Dialogue.choose_option(npc.id, 1, "start")
    end

    test "navigates through multiple dialogue nodes" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      # Start conversation
      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "start")
      assert node.id == "hello_response"

      # Choose next option
      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "hello_response")
      assert node.id == "quest_info"
      assert node.text == "I have a quest for you."
    end

    test "returns error for invalid choice index" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:error, :invalid_choice} = Dialogue.choose_option(npc.id, 999, "start")
    end

    test "returns error for invalid node" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:error, :invalid_node} =
               Dialogue.choose_option(npc.id, 0, "nonexistent_node")
    end

    test "returns error for non-existent NPC" do
      fake_id = Ecto.UUID.generate()

      assert {:error, :npc_not_found} = Dialogue.choose_option(fake_id, 0, "start")
    end

    test "returns error for NPC without dialogue" do
      npc = npc_fixture()

      assert {:error, :no_dialogue} = Dialogue.choose_option(npc.id, 0, "start")
    end

    test "returns action when choosing option with action" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      {:ok, _node, %{action: nil}} = Dialogue.choose_option(npc.id, 0, "start")
      {:ok, _node, %{action: nil}} = Dialogue.choose_option(npc.id, 0, "hello_response")

      # Quest info has accept_quest action
      assert {:ok, :end, %{action: action}} =
               Dialogue.choose_option(npc.id, 0, "quest_info")

      assert action == {:accept_quest, "find_leaf"}
    end

    test "parses list action with 2 elements" do
      npc = npc_with_dialogue_fixture(action_dialogue_tree())

      assert {:ok, :end, %{action: action}} = Dialogue.choose_option(npc.id, 0, "start")

      assert action == {:accept_quest, "test_quest"}
    end

    test "parses list action with 3 elements" do
      npc = npc_with_dialogue_fixture(action_dialogue_tree())

      assert {:ok, :end, %{action: action}} = Dialogue.choose_option(npc.id, 1, "start")

      assert action == {:give_item, "magic_sword", "5"}
    end

    test "parses map action format" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{
              "text" => "Accept",
              "next" => nil,
              "action" => %{"type" => "accept_quest", "arg" => "test_quest"}
            }
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, :end, %{action: action}} = Dialogue.choose_option(npc.id, 0, "start")

      assert action == {:accept_quest, "test_quest"}
    end

    test "handles missing next node gracefully" do
      tree = %{
        "start" => %{
          "text" => "Hello",
          "choices" => [
            %{"text" => "Go to missing", "next" => "missing_node"}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      # Should end conversation when next node doesn't exist
      assert {:ok, :end, %{action: nil}} = Dialogue.choose_option(npc.id, 0, "start")
    end

    test "respects quest filtering when choosing options" do
      npc = npc_with_dialogue_fixture(quest_filtered_dialogue_tree())
      player_quests = %{"completed" => ["find_leaf"]}

      # After filtering, only one choice remains (index 0 is "Just passing by")
      assert {:ok, :end, _} =
               Dialogue.choose_option(npc.id, 0, "start", player_quests: player_quests)
    end

    test "uses completed variant for next node when applicable" do
      tree = %{
        "start" => %{
          "text" => "Hello",
          "choices" => [
            %{"text" => "Continue", "next" => "next_node"}
          ]
        },
        "next_node" => %{
          "text" => "Regular text",
          "completed_variant" => "next_completed",
          "completed_quest" => "find_leaf",
          "choices" => []
        },
        "next_completed" => %{
          "text" => "Completed text",
          "choices" => []
        }
      }

      npc = npc_with_dialogue_fixture(tree)
      player_quests = %{"completed" => ["find_leaf"]}

      assert {:ok, node, _} =
               Dialogue.choose_option(npc.id, 0, "start", player_quests: player_quests)

      assert node.text == "Completed text"
    end

    test "choice indices are correct after filtering" do
      npc = npc_with_dialogue_fixture(conditional_dialogue_tree())
      player_quests = %{"active" => %{"find_leaf" => %{}}}

      {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: player_quests)

      # Should have: "About that quest..." (index 0) and "Goodbye" (index 1)
      assert length(node.choices) == 2
      assert Enum.at(node.choices, 0).index == 0
      assert Enum.at(node.choices, 0).text == "About that quest..."
      assert Enum.at(node.choices, 1).index == 1
      assert Enum.at(node.choices, 1).text == "Goodbye"

      # Choosing index 0 should work
      assert {:ok, :end, _} =
               Dialogue.choose_option(npc.id, 0, "start", player_quests: player_quests)
    end
  end

  describe "get_dialogue_node/3" do
    test "gets specific node by ID" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, node} = Dialogue.get_dialogue_node(npc.id, "hello_response")

      assert node.id == "hello_response"
      assert node.text == "How can I help you today?"
      assert length(node.choices) == 2
    end

    test "gets start node" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, node} = Dialogue.get_dialogue_node(npc.id, "start")

      assert node.id == "start"
      assert node.text == "Greetings, traveler!"
    end

    test "returns error for non-existent node" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:error, :node_not_found} =
               Dialogue.get_dialogue_node(npc.id, "nonexistent")
    end

    test "returns error for non-existent NPC" do
      fake_id = Ecto.UUID.generate()

      assert {:error, :npc_not_found} = Dialogue.get_dialogue_node(fake_id, "start")
    end

    test "returns error for NPC without dialogue" do
      npc = npc_fixture()

      assert {:error, :no_dialogue} = Dialogue.get_dialogue_node(npc.id, "start")
    end

    test "filters choices based on player quest state" do
      npc = npc_with_dialogue_fixture(conditional_dialogue_tree())
      player_quests = %{"completed" => ["find_leaf"]}

      assert {:ok, node} =
               Dialogue.get_dialogue_node(npc.id, "start", player_quests: player_quests)

      choice_texts = Enum.map(node.choices, & &1.text)
      assert "I completed your quest!" in choice_texts
      refute "About that quest..." in choice_texts
    end

    test "uses completed variant when applicable" do
      npc = npc_with_dialogue_fixture(completed_variant_dialogue_tree())
      player_quests = %{"completed" => ["find_leaf"]}

      assert {:ok, node} =
               Dialogue.get_dialogue_node(npc.id, "start", player_quests: player_quests)

      assert node.text == "Thank you for finding the leaf!"
    end
  end

  describe "has_dialogue?/1" do
    test "returns true for NPC with dialogue tree" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert Dialogue.has_dialogue?(npc.id) == true
    end

    test "returns false for NPC without dialogue tree" do
      npc = npc_fixture()

      assert Dialogue.has_dialogue?(npc.id) == false
    end

    test "returns false for non-existent NPC" do
      fake_id = Ecto.UUID.generate()

      assert Dialogue.has_dialogue?(fake_id) == false
    end

    test "returns false for NPC with empty components" do
      npc = npc_fixture(%{components: %{}})

      assert Dialogue.has_dialogue?(npc.id) == false
    end

    test "returns false for NPC with nil components" do
      npc = npc_fixture(%{components: nil})

      assert Dialogue.has_dialogue?(npc.id) == false
    end
  end

  describe "node formatting" do
    test "includes speaker information when present" do
      tree = %{
        "start" => %{
          "text" => "Hello!",
          "speaker" => "Merchant",
          "choices" => []
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      assert node.speaker == "Merchant"
    end

    test "speaker is nil when not specified" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      assert node.speaker == nil
    end

    test "formats choice with all fields" do
      npc = npc_with_dialogue_fixture(simple_dialogue_tree())

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      choice = Enum.at(node.choices, 0)
      assert choice.index == 0
      assert choice.text == "Hello"
      assert choice.next == "hello_response"
      assert choice.action == nil
    end

    test "handles empty text gracefully" do
      tree = %{
        "start" => %{
          "text" => nil,
          "choices" => [
            %{"text" => nil, "next" => nil}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      assert node.text == ""
      assert Enum.at(node.choices, 0).text == ""
    end

    test "handles missing choices gracefully" do
      tree = %{
        "start" => %{
          "text" => "End of conversation"
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      assert node.choices == []
    end
  end

  describe "complex conversation flows" do
    test "handles branching conversation paths" do
      tree = %{
        "start" => %{
          "text" => "Choose your path",
          "choices" => [
            %{"text" => "Path A", "next" => "path_a"},
            %{"text" => "Path B", "next" => "path_b"}
          ]
        },
        "path_a" => %{
          "text" => "You chose path A",
          "choices" => []
        },
        "path_b" => %{
          "text" => "You chose path B",
          "choices" => []
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      # Take path A
      {:ok, node_a, _} = Dialogue.choose_option(npc.id, 0, "start")
      assert node_a.text == "You chose path A"

      # Take path B
      {:ok, node_b, _} = Dialogue.choose_option(npc.id, 1, "start")
      assert node_b.text == "You chose path B"
    end

    test "handles circular conversation paths" do
      tree = %{
        "start" => %{
          "text" => "Menu",
          "choices" => [
            %{"text" => "Option 1", "next" => "option_1"},
            %{"text" => "Exit", "next" => nil}
          ]
        },
        "option_1" => %{
          "text" => "You selected option 1",
          "choices" => [
            %{"text" => "Back to menu", "next" => "start"}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      # Go to option 1
      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "start")
      assert node.id == "option_1"

      # Go back to menu
      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "option_1")
      assert node.id == "start"
      assert node.text == "Menu"
    end

    test "handles deep conversation trees" do
      tree = %{
        "start" => %{
          "text" => "Level 1",
          "choices" => [%{"text" => "Next", "next" => "level_2"}]
        },
        "level_2" => %{
          "text" => "Level 2",
          "choices" => [%{"text" => "Next", "next" => "level_3"}]
        },
        "level_3" => %{
          "text" => "Level 3",
          "choices" => [%{"text" => "Next", "next" => "level_4"}]
        },
        "level_4" => %{
          "text" => "Level 4",
          "choices" => [%{"text" => "Done", "next" => nil}]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "start")
      assert node.id == "level_2"

      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "level_2")
      assert node.id == "level_3"

      {:ok, node, _} = Dialogue.choose_option(npc.id, 0, "level_3")
      assert node.id == "level_4"

      {:ok, :end, _} = Dialogue.choose_option(npc.id, 0, "level_4")
    end
  end

  describe "edge cases" do
    test "handles dialogue with no choices" do
      tree = %{
        "start" => %{
          "text" => "This is the end.",
          "choices" => []
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      assert node.choices == []
    end

    test "handles empty player_quests" do
      npc = npc_with_dialogue_fixture(quest_filtered_dialogue_tree())

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: %{})

      # Should show all choices when no quests are completed/active
      assert length(node.choices) == 2
    end

    test "handles malformed action gracefully" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{"text" => "Bad action", "next" => nil, "action" => "invalid"}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, :end, %{action: nil}} = Dialogue.choose_option(npc.id, 0, "start")
    end

    test "handles action with single element list" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{"text" => "Action", "next" => nil, "action" => ["heal"]}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, :end, %{action: action}} = Dialogue.choose_option(npc.id, 0, "start")

      assert action == {:heal, nil}
    end

    test "handles action as empty list" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{"text" => "Action", "next" => nil, "action" => []}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, :end, %{action: nil}} = Dialogue.choose_option(npc.id, 0, "start")
    end

    test "handles map action with missing fields" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{"text" => "Action", "next" => nil, "action" => %{"invalid" => "data"}}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, :end, %{action: nil}} = Dialogue.choose_option(npc.id, 0, "start")
    end

    test "handles show_if with unknown condition type" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{
              "text" => "Unknown condition",
              "next" => nil,
              "show_if" => %{"unknown_condition" => "value"}
            },
            %{"text" => "Always visible", "next" => nil}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, node} = Dialogue.start_conversation(npc.id, player_quests: %{})

      # Unknown condition should default to true (show the choice)
      assert length(node.choices) == 2
    end

    test "handles show_if as non-map value" do
      tree = %{
        "start" => %{
          "text" => "Test",
          "choices" => [
            %{"text" => "Invalid show_if", "next" => nil, "show_if" => "not_a_map"},
            %{"text" => "Valid choice", "next" => nil}
          ]
        }
      }

      npc = npc_with_dialogue_fixture(tree)

      assert {:ok, node} = Dialogue.start_conversation(npc.id)

      # Should show both choices (invalid show_if defaults to true)
      assert length(node.choices) == 2
    end

    test "handles completed_variant pointing to non-existent node" do
      tree = %{
        "start" => %{
          "text" => "Original",
          "completed_variant" => "missing_variant",
          "completed_quest" => "test_quest",
          "choices" => []
        }
      }

      npc = npc_with_dialogue_fixture(tree)
      player_quests = %{"completed" => ["test_quest"]}

      # Should fall back to original node
      assert {:ok, node} =
               Dialogue.start_conversation(npc.id, player_quests: player_quests)

      assert node.text == "Original"
    end

    test "handles completed_variants with non-existent variant node" do
      tree = %{
        "start" => %{
          "text" => "Original",
          "completed_variants" => %{
            "quest_a" => "missing_variant"
          },
          "choices" => []
        }
      }

      npc = npc_with_dialogue_fixture(tree)
      player_quests = %{"completed" => ["quest_a"]}

      # Should fall back to original node
      assert {:ok, node} =
               Dialogue.start_conversation(npc.id, player_quests: player_quests)

      assert node.text == "Original"
    end
  end
end
