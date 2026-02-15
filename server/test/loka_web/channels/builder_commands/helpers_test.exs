defmodule LokaWeb.Channels.BuilderCommands.HelpersTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.BuilderCommands.Helpers

  describe "matches?/2" do
    test "returns true for matching substring" do
      assert Helpers.matches?("tavern_room", "tavern")
    end

    test "is case-insensitive" do
      assert Helpers.matches?("Tavern Room", "tavern")
    end

    test "returns false for non-matching" do
      refute Helpers.matches?("market_square", "tavern")
    end

    test "returns false for nil text" do
      refute Helpers.matches?(nil, "anything")
    end

    test "converts non-string to string" do
      assert Helpers.matches?(:tavern_room, "tavern")
    end
  end

  describe "format_typed_object/1" do
    test "formats basic typed object" do
      obj = %{
        key: "test_npc",
        type: :entity,
        short_desc: "Test NPC",
        extra_desc: nil,
        components: %{}
      }

      result = Helpers.format_typed_object(obj)

      assert result =~ "key: test_npc"
      assert result =~ "type: entity"
      assert result =~ "name: Test NPC"
    end

    test "includes description when present" do
      obj = %{
        key: "npc",
        type: :entity,
        short_desc: "NPC",
        extra_desc: "A friendly NPC",
        components: %{}
      }

      result = Helpers.format_typed_object(obj)

      assert result =~ "description: A friendly NPC"
    end

    test "truncates long descriptions" do
      long_desc = String.duplicate("a", 200)

      obj = %{
        key: "npc",
        type: :entity,
        short_desc: "NPC",
        extra_desc: long_desc,
        components: %{}
      }

      result = Helpers.format_typed_object(obj)

      # Description line should be truncated with ...
      desc_line = result |> String.split("\n") |> Enum.find(&(&1 =~ "description:"))
      assert desc_line =~ "..."
    end

    test "lists component keys when present" do
      obj = %{
        key: "npc",
        type: :entity,
        short_desc: "NPC",
        extra_desc: nil,
        components: %{"combat" => %{}, "dialogue" => %{}}
      }

      result = Helpers.format_typed_object(obj)

      assert result =~ "components:"
      assert result =~ "- combat"
      assert result =~ "- dialogue"
    end

    test "omits components section when empty" do
      obj = %{key: "npc", type: :entity, short_desc: "NPC", extra_desc: nil, components: %{}}

      result = Helpers.format_typed_object(obj)

      refute result =~ "components:"
    end

    test "uses key as fallback name" do
      obj = %{key: "my_key", type: :entity, short_desc: nil, extra_desc: nil, components: %{}}

      result = Helpers.format_typed_object(obj)

      assert result =~ "name: my_key"
    end
  end
end
