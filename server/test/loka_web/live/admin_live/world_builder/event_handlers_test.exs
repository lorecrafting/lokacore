defmodule LokaWeb.AdminLive.WorldBuilder.EventHandlersTest do
  @moduledoc """
  Tests for extracted World Builder event handler utilities.

  These tests verify that the Helpers module correctly processes data.
  Handler integration tests that require a real LiveView socket are
  covered in WorldBuilderLive integration tests.
  """
  use ExUnit.Case, async: true

  alias LokaWeb.AdminLive.WorldBuilder.Helpers

  # =============================================================================
  # Helpers.parse_integer/2 Tests
  # =============================================================================

  describe "Helpers.parse_integer/2" do
    test "parses valid integer string" do
      assert Helpers.parse_integer("42", 0) == 42
    end

    test "parses zero" do
      assert Helpers.parse_integer("0", 5) == 0
    end

    test "returns default for nil" do
      assert Helpers.parse_integer(nil, 10) == 10
    end

    test "returns default for invalid string" do
      assert Helpers.parse_integer("not_a_number", 5) == 5
    end

    test "parses negative numbers" do
      assert Helpers.parse_integer("-10", 0) == -10
    end

    test "parses with trailing non-digits" do
      assert Helpers.parse_integer("42abc", 0) == 42
    end

    test "uses 0 as default when not specified" do
      assert Helpers.parse_integer("invalid") == 0
    end
  end

  # =============================================================================
  # Helpers.slugify/1 Tests
  # =============================================================================

  describe "Helpers.slugify/1" do
    test "converts name to lowercase slug" do
      assert Helpers.slugify("My Cool Room") == "my_cool_room"
    end

    test "replaces special characters with underscores" do
      assert Helpers.slugify("Room #1 (Main)") == "room_1_main"
    end

    test "collapses multiple underscores" do
      assert Helpers.slugify("Room   With   Spaces") == "room_with_spaces"
    end

    test "generates unique key for nil" do
      slug = Helpers.slugify(nil)
      assert String.starts_with?(slug, "entity_")
    end

    test "generates unique key for empty string" do
      slug = Helpers.slugify("")
      assert String.starts_with?(slug, "entity_")
    end

    test "trims leading/trailing underscores" do
      assert Helpers.slugify("_test_room_") == "test_room"
    end

    test "handles all special characters" do
      assert Helpers.slugify("Test@#$%Room!") == "test_room"
    end

    test "preserves numbers" do
      assert Helpers.slugify("Room 123") == "room_123"
    end

    test "handles unicode characters" do
      assert Helpers.slugify("Café Room") == "caf_room"
    end

    test "generates unique keys each time for nil" do
      slug1 = Helpers.slugify(nil)
      slug2 = Helpers.slugify(nil)
      assert slug1 != slug2
    end
  end

  # =============================================================================
  # Helpers.sanitize_error/2 Tests
  # =============================================================================

  describe "Helpers.sanitize_error/2" do
    test "returns specific message for :not_found" do
      assert Helpers.sanitize_error(:not_found, "") == "Resource not found"
    end

    test "returns specific message for :invalid_data" do
      assert Helpers.sanitize_error(:invalid_data, "") == "Invalid data provided"
    end

    test "returns specific message for :invalid_template" do
      assert Helpers.sanitize_error(:invalid_template, "") == "Invalid template"
    end

    test "returns specific message for :permission_denied" do
      assert Helpers.sanitize_error(:permission_denied, "") == "Permission denied"
    end

    test "returns specific message for :api_key_not_configured" do
      assert Helpers.sanitize_error(:api_key_not_configured, "") == "Service not configured"
    end

    test "returns short binary messages as-is" do
      assert Helpers.sanitize_error("Custom error", "") == "Custom error"
    end

    test "returns generic message for long error strings" do
      long_error = String.duplicate("x", 200)
      assert Helpers.sanitize_error(long_error, "") == "Operation failed"
    end

    test "returns generic message for unknown error tuples" do
      assert Helpers.sanitize_error({:unexpected, :error}, "") == "Operation failed"
    end

    test "returns generic message for complex errors" do
      assert Helpers.sanitize_error(%{error: "something"}, "") == "Operation failed"
    end
  end

  # =============================================================================
  # Helpers.log_console/3 Tests
  # Note: log_console uses Phoenix.Component.assign/3 which requires a real
  # LiveView socket. These functions are tested via integration tests.
  # =============================================================================

  # log_console/3 is covered by WorldBuilderLive integration tests since it
  # requires a real Phoenix LiveView socket with change tracking.
end
