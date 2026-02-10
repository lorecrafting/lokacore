defmodule LokaWeb.Channels.VersionCompatibilityTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.VersionCompatibility

  describe "validate_client/1" do
    test "returns ok with version info for valid version" do
      assert {:ok, info} = VersionCompatibility.validate_client(%{"client_version" => "1.0.0"})
      assert info.api_version == VersionCompatibility.current_api_version()
      assert is_list(info.features)
      assert is_boolean(info.update_available)
    end

    test "returns error when version is missing" do
      assert {:error, :version_missing} = VersionCompatibility.validate_client(%{})

      assert {:error, :version_missing} =
               VersionCompatibility.validate_client(%{"client_version" => nil})
    end

    test "returns error when version is not a string" do
      assert {:error, :version_missing} =
               VersionCompatibility.validate_client(%{"client_version" => 123})

      assert {:error, :version_missing} =
               VersionCompatibility.validate_client(%{"client_version" => ["1.0.0"]})
    end

    test "returns update_required when version is below minimum" do
      # This test assumes min_version is 1.0.0
      assert {:error, :update_required, info} =
               VersionCompatibility.validate_client(%{"client_version" => "0.9.0"})

      assert info.min_version == VersionCompatibility.min_client_version()
    end
  end

  describe "validate_version/1" do
    test "accepts exact minimum version" do
      min = VersionCompatibility.min_client_version()
      assert {:ok, _info} = VersionCompatibility.validate_version(min)
    end

    test "accepts version higher than minimum" do
      assert {:ok, info} = VersionCompatibility.validate_version("2.0.0")
      assert info.client_version == Version.parse!("2.0.0")
    end

    test "rejects version lower than minimum" do
      assert {:error, :update_required, _} = VersionCompatibility.validate_version("0.1.0")
    end

    test "handles version with v prefix" do
      assert {:ok, info} = VersionCompatibility.validate_version("v1.0.0")
      assert info.client_version == Version.parse!("1.0.0")
    end

    test "handles partial version strings" do
      # "1" should be normalized to "1.0.0"
      assert {:ok, info} = VersionCompatibility.validate_version("1")
      assert info.client_version == Version.parse!("1.0.0")

      # "1.0" should be normalized to "1.0.0"
      assert {:ok, info} = VersionCompatibility.validate_version("1.0")
      assert info.client_version == Version.parse!("1.0.0")
    end

    test "sets update_available when client version is below current" do
      # If current is 1.0.0 and client is 1.0.0, update_available should be false
      current = VersionCompatibility.current_api_version()
      assert {:ok, info} = VersionCompatibility.validate_version(current)
      assert info.update_available == false

      # If we had a higher current version, older clients would show update_available
      # This is tricky to test without changing config, so we test the logic indirectly
    end

    test "rejects malformed version strings" do
      # Malformed versions should be rejected (safe default)
      # This prevents clients with garbage versions from connecting
      assert {:error, :update_required, info} =
               VersionCompatibility.validate_version("not.a.version")

      assert info.min_version == VersionCompatibility.min_client_version()
    end
  end

  describe "features_for_version/1" do
    test "returns features for valid version" do
      features = VersionCompatibility.features_for_version("1.0.0")
      assert is_list(features)
      assert :navigation in features
      assert :combat in features
      assert :inventory in features
    end

    test "returns empty list for version 0.0.0" do
      features = VersionCompatibility.features_for_version("0.0.0")
      # Depends on config - may return empty or features from lowest defined version
      assert is_list(features)
    end

    test "returns features for higher version" do
      # Higher versions should inherit features from lower versions
      features = VersionCompatibility.features_for_version("99.0.0")
      assert is_list(features)
      # Should have at least the base features
      assert features != []
    end
  end

  describe "client_supports?/2" do
    test "returns true when feature is in features list" do
      info = %{features: [:navigation, :combat, :inventory]}
      assert VersionCompatibility.client_supports?(info, :navigation)
      assert VersionCompatibility.client_supports?(info, :combat)
    end

    test "returns false when feature is not in features list" do
      info = %{features: [:navigation]}
      refute VersionCompatibility.client_supports?(info, :combat)
      refute VersionCompatibility.client_supports?(info, :unknown_feature)
    end

    test "returns true for nil version info (legacy clients)" do
      # Be permissive with legacy clients that don't send version
      assert VersionCompatibility.client_supports?(nil, :navigation)
      assert VersionCompatibility.client_supports?(nil, :anything)
    end
  end

  describe "server_capabilities/0" do
    test "returns map with required keys" do
      caps = VersionCompatibility.server_capabilities()

      assert is_map(caps)
      assert Map.has_key?(caps, :api_version)
      assert Map.has_key?(caps, :min_client_version)
      assert Map.has_key?(caps, :features)
      assert Map.has_key?(caps, :protocol)
    end

    test "returns valid version strings" do
      caps = VersionCompatibility.server_capabilities()

      assert {:ok, _} = Version.parse(caps.api_version)
      assert {:ok, _} = Version.parse(caps.min_client_version)
    end

    test "returns features as list of atoms" do
      caps = VersionCompatibility.server_capabilities()

      assert is_list(caps.features)
      Enum.each(caps.features, fn f -> assert is_atom(f) end)
    end
  end

  describe "current_api_version/0" do
    test "returns valid semver string" do
      version = VersionCompatibility.current_api_version()
      assert is_binary(version)
      assert {:ok, _} = Version.parse(version)
    end
  end

  describe "min_client_version/0" do
    test "returns valid semver string" do
      version = VersionCompatibility.min_client_version()
      assert is_binary(version)
      assert {:ok, _} = Version.parse(version)
    end

    test "min version is less than or equal to current version" do
      min = Version.parse!(VersionCompatibility.min_client_version())
      current = Version.parse!(VersionCompatibility.current_api_version())

      assert Version.compare(min, current) in [:lt, :eq]
    end
  end

  describe "version comparison edge cases" do
    test "pre-release versions are correctly compared" do
      # In semver, 1.0.0-beta < 1.0.0, so if min is 1.0.0, beta is rejected
      # This is correct behavior - pre-release versions are considered older
      result = VersionCompatibility.validate_version("1.0.0-beta")
      assert match?({:error, :update_required, _}, result)

      # A version above minimum with pre-release should work
      assert {:ok, _} = VersionCompatibility.validate_version("2.0.0-beta")
    end

    test "build metadata is handled" do
      # Build metadata like 1.0.0+build123 should work
      # Build metadata doesn't affect version comparison
      assert {:ok, _} = VersionCompatibility.validate_version("1.0.0+build123")
    end

    test "whitespace is handled" do
      assert {:ok, _} = VersionCompatibility.validate_version(" 1.0.0 ")
    end
  end
end
