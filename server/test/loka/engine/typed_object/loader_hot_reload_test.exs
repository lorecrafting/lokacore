defmodule Loka.Engine.TypedObject.LoaderHotReloadTest do
  @moduledoc """
  Tests for the hot-reload functionality in TypedObject.Loader:
  reload_file/1, remove/1, atomic_write/2, and PubSub broadcasting.
  """
  use ExUnit.Case, async: false

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Loader
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  # Helper to create a temp YAML file with unique name and auto-cleanup
  defp write_temp_yaml(yaml_content, opts \\ []) do
    prefix = Keyword.get(opts, :prefix, "test")
    subdir = Keyword.get(opts, :subdir, nil)

    unique = System.unique_integer([:positive])
    filename = "#{prefix}_#{unique}.yml"

    dir =
      if subdir do
        Path.join(System.tmp_dir!(), subdir)
      else
        System.tmp_dir!()
      end

    File.mkdir_p!(dir)
    path = Path.join(dir, filename)
    File.write!(path, yaml_content)

    ExUnit.Callbacks.on_exit(fn ->
      File.rm(path)
      # Clean up subdir if we created one (only if empty)
      if subdir, do: File.rmdir(Path.join(System.tmp_dir!(), subdir))
    end)

    path
  end

  # =============================================================================
  # reload_file/1
  # =============================================================================

  describe "reload_file/1" do
    test "loads a single file and updates only that entry in ETS" do
      yaml = """
      key: hot_reload_quest_1
      type: quest
      name: "Hot Reload Quest"
      description: "A quest loaded via reload_file"
      """

      path = write_temp_yaml(yaml)

      assert {:ok, "hot_reload_quest_1"} = Loader.reload_file(path)

      # Verify it's in the registry
      assert {:ok, obj} = Registry.get("hot_reload_quest_1")
      assert obj.key == "hot_reload_quest_1"
      assert obj.type == :quest
      assert obj.name == "Hot Reload Quest"
    end

    test "resolves parent from existing registry data" do
      # Put a parent in the registry first
      {:ok, parent} =
        TypedObject.new(
          key: "base_quest_parent",
          type: :quest,
          name: "Base Quest",
          description: "Parent description",
          tags: ["parent_tag"]
        )

      Registry.put("base_quest_parent", parent)

      # Create a child YAML that references the parent
      yaml = """
      key: child_quest_hr
      type: quest
      parent: base_quest_parent
      name: "Child Quest"
      """

      path = write_temp_yaml(yaml)

      assert {:ok, "child_quest_hr"} = Loader.reload_file(path)

      {:ok, child} = Registry.get("child_quest_hr")
      assert child.key == "child_quest_hr"
      assert child.name == "Child Quest"
      # Inherits description from parent
      assert child.description == "Parent description"
      # Inherits tags from parent
      assert "parent_tag" in child.tags
    end

    test "with invalid YAML returns error, existing data unchanged" do
      # Put something in the registry first
      {:ok, existing} =
        TypedObject.new(key: "existing_quest", type: :quest, name: "Existing")

      Registry.put("existing_quest", existing)

      # Write invalid YAML
      yaml = """
      this is not: valid: yaml: [broken
      """

      path = write_temp_yaml(yaml, prefix: "invalid")

      assert {:error, _reason} = Loader.reload_file(path)

      # Existing data should be unchanged
      assert {:ok, obj} = Registry.get("existing_quest")
      assert obj.name == "Existing"
    end

    test "with non-existent file returns error" do
      bogus_path =
        Path.join(System.tmp_dir!(), "nonexistent_file_#{System.unique_integer([:positive])}.yml")

      assert {:error, _reason} = Loader.reload_file(bogus_path)
    end
  end

  # =============================================================================
  # remove/1
  # =============================================================================

  describe "remove/1" do
    test "deletes entry and cleans up all indexes" do
      {:ok, obj} =
        TypedObject.new(
          key: "removable_quest",
          type: :quest,
          tags: ["remove_test_tag"]
        )

      Registry.put("removable_quest", obj)

      # Verify it exists in all indexes
      assert {:ok, _} = Registry.get("removable_quest")
      assert Enum.any?(Registry.list_by_type(:quest), &(&1.key == "removable_quest"))
      assert Enum.any?(Registry.list_by_tag("remove_test_tag"), &(&1.key == "removable_quest"))

      # Remove it via the Loader GenServer
      assert :ok = Loader.remove("removable_quest")

      # Verify it's gone from all indexes
      assert {:error, :not_found} = Registry.get("removable_quest")
      refute Enum.any?(Registry.list_by_type(:quest), &(&1.key == "removable_quest"))
      assert Registry.list_by_tag("remove_test_tag") == []
    end
  end

  # =============================================================================
  # atomic_write/2
  # =============================================================================

  describe "atomic_write/2" do
    test "writes file atomically" do
      unique = System.unique_integer([:positive])
      path = Path.join(System.tmp_dir!(), "atomic_write_test_#{unique}.yml")

      on_exit(fn -> File.rm(path) end)

      content = """
      key: atomic_test
      type: quest
      name: "Atomic Test"
      """

      assert :ok = Loader.atomic_write(path, content)
      assert File.exists?(path)
      assert File.read!(path) == content
    end

    test "creates parent directories" do
      unique = System.unique_integer([:positive])
      nested_dir = Path.join(System.tmp_dir!(), "atomic_nested_#{unique}/sub/dir")
      path = Path.join(nested_dir, "test.yml")

      on_exit(fn ->
        File.rm(path)
        File.rm_rf(Path.join(System.tmp_dir!(), "atomic_nested_#{unique}"))
      end)

      content = "key: nested_test\ntype: quest\n"

      assert :ok = Loader.atomic_write(path, content)
      assert File.exists?(path)
      assert File.read!(path) == content
    end

    test "no .tmp file left behind on success" do
      unique = System.unique_integer([:positive])
      path = Path.join(System.tmp_dir!(), "atomic_tmp_check_#{unique}.yml")
      tmp_path = path <> ".tmp"

      on_exit(fn -> File.rm(path) end)

      assert :ok = Loader.atomic_write(path, "key: tmp_check\ntype: quest\n")

      assert File.exists?(path)
      refute File.exists?(tmp_path)
    end
  end

  # =============================================================================
  # PubSub broadcasting
  # =============================================================================

  describe "PubSub broadcasting" do
    test "reload_file broadcasts :content_changed" do
      Phoenix.PubSub.subscribe(Loka.PubSub, "content:changed")

      yaml = """
      key: pubsub_reload_quest
      type: quest
      name: "PubSub Reload Quest"
      """

      path = write_temp_yaml(yaml, prefix: "pubsub")

      assert {:ok, "pubsub_reload_quest"} = Loader.reload_file(path)

      assert_receive {:content_changed, "pubsub_reload_quest", :quest, nil}, 1000
    end

    test "remove broadcasts :content_deleted" do
      Phoenix.PubSub.subscribe(Loka.PubSub, "content:changed")

      # Put an item in registry first
      {:ok, obj} = TypedObject.new(key: "pubsub_remove_quest", type: :quest)
      Registry.put("pubsub_remove_quest", obj)

      assert :ok = Loader.remove("pubsub_remove_quest")

      assert_receive {:content_deleted, "pubsub_remove_quest"}, 1000
    end
  end
end
