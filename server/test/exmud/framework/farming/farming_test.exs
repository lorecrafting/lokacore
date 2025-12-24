defmodule Exmud.Framework.FarmingTest do
  use Exmud.DataCase

  alias Exmud.Framework.Farming
  alias Exmud.Framework.Farming.FarmPlot
  alias Exmud.Framework.Player.GameState

  import Exmud.EngineFixtures
  import Exmud.AccountsFixtures

  # =============================================================================
  # Test Fixtures and Helpers
  # =============================================================================

  # Helper to create a room with a farm plot
  defp room_with_plot_fixture(attrs \\ %{}) do
    # Convert attrs to map if it's a keyword list
    attrs = if Keyword.keyword?(attrs), do: Enum.into(attrs, %{}), else: attrs
    plot_config = Map.get(attrs, :plot, %{})

    plot_component = %{
      "slots" => Map.get(plot_config, :slots, 4),
      "soil_quality" => Map.get(plot_config, :soil_quality, "normal"),
      "quality_bonus" => Map.get(plot_config, :quality_bonus, 1.0),
      "crops" => Map.get(plot_config, :crops, [])
    }

    components = Map.merge(Map.get(attrs, :components, %{}), %{"farm_plot" => plot_component})

    room_fixture(Map.merge(attrs, %{components: components}))
  end

  # Helper to create a game state with inventory
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    default_stats = %{
      "farming" => 5,
      "level" => 1,
      "gold" => 0
    }

    merged_attrs = %{
      inventory: Map.get(attrs, :inventory, []),
      stats: Map.merge(default_stats, Map.get(attrs, :stats, %{}))
    }

    if map_size(merged_attrs) > 0 do
      {:ok, state} = GameState.update_state(state, merged_attrs)
      state
    else
      state
    end
  end

  # =============================================================================
  # get_plot/1
  # =============================================================================

  describe "get_plot/1" do
    test "returns plot from room entity with farm_plot component" do
      room = room_with_plot_fixture()

      plot = Farming.get_plot(room)

      assert %FarmPlot{} = plot
      assert plot.slots == 4
      assert plot.soil_quality == "normal"
      assert plot.quality_bonus == 1.0
    end

    test "returns nil for room without farm_plot component" do
      room = room_fixture()

      assert Farming.get_plot(room) == nil
    end

    test "returns nil for nil input" do
      assert Farming.get_plot(nil) == nil
    end

    test "parses plot with custom soil quality" do
      room = room_with_plot_fixture(plot: %{soil_quality: "excellent", quality_bonus: 1.5})

      plot = Farming.get_plot(room)

      assert plot.soil_quality == "excellent"
      assert plot.quality_bonus == 1.5
    end

    test "parses plot with custom slot count" do
      room = room_with_plot_fixture(plot: %{slots: 8})

      plot = Farming.get_plot(room)

      assert plot.slots == 8
    end

    test "parses plot with existing crops" do
      crops = [
        %{"slot" => 0, "crop_key" => "wheat", "current_stage" => "planted", "stage_timer" => nil, "watered" => false, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})

      plot = Farming.get_plot(room)

      assert length(plot.crops) == 1
      assert hd(plot.crops).slot == 0
      assert hd(plot.crops).crop_key == "wheat"
    end
  end

  # =============================================================================
  # list_crops/1
  # =============================================================================

  describe "list_crops/1" do
    test "returns empty list when room has no plot" do
      room = room_fixture()

      assert Farming.list_crops(room) == []
    end

    test "returns empty list when plot has no crops" do
      room = room_with_plot_fixture()

      assert Farming.list_crops(room) == []
    end

    test "returns list of crops when plot has crops" do
      crops = [
        %{"slot" => 0, "crop_key" => "wheat", "current_stage" => "planted", "stage_timer" => nil, "watered" => false, "wither_timer" => nil},
        %{"slot" => 1, "crop_key" => "carrots", "current_stage" => "sprouting", "stage_timer" => nil, "watered" => true, "wither_timer" => nil}
      ]

      room = room_with_plot_fixture(plot: %{crops: crops})

      result = Farming.list_crops(room)

      assert length(result) == 2
      assert Enum.any?(result, &(&1.crop_key == "wheat"))
      assert Enum.any?(result, &(&1.crop_key == "carrots"))
    end
  end

  # =============================================================================
  # get_crop_status/2
  # =============================================================================

  describe "get_crop_status/2" do
    test "returns error for room without plot" do
      room = room_fixture()

      assert {:error, :no_farm_plot} = Farming.get_crop_status(room, 0)
    end

    test "returns error for empty slot" do
      room = room_with_plot_fixture()

      assert {:error, :empty_slot} = Farming.get_crop_status(room, 0)
    end

    @tag :skip
    test "returns error for unknown crop key" do
      # Skipped: Requires CropRegistry to be running
      crops = [
        %{"slot" => 0, "crop_key" => "unknown_crop", "current_stage" => "planted", "stage_timer" => nil, "watered" => false, "wither_timer" => nil}
      ]

      room = room_with_plot_fixture(plot: %{crops: crops})

      assert {:error, :unknown_crop} = Farming.get_crop_status(room, 0)
    end
  end

  # =============================================================================
  # can_plant?/4
  # =============================================================================

  describe "can_plant?/4" do
    test "returns error when room has no plot" do
      player = player_fixture()
      room = room_fixture()
      game_state = game_state_fixture(player.id, %{inventory: ["wheat_seeds"]})

      assert {:error, :no_farm_plot} = Farming.can_plant?(game_state, room, 0, "wheat_seeds")
    end

    test "returns error when slot is invalid (too high)" do
      player = player_fixture()
      room = room_with_plot_fixture(plot: %{slots: 2})
      game_state = game_state_fixture(player.id, %{inventory: ["wheat_seeds"]})

      assert {:error, {:invalid_slot, 5, 2}} = Farming.can_plant?(game_state, room, 5, "wheat_seeds")
    end

    test "returns error when slot is negative" do
      player = player_fixture()
      room = room_with_plot_fixture()
      game_state = game_state_fixture(player.id, %{inventory: ["wheat_seeds"]})

      assert {:error, {:invalid_slot, -1, 4}} = Farming.can_plant?(game_state, room, -1, "wheat_seeds")
    end

    test "returns error when slot is occupied" do
      player = player_fixture()
      crops = [
        %{"slot" => 0, "crop_key" => "wheat", "current_stage" => "planted", "stage_timer" => nil, "watered" => false, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})
      game_state = game_state_fixture(player.id, %{inventory: ["wheat_seeds"]})

      assert {:error, :slot_occupied} = Farming.can_plant?(game_state, room, 0, "wheat_seeds")
    end

    @tag :skip
    test "returns error for unknown seed item" do
      # Skipped: Requires CropRegistry to be running
      player = player_fixture()
      room = room_with_plot_fixture()
      game_state = game_state_fixture(player.id, %{inventory: ["unknown_seeds"]})

      assert {:error, :not_found} = Farming.can_plant?(game_state, room, 0, "unknown_seeds")
    end

    @tag :skip
    test "returns error when player doesn't have the seed" do
      # Skipped: Requires CropRegistry to be running
      player = player_fixture()
      room = room_with_plot_fixture()
      game_state = game_state_fixture(player.id, %{inventory: []})

      # Note: This will fail at CropRegistry.by_seed first since we don't have real crops
      assert {:error, _} = Farming.can_plant?(game_state, room, 0, "wheat_seeds")
    end
  end

  # =============================================================================
  # plant/4
  # =============================================================================

  describe "plant/4" do
    test "returns error when plot doesn't exist" do
      player = player_fixture()
      room = room_fixture()
      game_state = game_state_fixture(player.id, %{inventory: ["wheat_seeds"]})

      assert {:error, :no_farm_plot} = Farming.plant(game_state, room, 0, "wheat_seeds")
    end

    @tag :skip
    test "returns error for unknown seed" do
      # Skipped: Requires CropRegistry to be running
      player = player_fixture()
      room = room_with_plot_fixture()
      game_state = game_state_fixture(player.id, %{inventory: ["unknown_seeds"]})

      assert {:error, :not_found} = Farming.plant(game_state, room, 0, "unknown_seeds")
    end

    test "returns error when slot is occupied" do
      player = player_fixture()
      crops = [
        %{"slot" => 0, "crop_key" => "wheat", "current_stage" => "planted", "stage_timer" => nil, "watered" => false, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})
      game_state = game_state_fixture(player.id, %{inventory: ["wheat_seeds"]})

      assert {:error, :slot_occupied} = Farming.plant(game_state, room, 0, "wheat_seeds")
    end
  end

  # =============================================================================
  # water/2
  # =============================================================================

  describe "water/2" do
    test "returns error when no plot exists" do
      room = room_fixture()

      assert {:error, :no_farm_plot} = Farming.water(room, 0)
    end

    test "returns error when slot is empty" do
      room = room_with_plot_fixture()

      assert {:error, :empty_slot} = Farming.water(room, 0)
    end

    @tag :skip
    test "returns error when crop doesn't exist in registry" do
      # Skipped: Requires CropRegistry to be running
      crops = [
        %{"slot" => 0, "crop_key" => "unknown_crop", "current_stage" => "planted", "stage_timer" => nil, "watered" => false, "wither_timer" => 999}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})

      assert {:error, :not_found} = Farming.water(room, 0)
    end
  end

  # =============================================================================
  # can_harvest?/2
  # =============================================================================

  describe "can_harvest?/2" do
    test "returns error when no plot exists" do
      room = room_fixture()

      assert {:error, :no_farm_plot} = Farming.can_harvest?(room, 0)
    end

    test "returns error when slot is empty" do
      room = room_with_plot_fixture()

      assert {:error, :empty_slot} = Farming.can_harvest?(room, 0)
    end

    @tag :skip
    test "returns error when crop doesn't exist in registry" do
      # Skipped: Requires CropRegistry to be running
      crops = [
        %{"slot" => 0, "crop_key" => "unknown_crop", "current_stage" => "harvestable", "stage_timer" => nil, "watered" => true, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})

      assert {:error, :not_found} = Farming.can_harvest?(room, 0)
    end
  end

  # =============================================================================
  # harvest/3
  # =============================================================================

  describe "harvest/3" do
    test "returns error when no plot exists" do
      room = room_fixture()
      player = player_fixture()
      game_state = game_state_fixture(player.id)

      assert {:error, :no_farm_plot} = Farming.harvest(game_state, room, 0)
    end

    test "returns error when slot is empty" do
      room = room_with_plot_fixture()
      player = player_fixture()
      game_state = game_state_fixture(player.id)

      assert {:error, :empty_slot} = Farming.harvest(game_state, room, 0)
    end

    @tag :skip
    test "returns error when crop doesn't exist in registry" do
      # Skipped: Requires CropRegistry to be running
      crops = [
        %{"slot" => 0, "crop_key" => "unknown_crop", "current_stage" => "harvestable", "stage_timer" => nil, "watered" => false, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})
      player = player_fixture()
      game_state = game_state_fixture(player.id)

      assert {:error, :not_found} = Farming.harvest(game_state, room, 0)
    end
  end

  # =============================================================================
  # tick_growth/2
  # =============================================================================

  describe "tick_growth/2" do
    test "returns ok with nil when room has no plot" do
      room = room_fixture()

      assert {:ok, nil} = Farming.tick_growth(room)
    end

    test "returns updated plot when room has empty plot" do
      room = room_with_plot_fixture()

      assert {:ok, updated_plot} = Farming.tick_growth(room)
      assert updated_plot.crops == []
      assert updated_plot.slots == 4
    end

    @tag :skip
    test "handles crops with unknown registry keys gracefully" do
      # Skipped: Requires CropRegistry to be running
      current_time = System.system_time(:second)

      crops = [
        %{"slot" => 0, "crop_key" => "unknown_crop", "current_stage" => "planted", "stage_timer" => current_time + 100, "watered" => false, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})

      # Should not crash, just return crop as-is when registry lookup fails
      assert {:ok, updated_plot} = Farming.tick_growth(room, current_time)
      assert length(updated_plot.crops) == 1
    end

    @tag :skip
    test "preserves multiple crops when ticking" do
      # Skipped: Requires CropRegistry to be running
      current_time = System.system_time(:second)
      future_time = current_time + 1000

      crops = [
        %{"slot" => 0, "crop_key" => "unknown_crop_1", "current_stage" => "planted", "stage_timer" => future_time, "watered" => false, "wither_timer" => nil},
        %{"slot" => 1, "crop_key" => "unknown_crop_2", "current_stage" => "planted", "stage_timer" => future_time, "watered" => false, "wither_timer" => nil}
      ]
      room = room_with_plot_fixture(plot: %{crops: crops})

      assert {:ok, updated_plot} = Farming.tick_growth(room, current_time)
      assert length(updated_plot.crops) == 2
    end

    test "uses current system time when no time provided" do
      room = room_with_plot_fixture()

      # Should not crash when calling without explicit time
      assert {:ok, _updated_plot} = Farming.tick_growth(room)
    end
  end
end
