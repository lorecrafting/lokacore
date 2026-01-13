defmodule Loka.Engine.ZoneLoaderTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.ZoneLoader

  @test_zones_path "test/fixtures/zones"

  setup do
    # Create test zones directory
    File.mkdir_p!(@test_zones_path)

    on_exit(fn ->
      File.rm_rf!(@test_zones_path)
    end)

    :ok
  end

  describe "start_link/1" do
    test "starts with empty zones when path doesn't exist" do
      {:ok, pid} =
        ZoneLoader.start_link(
          name: :test_zone_loader,
          path: "nonexistent/path",
          load_on_start: true
        )

      assert ZoneLoader.count(:test_zone_loader) == 0
      GenServer.stop(pid)
    end

    test "loads zones from path on startup" do
      write_zone_file("test_zone.yml", %{
        key: "test_zone",
        name: "Test Zone",
        rooms: ["room1"]
      })

      {:ok, pid} =
        ZoneLoader.start_link(
          name: :test_zone_loader,
          path: @test_zones_path,
          load_on_start: true
        )

      assert ZoneLoader.count(:test_zone_loader) == 1
      assert {:ok, zone} = ZoneLoader.get("test_zone", :test_zone_loader)
      assert zone.name == "Test Zone"

      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns zone by key" do
      write_zone_file("forest.yml", %{
        key: "forest",
        name: "Dark Forest",
        rooms: ["clearing"]
      })

      {:ok, pid} = start_loader()

      assert {:ok, zone} = ZoneLoader.get("forest", :test_zone_loader)
      assert zone.key == "forest"

      GenServer.stop(pid)
    end

    test "returns error for unknown key" do
      {:ok, pid} = start_loader()

      assert {:error, :not_found} = ZoneLoader.get("unknown", :test_zone_loader)

      GenServer.stop(pid)
    end
  end

  describe "all/1" do
    test "returns all zones" do
      write_zone_file("zone1.yml", %{key: "zone1", name: "Zone 1", rooms: ["r1"]})
      write_zone_file("zone2.yml", %{key: "zone2", name: "Zone 2", rooms: ["r2"]})

      {:ok, pid} = start_loader()

      zones = ZoneLoader.all(:test_zone_loader)
      assert length(zones) == 2

      GenServer.stop(pid)
    end
  end

  describe "enabled/1" do
    test "returns only enabled zones" do
      write_zone_file("enabled.yml", %{
        key: "enabled",
        name: "Enabled",
        rooms: ["r"],
        enabled: true
      })

      write_zone_file("disabled.yml", %{
        key: "disabled",
        name: "Disabled",
        rooms: ["r"],
        enabled: false
      })

      {:ok, pid} = start_loader()

      enabled = ZoneLoader.enabled(:test_zone_loader)
      assert length(enabled) == 1
      assert hd(enabled).key == "enabled"

      GenServer.stop(pid)
    end
  end

  describe "set_enabled/3" do
    test "enables and disables zones" do
      write_zone_file("zone.yml", %{key: "zone", name: "Zone", rooms: ["r"]})

      {:ok, pid} = start_loader()

      assert {:ok, zone} = ZoneLoader.get("zone", :test_zone_loader)
      assert zone.enabled == true

      assert :ok = ZoneLoader.set_enabled("zone", false, :test_zone_loader)
      assert {:ok, zone} = ZoneLoader.get("zone", :test_zone_loader)
      assert zone.enabled == false

      GenServer.stop(pid)
    end

    test "returns error for unknown zone" do
      {:ok, pid} = start_loader()

      assert {:error, :not_found} = ZoneLoader.set_enabled("unknown", true, :test_zone_loader)

      GenServer.stop(pid)
    end
  end

  describe "reload/1" do
    test "reloads zones from disk" do
      write_zone_file("zone.yml", %{key: "zone", name: "Original", rooms: ["r"]})

      {:ok, pid} = start_loader()

      assert {:ok, zone} = ZoneLoader.get("zone", :test_zone_loader)
      assert zone.name == "Original"

      # Update the file
      write_zone_file("zone.yml", %{key: "zone", name: "Updated", rooms: ["r"]})

      assert :ok = ZoneLoader.reload(:test_zone_loader)

      assert {:ok, zone} = ZoneLoader.get("zone", :test_zone_loader)
      assert zone.name == "Updated"

      GenServer.stop(pid)
    end
  end

  describe "update_last_reset/3" do
    test "updates zone last reset timestamp" do
      write_zone_file("zone.yml", %{key: "zone", name: "Zone", rooms: ["r"]})

      {:ok, pid} = start_loader()

      timestamp = DateTime.utc_now()
      ZoneLoader.update_last_reset("zone", timestamp, :test_zone_loader)

      # Give the cast time to process
      Process.sleep(50)

      assert {:ok, zone} = ZoneLoader.get("zone", :test_zone_loader)
      assert zone.last_reset_at == timestamp

      GenServer.stop(pid)
    end
  end

  # Helper functions

  defp start_loader do
    ZoneLoader.start_link(
      name: :test_zone_loader,
      path: @test_zones_path,
      load_on_start: true
    )
  end

  defp write_zone_file(filename, attrs) do
    content = Enum.map_join(attrs, "\n", fn {k, v} -> yaml_line(k, v) end)
    File.write!(Path.join(@test_zones_path, filename), content)
  end

  defp yaml_line(key, value) when is_list(value) do
    items = Enum.map_join(value, "\n", fn v -> "  - #{v}" end)
    "#{key}:\n#{items}"
  end

  defp yaml_line(key, value) when is_boolean(value), do: "#{key}: #{value}"
  defp yaml_line(key, value) when is_integer(value), do: "#{key}: #{value}"
  defp yaml_line(key, value), do: "#{key}: \"#{value}\""
end
