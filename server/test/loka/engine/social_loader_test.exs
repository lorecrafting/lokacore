defmodule Loka.Engine.SocialLoaderTest do
  use ExUnit.Case, async: false

  alias Loka.Engine.SocialLoader

  @test_fixtures_path "test/support/fixtures/socials/test_socials.yml"

  setup do
    # Start a fresh loader for each test with a unique name
    name = :"social_loader_#{System.unique_integer([:positive])}"

    {:ok, pid} =
      SocialLoader.start_link(
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
    test "starts the loader and loads socials", %{loader: loader} do
      assert SocialLoader.count(loader) > 0
    end

    test "starts empty when path doesn't exist" do
      name = :"social_loader_empty_#{System.unique_integer([:positive])}"

      {:ok, pid} =
        SocialLoader.start_link(
          name: name,
          path: "nonexistent/path/socials.yml",
          load_on_start: true
        )

      assert SocialLoader.count(name) == 0
      GenServer.stop(pid)
    end

    test "can start without loading" do
      name = :"social_loader_no_load_#{System.unique_integer([:positive])}"

      {:ok, pid} =
        SocialLoader.start_link(
          name: name,
          path: @test_fixtures_path,
          load_on_start: false
        )

      assert SocialLoader.count(name) == 0
      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns social by key", %{loader: loader} do
      assert {:ok, social} = SocialLoader.get("smile", loader)
      assert social.key == "smile"
      assert social.min_position == :resting
    end

    test "returns :not_found for unknown key", %{loader: loader} do
      assert {:error, :not_found} = SocialLoader.get("nonexistent", loader)
    end

    test "returns social by alias", %{loader: loader} do
      # "grin" is an alias for "smile"
      assert {:ok, social} = SocialLoader.get("grin", loader)
      assert social.key == "smile"
    end
  end

  describe "get!/2" do
    test "returns social on success", %{loader: loader} do
      social = SocialLoader.get!("smile", loader)
      assert social.key == "smile"
    end

    test "raises on not found", %{loader: loader} do
      assert_raise RuntimeError, ~r/Social not found/, fn ->
        SocialLoader.get!("nonexistent", loader)
      end
    end
  end

  describe "all/1" do
    test "returns all loaded socials", %{loader: loader} do
      all = SocialLoader.all(loader)

      assert map_size(all) >= 3
      assert Map.has_key?(all, "smile")
      assert Map.has_key?(all, "hug")
      assert Map.has_key?(all, "wave")
    end
  end

  describe "keys/1" do
    test "returns all social keys", %{loader: loader} do
      keys = SocialLoader.keys(loader)

      assert "smile" in keys
      assert "hug" in keys
      assert "wave" in keys
      # Aliases should NOT be in keys (only primary keys)
      refute "grin" in keys
    end
  end

  describe "count/1" do
    test "returns count of socials", %{loader: loader} do
      assert SocialLoader.count(loader) >= 3
    end
  end

  describe "reload/1" do
    test "reloads socials from disk", %{loader: loader} do
      initial_count = SocialLoader.count(loader)

      # Reload
      assert :ok = SocialLoader.reload(loader)

      # Count should be the same
      assert SocialLoader.count(loader) == initial_count
    end
  end

  describe "social properties" do
    test "smile has correct no_target messages", %{loader: loader} do
      {:ok, smile} = SocialLoader.get("smile", loader)

      assert smile.messages.no_target.to_actor == "You smile happily."
      assert smile.messages.no_target.to_room == "{actor} smiles happily."
    end

    test "smile has correct with_target messages", %{loader: loader} do
      {:ok, smile} = SocialLoader.get("smile", loader)

      assert smile.messages.with_target.to_actor == "You smile at {target}."
      assert smile.messages.with_target.to_target == "{actor} smiles at you."
      assert smile.messages.with_target.to_room == "{actor} smiles at {target}."
    end

    test "smile has correct self_target messages", %{loader: loader} do
      {:ok, smile} = SocialLoader.get("smile", loader)

      assert smile.messages.self_target.to_actor == "You smile to yourself."
      assert smile.messages.self_target.to_room == "{actor} smiles to {self_pronoun}."
    end

    test "hug requires target", %{loader: loader} do
      {:ok, hug} = SocialLoader.get("hug", loader)
      assert hug.requires_target == true
    end

    test "hug requires standing position", %{loader: loader} do
      {:ok, hug} = SocialLoader.get("hug", loader)
      assert hug.min_position == :standing
    end
  end
end
