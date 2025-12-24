defmodule Exmud.Utils.LogSanitizerTest do
  use ExUnit.Case, async: true

  alias Exmud.Utils.LogSanitizer

  describe "mask_email/1" do
    test "masks a normal email address" do
      assert LogSanitizer.mask_email("user@example.com") == "u***@***.com"
    end

    test "masks email with longer local part" do
      assert LogSanitizer.mask_email("john.doe@company.org") == "j***@***.org"
    end

    test "handles nil" do
      assert LogSanitizer.mask_email(nil) == "[no-email]"
    end

    test "handles empty string" do
      assert LogSanitizer.mask_email("") == "[empty-email]"
    end

    test "handles invalid email without @" do
      assert LogSanitizer.mask_email("notanemail") == "[invalid-email]"
    end

    test "handles single character local part" do
      assert LogSanitizer.mask_email("a@test.com") == "a@***.com"
    end

    test "handles subdomain" do
      assert LogSanitizer.mask_email("user@mail.example.co.uk") == "u***@***.uk"
    end
  end

  describe "redact/1" do
    test "redacts a string showing length" do
      assert LogSanitizer.redact("secret_token_12345") == "[REDACTED:18]"
    end

    test "handles nil" do
      assert LogSanitizer.redact(nil) == "[REDACTED]"
    end

    test "handles empty string" do
      assert LogSanitizer.redact("") == "[REDACTED:0]"
    end

    test "handles short strings" do
      assert LogSanitizer.redact("abc") == "[REDACTED:3]"
    end
  end

  describe "mask_string/2" do
    test "masks string showing first N characters" do
      assert LogSanitizer.mask_string("username", 2) == "us***"
    end

    test "returns full string if shorter than show_chars" do
      assert LogSanitizer.mask_string("ab", 3) == "ab"
    end

    test "returns full string if equal to show_chars" do
      assert LogSanitizer.mask_string("abc", 3) == "abc"
    end

    test "handles empty string" do
      assert LogSanitizer.mask_string("", 2) == ""
    end
  end

  describe "hash_id/1" do
    test "returns consistent 6-character hash" do
      hash1 = LogSanitizer.hash_id("user@example.com")
      hash2 = LogSanitizer.hash_id("user@example.com")

      assert hash1 == hash2
      assert String.length(hash1) == 6
      assert Regex.match?(~r/^[a-f0-9]+$/, hash1)
    end

    test "returns different hashes for different inputs" do
      hash1 = LogSanitizer.hash_id("user1@example.com")
      hash2 = LogSanitizer.hash_id("user2@example.com")

      assert hash1 != hash2
    end

    test "works with empty string" do
      hash = LogSanitizer.hash_id("")
      assert String.length(hash) == 6
    end
  end
end
