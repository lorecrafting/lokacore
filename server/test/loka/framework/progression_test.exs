defmodule Loka.Framework.ProgressionTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Progression
  alias Loka.Engine.Entity

  defp entity_with_stats(stats) do
    %Entity{
      id: Ecto.UUID.generate(),
      key: "test_char_#{:rand.uniform(10_000)}",
      type: :character,
      components: %{"stats" => stats}
    }
  end

  describe "level_for_xp/1" do
    test "level 1 requires 0 XP" do
      assert Progression.level_for_xp(0) == 1
    end

    test "level 1 for XP just below level 2 threshold" do
      assert Progression.level_for_xp(99) == 1
    end

    test "level 2 at 100 XP" do
      assert Progression.level_for_xp(100) == 2
    end

    test "is monotonically increasing" do
      levels = Enum.map(0..1000//50, &Progression.level_for_xp/1)
      assert levels == Enum.sort(levels)
    end

    test "respects max level cap" do
      # Absurdly high XP should not exceed max_level
      level = Progression.level_for_xp(100_000_000)
      assert level <= 50
    end
  end

  describe "apply_xp/2" do
    test "adds XP to stats component" do
      entity = entity_with_stats(%{"xp" => 0, "level" => 1})
      {:ok, updated, _events} = Progression.apply_xp(entity, 50)
      stats = Entity.get_component(updated, "stats")
      assert stats["xp"] == 50
    end

    test "zero XP returns entity unchanged with no events" do
      entity = entity_with_stats(%{"xp" => 50, "level" => 1})
      {:ok, same, events} = Progression.apply_xp(entity, 0)
      assert same == entity
      assert events == []
    end

    test "emits level_up event when threshold crossed" do
      entity = entity_with_stats(%{"xp" => 90, "level" => 1})
      # 10 more XP crosses the 100 XP threshold for level 2
      {:ok, updated, events} = Progression.apply_xp(entity, 10)
      assert [{:level_up, 1, 2}] = events
      stats = Entity.get_component(updated, "stats")
      assert stats["level"] == 2
    end

    test "no event when XP gained but level unchanged" do
      entity = entity_with_stats(%{"xp" => 0, "level" => 1})
      {:ok, _updated, events} = Progression.apply_xp(entity, 50)
      assert events == []
    end

    test "handles multiple level-ups in one XP gain" do
      entity = entity_with_stats(%{"xp" => 0, "level" => 1})
      # 1000 XP should get past level 2 (100 XP) and level 3 (287 XP)
      {:ok, updated, events} = Progression.apply_xp(entity, 1000)
      [{:level_up, 1, new_level}] = events
      assert new_level > 2
      stats = Entity.get_component(updated, "stats")
      assert stats["level"] == new_level
    end

    test "initializes missing stats fields gracefully" do
      entity = entity_with_stats(%{})
      {:ok, updated, _events} = Progression.apply_xp(entity, 50)
      stats = Entity.get_component(updated, "stats")
      assert stats["xp"] == 50
      assert stats["level"] == 1
    end
  end
end
