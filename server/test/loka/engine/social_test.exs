defmodule Loka.Engine.SocialTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Social

  describe "from_map/2" do
    test "creates a social from valid map" do
      data = %{
        "aliases" => ["grin"],
        "min_position" => "resting",
        "hidden" => false,
        "requires_target" => false,
        "messages" => %{
          "no_target" => %{
            "to_actor" => "You smile.",
            "to_room" => "{actor} smiles."
          },
          "with_target" => %{
            "to_actor" => "You smile at {target}.",
            "to_target" => "{actor} smiles at you.",
            "to_room" => "{actor} smiles at {target}."
          }
        }
      }

      assert {:ok, social} = Social.from_map("smile", data)
      assert social.key == "smile"
      assert social.aliases == ["grin"]
      assert social.min_position == :resting
      assert social.hidden == false
      assert social.requires_target == false
      assert social.messages.no_target.to_actor == "You smile."
      assert social.messages.with_target.to_target == "{actor} smiles at you."
    end

    test "uses default position when not specified" do
      data = %{
        "messages" => %{
          "no_target" => %{"to_actor" => "You test."}
        }
      }

      assert {:ok, social} = Social.from_map("test", data)
      assert social.min_position == :resting
    end

    test "parses requires_target correctly" do
      data = %{
        "requires_target" => true,
        "messages" => %{
          "with_target" => %{"to_actor" => "You hug {target}."}
        }
      }

      assert {:ok, social} = Social.from_map("hug", data)
      assert social.requires_target == true
    end

    test "returns error when messages missing" do
      assert {:error, _} = Social.from_map("broken", %{})
    end
  end

  describe "all_keys/1" do
    test "returns primary key and aliases" do
      social = %Social{
        key: "smile",
        aliases: ["grin", "beam"]
      }

      keys = Social.all_keys(social)
      assert keys == ["smile", "grin", "beam"]
    end

    test "returns just key when no aliases" do
      social = %Social{key: "wave", aliases: []}
      assert Social.all_keys(social) == ["wave"]
    end
  end
end
