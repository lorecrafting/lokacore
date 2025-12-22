defmodule Exmud.Engine.PrototypeLoaderTest do
  use ExUnit.Case, async: false

  alias Exmud.Engine.PrototypeLoader

  @test_fixtures_path "test/support/fixtures/prototypes"

  setup do
    # Start a fresh loader for each test with a unique name
    name = :"loader_#{System.unique_integer([:positive])}"

    {:ok, pid} =
      PrototypeLoader.start_link(
        name: name,
        path: @test_fixtures_path,
        load_on_start: true
      )

    on_exit(fn ->
      if Process.alive?(pid), do: GenServer.stop(pid)
    end)

    {:ok, loader: name}
  end

  describe "start_link/1" do
    test "starts the loader and loads prototypes", %{loader: loader} do
      assert PrototypeLoader.count(loader) > 0
    end

    test "starts empty when path doesn't exist" do
      name = :"loader_empty_#{System.unique_integer([:positive])}"

      {:ok, pid} =
        PrototypeLoader.start_link(
          name: name,
          path: "nonexistent/path",
          load_on_start: true
        )

      assert PrototypeLoader.count(name) == 0
      GenServer.stop(pid)
    end

    test "can start without loading" do
      name = :"loader_no_load_#{System.unique_integer([:positive])}"

      {:ok, pid} =
        PrototypeLoader.start_link(
          name: name,
          path: @test_fixtures_path,
          load_on_start: false
        )

      assert PrototypeLoader.count(name) == 0
      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns prototype by key", %{loader: loader} do
      assert {:ok, proto} = PrototypeLoader.get("goblin", loader)
      assert proto.key == "goblin"
      assert proto.type == :npc
    end

    test "returns :not_found for unknown key", %{loader: loader} do
      assert {:error, :not_found} = PrototypeLoader.get("nonexistent", loader)
    end

    test "resolves parent inheritance", %{loader: loader} do
      {:ok, goblin} = PrototypeLoader.get("goblin", loader)

      # Child values override parent
      assert goblin.name == "Goblin"
      assert goblin.components["combatant"]["health"]["max"] == 30

      # Parent value inherited where child doesn't override
      assert goblin.components["combatant"]["level"] == 2

      # Tags are merged (child + parent)
      assert "hostile" in goblin.tags
      assert "npc" in goblin.tags
    end

    test "base prototype has no parent merge", %{loader: loader} do
      {:ok, base_npc} = PrototypeLoader.get("base_npc", loader)

      assert base_npc.parent == nil
      assert base_npc.name == "Base NPC"
      assert base_npc.components["combatant"]["health"]["max"] == 100
    end
  end

  describe "get!/2" do
    test "returns prototype on success", %{loader: loader} do
      proto = PrototypeLoader.get!("goblin", loader)
      assert proto.key == "goblin"
    end

    test "raises on not found", %{loader: loader} do
      assert_raise RuntimeError, ~r/Prototype not found/, fn ->
        PrototypeLoader.get!("nonexistent", loader)
      end
    end
  end

  describe "list_by_type/2" do
    test "returns all prototypes of a type", %{loader: loader} do
      npcs = PrototypeLoader.list_by_type(:npc, loader)

      assert length(npcs) >= 3
      assert Enum.all?(npcs, &(&1.type == :npc))

      keys = Enum.map(npcs, & &1.key)
      assert "goblin" in keys
      assert "merchant" in keys
      assert "base_npc" in keys
    end

    test "returns rooms", %{loader: loader} do
      rooms = PrototypeLoader.list_by_type(:room, loader)

      assert length(rooms) >= 1
      assert Enum.all?(rooms, &(&1.type == :room))

      keys = Enum.map(rooms, & &1.key)
      assert "town_square" in keys
    end

    test "returns empty list for type with no prototypes", %{loader: loader} do
      items = PrototypeLoader.list_by_type(:item, loader)
      assert items == []
    end
  end

  describe "all/1" do
    test "returns all loaded prototypes", %{loader: loader} do
      all = PrototypeLoader.all(loader)

      assert length(all) >= 4
      keys = Enum.map(all, & &1.key)
      assert "goblin" in keys
      assert "merchant" in keys
      assert "base_npc" in keys
      assert "town_square" in keys
    end
  end

  describe "count/1" do
    test "returns count of prototypes", %{loader: loader} do
      assert PrototypeLoader.count(loader) >= 4
    end
  end

  describe "validate_all/1" do
    test "returns :ok when all valid", %{loader: loader} do
      assert :ok = PrototypeLoader.validate_all(loader)
    end

    test "returns errors for broken parent refs" do
      # Create a fixture with broken parent
      broken_path = Path.join(System.tmp_dir!(), "broken_prototypes_#{System.unique_integer()}")
      File.mkdir_p!(broken_path)

      File.write!(
        Path.join(broken_path, "broken.yml"),
        """
        key: broken_child
        parent: nonexistent_parent
        type: npc
        name: "Broken Child"
        """
      )

      name = :"loader_broken_#{System.unique_integer([:positive])}"

      {:ok, pid} =
        PrototypeLoader.start_link(
          name: name,
          path: broken_path,
          load_on_start: true
        )

      assert {:error, errors} = PrototypeLoader.validate_all(name)
      assert length(errors) > 0

      error_types = Enum.map(errors, fn {type, _, _} -> type end)
      assert :broken_parent_ref in error_types

      GenServer.stop(pid)
      File.rm_rf!(broken_path)
    end
  end

  describe "reload/1" do
    test "reloads prototypes from disk", %{loader: loader} do
      initial_count = PrototypeLoader.count(loader)

      # Reload
      assert :ok = PrototypeLoader.reload(loader)

      # Count should be the same
      assert PrototypeLoader.count(loader) == initial_count
    end
  end

  describe "load_from/2" do
    test "loads from a different path", %{loader: loader} do
      # Create a temporary directory with a single prototype
      temp_path = Path.join(System.tmp_dir!(), "temp_protos_#{System.unique_integer()}")
      File.mkdir_p!(temp_path)

      File.write!(
        Path.join(temp_path, "test_item.yml"),
        """
        key: test_item
        type: item
        name: "Test Item"
        description: "A test item."
        """
      )

      :ok = PrototypeLoader.load_from(temp_path, loader)

      # Should now have only the test_item
      assert PrototypeLoader.count(loader) == 1
      assert {:ok, proto} = PrototypeLoader.get("test_item", loader)
      assert proto.name == "Test Item"

      File.rm_rf!(temp_path)
    end
  end

  describe "inheritance chain" do
    test "deep inheritance merges correctly", %{loader: loader} do
      {:ok, merchant} = PrototypeLoader.get("merchant", loader)

      # Merchant inherits from base_npc
      assert merchant.parent == "base_npc"

      # Should have merged tags
      assert "friendly" in merchant.tags
      assert "npc" in merchant.tags

      # Should have inherited combatant component from base_npc
      assert merchant.components["combatant"]["health"]["max"] == 100
    end
  end

  describe "prototype types" do
    test "room prototype loads correctly", %{loader: loader} do
      {:ok, room} = PrototypeLoader.get("town_square", loader)

      assert room.type == :room
      assert room.name == "Town Square"
      assert room.exits["north"] == "general_store"
      assert "town" in room.tags
    end
  end
end
