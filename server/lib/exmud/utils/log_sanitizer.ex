defmodule Exmud.Utils.LogSanitizer do
  @moduledoc """
  Utility functions for sanitizing sensitive data in logs.

  This module provides functions to mask or redact sensitive information
  like email addresses, tokens, and other PII before logging.

  ## Usage

      alias Exmud.Utils.LogSanitizer

      Logger.info("Login attempt for #{LogSanitizer.mask_email(email)}")
      Logger.debug("Token: #{LogSanitizer.redact(token)}")

  ## Security

  Never log:
  - Full email addresses
  - Passwords or password hashes
  - Authentication tokens
  - Session identifiers
  - Credit card numbers
  - Personal identification numbers
  """

  @doc """
  Masks an email address for safe logging.

  Shows first character of local part, domain TLD hint.

  ## Examples

      iex> LogSanitizer.mask_email("user@example.com")
      "u***@***.com"

      iex> LogSanitizer.mask_email("john.doe@company.org")
      "j***@***.org"

      iex> LogSanitizer.mask_email(nil)
      "[no-email]"

  """
  @spec mask_email(String.t() | nil) :: String.t()
  def mask_email(nil), do: "[no-email]"
  def mask_email(""), do: "[empty-email]"

  def mask_email(email) when is_binary(email) do
    case String.split(email, "@") do
      [local, domain] ->
        masked_local = mask_string(local, 1)
        masked_domain = mask_domain(domain)
        "#{masked_local}@#{masked_domain}"

      _ ->
        "[invalid-email]"
    end
  end

  @doc """
  Completely redacts a value, showing only length hint.

  Use for tokens, passwords, and other fully sensitive data.

  ## Examples

      iex> LogSanitizer.redact("secret_token_12345")
      "[REDACTED:18]"

      iex> LogSanitizer.redact(nil)
      "[REDACTED]"

  """
  @spec redact(String.t() | nil) :: String.t()
  def redact(nil), do: "[REDACTED]"
  def redact(""), do: "[REDACTED:0]"

  def redact(value) when is_binary(value) do
    "[REDACTED:#{String.length(value)}]"
  end

  @doc """
  Masks a string, showing only the first N characters.

  ## Examples

      iex> LogSanitizer.mask_string("username", 2)
      "us***"

      iex> LogSanitizer.mask_string("ab", 3)
      "ab"

  """
  @spec mask_string(String.t(), non_neg_integer()) :: String.t()
  def mask_string(string, show_chars) when is_binary(string) and is_integer(show_chars) do
    length = String.length(string)

    if length <= show_chars do
      string
    else
      String.slice(string, 0, show_chars) <> "***"
    end
  end

  @doc """
  Creates a short hash identifier for correlation without exposing the value.

  Useful for tracking requests across logs without exposing sensitive data.

  ## Examples

      iex> LogSanitizer.hash_id("user@example.com")
      "a1b2c3"  # First 6 chars of SHA256 hash

  """
  @spec hash_id(String.t()) :: String.t()
  def hash_id(value) when is_binary(value) do
    :crypto.hash(:sha256, value)
    |> Base.encode16(case: :lower)
    |> String.slice(0, 6)
  end

  # Masks a domain, preserving only the TLD
  defp mask_domain(domain) do
    parts = String.split(domain, ".")

    case parts do
      [single] ->
        mask_string(single, 1)

      parts when length(parts) >= 2 ->
        tld = List.last(parts)
        "***." <> tld

      _ ->
        "***"
    end
  end
end
