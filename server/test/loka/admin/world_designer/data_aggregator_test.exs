defmodule Loka.Admin.WorldDesigner.DataAggregatorTest do
  use Loka.DataCase

  alias Loka.Admin.WorldDesigner.DataAggregator

  describe "aggregate_all/0" do
    test "returns aggregated data structure" do
      result = DataAggregator.aggregate_all()

      assert is_list(result.rooms)
      assert is_list(result.quests)
      assert is_list(result.storylines)
      assert is_map(result.stats)

      # Stats should have expected keys
      assert Map.has_key?(result.stats, :room_count)
      assert Map.has_key?(result.stats, :quest_count)
      assert Map.has_key?(result.stats, :storyline_count)
      assert Map.has_key?(result.stats, :npc_count)
      assert Map.has_key?(result.stats, :warning_count)
    end
  end

  describe "aggregate_rooms/0" do
    test "returns list of room data" do
      rooms = DataAggregator.aggregate_rooms()

      assert is_list(rooms)

      # Each room should have required fields
      for room <- rooms do
        assert Map.has_key?(room, :key)
        assert Map.has_key?(room, :name)
        assert Map.has_key?(room, :coordinates)
        assert Map.has_key?(room, :exits)
        assert Map.has_key?(room, :npcs)
        assert Map.has_key?(room, :items)
        assert Map.has_key?(room, :quest_markers)
        assert Map.has_key?(room, :validation_warnings)
      end
    end
  end

  describe "aggregate_quests/0" do
    test "returns list of quest data" do
      quests = DataAggregator.aggregate_quests()

      assert is_list(quests)

      # Each quest should have required fields
      for quest <- quests do
        assert Map.has_key?(quest, :id)
        assert Map.has_key?(quest, :name)
        assert Map.has_key?(quest, :type)
        assert Map.has_key?(quest, :objectives)
        assert Map.has_key?(quest, :rewards)
        assert Map.has_key?(quest, :prerequisites)
        assert Map.has_key?(quest, :unlocks)
        assert Map.has_key?(quest, :validation_warnings)
      end
    end
  end

  describe "aggregate_storylines/0" do
    test "returns list of storyline data" do
      storylines = DataAggregator.aggregate_storylines()

      assert is_list(storylines)

      # Each storyline should have required fields
      for storyline <- storylines do
        assert Map.has_key?(storyline, :key)
        assert Map.has_key?(storyline, :name)
        assert Map.has_key?(storyline, :acts)
        assert Map.has_key?(storyline, :side_quests)
      end
    end
  end
end
