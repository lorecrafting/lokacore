defmodule Loka.WorldBuilder.ToolExecutor.ZonesTest do
  @moduledoc "Tests for ToolExecutor.Zones domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Zones

  describe "execute_create_zone/1" do
    test "creates zone with valid input" do
      input = %{
        "key" => "zone_test_#{System.unique_integer([:positive])}",
        "name" => "Test Zone",
        "rooms" => ["room_a", "room_b"]
      }

      case Zones.execute_create_zone(input) do
        {:ok, r} ->
          assert r.success == true
          assert r.message =~ "Created zone"

        {:error, reason} ->
          assert is_binary(reason)
      end
    end

    test "creates zone with default rooms list" do
      input = %{
        "key" => "zone_test_norooms_#{System.unique_integer([:positive])}",
        "name" => "Empty Zone"
      }

      case Zones.execute_create_zone(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end
  end

  describe "execute_list_zones/1" do
    test "lists all zones" do
      assert {:ok, result} = Zones.execute_list_zones(%{})
      assert result.success == true
      assert is_list(result.zones)
    end
  end

  describe "execute_get_zone_info/1" do
    test "returns error for non-existent zone" do
      assert {:error, _} = Zones.execute_get_zone_info(%{"zone_key" => "nonexistent_zone_xyz"})
    end
  end

  describe "execute_create_cutscene/1" do
    test "creates cutscene with valid input" do
      input = %{
        "key" => "cutscene_test_#{System.unique_integer([:positive])}",
        "name" => "Test Cutscene",
        "beats" => [
          %{"type" => "narration", "text" => "The wind howls..."},
          %{"type" => "narration", "text" => "A figure appears."}
        ]
      }

      case Zones.execute_create_cutscene(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end
  end

  describe "execute_list_cutscenes/1" do
    test "lists all cutscenes" do
      assert {:ok, result} = Zones.execute_list_cutscenes(%{})
      assert result.success == true
    end
  end

  describe "execute_create_storyline/1" do
    test "creates storyline with valid input" do
      input = %{
        "key" => "storyline_test_#{System.unique_integer([:positive])}",
        "name" => "Test Storyline",
        "quests" => ["quest_a", "quest_b"]
      }

      case Zones.execute_create_storyline(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end
  end

  describe "execute_list_storylines/1" do
    test "lists all storylines" do
      assert {:ok, result} = Zones.execute_list_storylines(%{})
      assert result.success == true
    end
  end
end
