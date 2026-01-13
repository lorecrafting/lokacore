defmodule Loka.Framework.Farming.FarmPlotTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Farming.FarmPlot

  describe "get_plot/1" do
    test "returns nil for nil entity" do
      assert FarmPlot.get_plot(nil) == nil
    end

    test "returns nil for entity without farm_plot component" do
      entity = %{components: %{"inventory" => %{}}}
      assert FarmPlot.get_plot(entity) == nil
    end

    test "returns nil for entity without components" do
      entity = %{name: "Test Room"}
      assert FarmPlot.get_plot(entity) == nil
    end

    test "returns farm plot struct from entity with string keys" do
      entity = %{
        components: %{
          "farm_plot" => %{
            "slots" => 6,
            "soil_quality" => "good",
            "quality_bonus" => 1.2,
            "crops" => []
          }
        }
      }

      plot = FarmPlot.get_plot(entity)

      assert %FarmPlot{} = plot
      assert plot.slots == 6
      assert plot.soil_quality == "good"
      assert plot.quality_bonus == 1.2
      assert plot.crops == []
    end

    test "returns farm plot struct from entity with atom keys" do
      entity = %{
        components: %{
          farm_plot: %{
            slots: 4,
            soil_quality: "excellent",
            quality_bonus: 1.5,
            crops: []
          }
        }
      }

      plot = FarmPlot.get_plot(entity)

      assert %FarmPlot{} = plot
      assert plot.slots == 4
      assert plot.soil_quality == "excellent"
      assert plot.quality_bonus == 1.5
      assert plot.crops == []
    end
  end

  describe "from_component/1" do
    test "creates farm plot with defaults from empty map" do
      plot = FarmPlot.from_component(%{})

      assert plot.slots == 4
      assert plot.soil_quality == "normal"
      assert plot.quality_bonus == 1.0
      assert plot.crops == []
    end

    test "creates farm plot with custom values using string keys" do
      data = %{
        "slots" => 8,
        "soil_quality" => "excellent",
        "quality_bonus" => 1.5,
        "crops" => []
      }

      plot = FarmPlot.from_component(data)

      assert plot.slots == 8
      assert plot.soil_quality == "excellent"
      assert plot.quality_bonus == 1.5
      assert plot.crops == []
    end

    test "creates farm plot with custom values using atom keys" do
      data = %{
        slots: 6,
        soil_quality: "poor",
        quality_bonus: 0.8,
        crops: []
      }

      plot = FarmPlot.from_component(data)

      assert plot.slots == 6
      assert plot.soil_quality == "poor"
      assert plot.quality_bonus == 0.8
      assert plot.crops == []
    end

    test "uses default soil bonus when quality_bonus not provided" do
      data = %{"soil_quality" => "good"}
      plot = FarmPlot.from_component(data)

      assert plot.quality_bonus == 1.2
    end

    test "uses default bonus when soil quality is unknown" do
      data = %{"soil_quality" => "unknown_quality"}
      plot = FarmPlot.from_component(data)

      assert plot.quality_bonus == 1.0
    end

    test "parses crops from component data with string keys" do
      data = %{
        "crops" => [
          %{
            "slot" => 0,
            "crop_key" => "wheat",
            "current_stage" => "growing",
            "stage_timer" => 1_000_000,
            "watered" => true,
            "wither_timer" => 2_000_000
          },
          %{
            "slot" => 1,
            "crop_key" => "carrot",
            "current_stage" => "planted",
            "stage_timer" => nil,
            "watered" => false,
            "wither_timer" => nil
          }
        ]
      }

      plot = FarmPlot.from_component(data)

      assert length(plot.crops) == 2

      [crop1, crop2] = plot.crops

      assert crop1.slot == 0
      assert crop1.crop_key == "wheat"
      assert crop1.current_stage == "growing"
      assert crop1.stage_timer == 1_000_000
      assert crop1.watered == true
      assert crop1.wither_timer == 2_000_000

      assert crop2.slot == 1
      assert crop2.crop_key == "carrot"
      assert crop2.current_stage == "planted"
      assert crop2.stage_timer == nil
      assert crop2.watered == false
      assert crop2.wither_timer == nil
    end

    test "parses crops with atom keys" do
      data = %{
        crops: [
          %{
            slot: 2,
            crop_key: "tomato",
            current_stage: "mature",
            stage_timer: 5_000_000,
            watered: true,
            wither_timer: nil
          }
        ]
      }

      plot = FarmPlot.from_component(data)

      assert length(plot.crops) == 1
      [crop] = plot.crops

      assert crop.slot == 2
      assert crop.crop_key == "tomato"
      assert crop.current_stage == "mature"
    end

    test "uses defaults for missing crop fields" do
      data = %{
        "crops" => [
          %{}
        ]
      }

      plot = FarmPlot.from_component(data)

      assert length(plot.crops) == 1
      [crop] = plot.crops

      assert crop.slot == 0
      assert crop.crop_key == ""
      assert crop.current_stage == "planted"
      assert crop.stage_timer == nil
      assert crop.watered == false
      assert crop.wither_timer == nil
    end

    test "returns nil for non-map input" do
      assert FarmPlot.from_component(nil) == nil
      assert FarmPlot.from_component("invalid") == nil
      assert FarmPlot.from_component(123) == nil
    end
  end

  describe "slot_available?/2" do
    test "returns true for empty slot in range" do
      plot = %FarmPlot{slots: 4, crops: []}

      assert FarmPlot.slot_available?(plot, 0) == true
      assert FarmPlot.slot_available?(plot, 1) == true
      assert FarmPlot.slot_available?(plot, 3) == true
    end

    test "returns false for occupied slot" do
      plot = %FarmPlot{
        slots: 4,
        crops: [
          %{
            slot: 0,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.slot_available?(plot, 0) == false
      assert FarmPlot.slot_available?(plot, 1) == true
    end

    test "returns false for negative slot number" do
      plot = %FarmPlot{slots: 4, crops: []}

      assert FarmPlot.slot_available?(plot, -1) == false
    end

    test "returns false for slot number equal to or greater than total slots" do
      plot = %FarmPlot{slots: 4, crops: []}

      assert FarmPlot.slot_available?(plot, 4) == false
      assert FarmPlot.slot_available?(plot, 5) == false
      assert FarmPlot.slot_available?(plot, 100) == false
    end

    test "returns true for empty slot with multiple crops" do
      plot = %FarmPlot{
        slots: 4,
        crops: [
          %{
            slot: 0,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 2,
            crop_key: "carrot",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.slot_available?(plot, 0) == false
      assert FarmPlot.slot_available?(plot, 1) == true
      assert FarmPlot.slot_available?(plot, 2) == false
      assert FarmPlot.slot_available?(plot, 3) == true
    end
  end

  describe "get_crop_in_slot/2" do
    test "returns nil when slot is empty" do
      plot = %FarmPlot{slots: 4, crops: []}

      assert FarmPlot.get_crop_in_slot(plot, 0) == nil
    end

    test "returns crop when slot is occupied" do
      crop = %{
        slot: 1,
        crop_key: "wheat",
        current_stage: "growing",
        stage_timer: 1000,
        watered: true,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop]}

      result = FarmPlot.get_crop_in_slot(plot, 1)

      assert result == crop
    end

    test "returns correct crop when multiple crops exist" do
      crop1 = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      crop2 = %{
        slot: 2,
        crop_key: "carrot",
        current_stage: "growing",
        stage_timer: 5000,
        watered: true,
        wither_timer: nil
      }

      crop3 = %{
        slot: 3,
        crop_key: "tomato",
        current_stage: "mature",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop1, crop2, crop3]}

      assert FarmPlot.get_crop_in_slot(plot, 0) == crop1
      assert FarmPlot.get_crop_in_slot(plot, 1) == nil
      assert FarmPlot.get_crop_in_slot(plot, 2) == crop2
      assert FarmPlot.get_crop_in_slot(plot, 3) == crop3
    end
  end

  describe "occupied_slots/1" do
    test "returns empty list when no crops" do
      plot = %FarmPlot{slots: 4, crops: []}

      assert FarmPlot.occupied_slots(plot) == []
    end

    test "returns list of occupied slot numbers" do
      plot = %FarmPlot{
        slots: 4,
        crops: [
          %{
            slot: 0,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 2,
            crop_key: "carrot",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.occupied_slots(plot) == [0, 2]
    end

    test "returns sorted list of occupied slots" do
      plot = %FarmPlot{
        slots: 6,
        crops: [
          %{
            slot: 3,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 1,
            crop_key: "carrot",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 5,
            crop_key: "tomato",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.occupied_slots(plot) == [1, 3, 5]
    end
  end

  describe "available_slots/1" do
    test "returns all slots when no crops" do
      plot = %FarmPlot{slots: 4, crops: []}

      assert FarmPlot.available_slots(plot) == [0, 1, 2, 3]
    end

    test "returns empty list when all slots occupied" do
      plot = %FarmPlot{
        slots: 2,
        crops: [
          %{
            slot: 0,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 1,
            crop_key: "carrot",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.available_slots(plot) == []
    end

    test "returns list of available slot numbers" do
      plot = %FarmPlot{
        slots: 4,
        crops: [
          %{
            slot: 0,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 2,
            crop_key: "carrot",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.available_slots(plot) == [1, 3]
    end

    test "returns correct available slots with various configurations" do
      plot = %FarmPlot{
        slots: 6,
        crops: [
          %{
            slot: 1,
            crop_key: "wheat",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 3,
            crop_key: "carrot",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          },
          %{
            slot: 5,
            crop_key: "tomato",
            current_stage: "planted",
            stage_timer: nil,
            watered: false,
            wither_timer: nil
          }
        ]
      }

      assert FarmPlot.available_slots(plot) == [0, 2, 4]
    end
  end

  describe "get_quality_bonus/1" do
    test "returns quality bonus from plot" do
      plot = %FarmPlot{quality_bonus: 1.2}

      assert FarmPlot.get_quality_bonus(plot) == 1.2
    end

    test "returns correct bonus for different soil qualities" do
      poor_plot = %FarmPlot{quality_bonus: 0.8}
      normal_plot = %FarmPlot{quality_bonus: 1.0}
      good_plot = %FarmPlot{quality_bonus: 1.2}
      excellent_plot = %FarmPlot{quality_bonus: 1.5}

      assert FarmPlot.get_quality_bonus(poor_plot) == 0.8
      assert FarmPlot.get_quality_bonus(normal_plot) == 1.0
      assert FarmPlot.get_quality_bonus(good_plot) == 1.2
      assert FarmPlot.get_quality_bonus(excellent_plot) == 1.5
    end
  end

  describe "new_crop_state/5" do
    test "creates new crop state with stage duration" do
      current_time = 1_000_000
      stage_duration = 3600

      crop = FarmPlot.new_crop_state(0, "wheat", "planted", current_time, stage_duration)

      assert crop.slot == 0
      assert crop.crop_key == "wheat"
      assert crop.current_stage == "planted"
      assert crop.stage_timer == 1_003_600
      assert crop.watered == false
      assert crop.wither_timer == nil
    end

    test "creates new crop state without stage duration" do
      current_time = 1_000_000

      crop = FarmPlot.new_crop_state(2, "carrot", "mature", current_time, nil)

      assert crop.slot == 2
      assert crop.crop_key == "carrot"
      assert crop.current_stage == "mature"
      assert crop.stage_timer == nil
      assert crop.watered == false
      assert crop.wither_timer == nil
    end

    test "creates crop state for different slots" do
      current_time = 5_000_000
      stage_duration = 7200

      crop1 = FarmPlot.new_crop_state(0, "wheat", "planted", current_time, stage_duration)
      crop2 = FarmPlot.new_crop_state(3, "tomato", "growing", current_time, stage_duration)

      assert crop1.slot == 0
      assert crop2.slot == 3
      assert crop1.stage_timer == 5_007_200
      assert crop2.stage_timer == 5_007_200
    end

    test "handles zero stage duration" do
      current_time = 1_000_000
      stage_duration = 0

      crop = FarmPlot.new_crop_state(1, "wheat", "planted", current_time, stage_duration)

      assert crop.stage_timer == 1_000_000
    end
  end

  describe "add_crop/2" do
    test "adds crop to empty plot" do
      plot = %FarmPlot{slots: 4, crops: []}

      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      updated = FarmPlot.add_crop(plot, crop)

      assert length(updated.crops) == 1
      assert crop in updated.crops
    end

    test "adds crop to plot with existing crops" do
      existing_crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [existing_crop]}

      new_crop = %{
        slot: 1,
        crop_key: "carrot",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      updated = FarmPlot.add_crop(plot, new_crop)

      assert length(updated.crops) == 2
      assert existing_crop in updated.crops
      assert new_crop in updated.crops
    end

    test "preserves plot metadata when adding crop" do
      plot = %FarmPlot{slots: 6, soil_quality: "excellent", quality_bonus: 1.5, crops: []}

      crop = %{
        slot: 2,
        crop_key: "tomato",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      updated = FarmPlot.add_crop(plot, crop)

      assert updated.slots == 6
      assert updated.soil_quality == "excellent"
      assert updated.quality_bonus == 1.5
      assert crop in updated.crops
    end
  end

  describe "remove_crop/2" do
    test "removes crop from slot" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop]}

      updated = FarmPlot.remove_crop(plot, 0)

      assert updated.crops == []
    end

    test "removes specific crop from multiple crops" do
      crop1 = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      crop2 = %{
        slot: 1,
        crop_key: "carrot",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      crop3 = %{
        slot: 2,
        crop_key: "tomato",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop1, crop2, crop3]}

      updated = FarmPlot.remove_crop(plot, 1)

      assert length(updated.crops) == 2
      assert crop1 in updated.crops
      assert crop2 not in updated.crops
      assert crop3 in updated.crops
    end

    test "does nothing when slot is empty" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop]}

      updated = FarmPlot.remove_crop(plot, 2)

      assert length(updated.crops) == 1
      assert crop in updated.crops
    end

    test "preserves plot metadata when removing crop" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 6, soil_quality: "good", quality_bonus: 1.2, crops: [crop]}

      updated = FarmPlot.remove_crop(plot, 0)

      assert updated.slots == 6
      assert updated.soil_quality == "good"
      assert updated.quality_bonus == 1.2
      assert updated.crops == []
    end
  end

  describe "update_crop/3" do
    test "updates crop in specified slot" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop]}

      updated = FarmPlot.update_crop(plot, 0, %{current_stage: "growing", watered: true})

      [updated_crop] = updated.crops
      assert updated_crop.current_stage == "growing"
      assert updated_crop.watered == true
      assert updated_crop.crop_key == "wheat"
      assert updated_crop.slot == 0
    end

    test "updates specific crop among multiple crops" do
      crop1 = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      crop2 = %{
        slot: 1,
        crop_key: "carrot",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      crop3 = %{
        slot: 2,
        crop_key: "tomato",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop1, crop2, crop3]}

      updated = FarmPlot.update_crop(plot, 1, %{current_stage: "mature", stage_timer: 999_999})

      crops_by_slot = Enum.group_by(updated.crops, & &1.slot)

      assert crops_by_slot[0] |> List.first() |> Map.get(:current_stage) == "planted"
      assert crops_by_slot[1] |> List.first() |> Map.get(:current_stage) == "mature"
      assert crops_by_slot[1] |> List.first() |> Map.get(:stage_timer) == 999_999
      assert crops_by_slot[2] |> List.first() |> Map.get(:current_stage) == "planted"
    end

    test "updates multiple fields at once" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop]}

      updates = %{
        current_stage: "growing",
        stage_timer: 5_000_000,
        watered: true,
        wither_timer: 6_000_000
      }

      updated = FarmPlot.update_crop(plot, 0, updates)

      [updated_crop] = updated.crops
      assert updated_crop.current_stage == "growing"
      assert updated_crop.stage_timer == 5_000_000
      assert updated_crop.watered == true
      assert updated_crop.wither_timer == 6_000_000
    end

    test "does nothing when slot does not exist" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 4, crops: [crop]}

      updated = FarmPlot.update_crop(plot, 5, %{current_stage: "mature"})

      assert updated.crops == [crop]
    end

    test "preserves plot metadata when updating crop" do
      crop = %{
        slot: 0,
        crop_key: "wheat",
        current_stage: "planted",
        stage_timer: nil,
        watered: false,
        wither_timer: nil
      }

      plot = %FarmPlot{slots: 6, soil_quality: "excellent", quality_bonus: 1.5, crops: [crop]}

      updated = FarmPlot.update_crop(plot, 0, %{watered: true})

      assert updated.slots == 6
      assert updated.soil_quality == "excellent"
      assert updated.quality_bonus == 1.5
    end
  end

  describe "soil_qualities/0" do
    test "returns list of valid soil quality types" do
      qualities = FarmPlot.soil_qualities()

      assert is_list(qualities)
      assert "poor" in qualities
      assert "normal" in qualities
      assert "good" in qualities
      assert "excellent" in qualities
      assert length(qualities) == 4
    end
  end

  describe "default_bonus/1" do
    test "returns correct bonus for poor soil" do
      assert FarmPlot.default_bonus("poor") == 0.8
    end

    test "returns correct bonus for normal soil" do
      assert FarmPlot.default_bonus("normal") == 1.0
    end

    test "returns correct bonus for good soil" do
      assert FarmPlot.default_bonus("good") == 1.2
    end

    test "returns correct bonus for excellent soil" do
      assert FarmPlot.default_bonus("excellent") == 1.5
    end

    test "returns default 1.0 for unknown soil quality" do
      assert FarmPlot.default_bonus("unknown") == 1.0
      assert FarmPlot.default_bonus("invalid") == 1.0
      assert FarmPlot.default_bonus("") == 1.0
    end
  end
end
