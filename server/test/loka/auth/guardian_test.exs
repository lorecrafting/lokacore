defmodule Loka.Auth.GuardianTest do
  use Loka.DataCase, async: true

  alias Loka.Auth.Guardian
  alias Loka.Accounts

  describe "subject_for_token/2" do
    test "returns player ID as string" do
      player = player_fixture()

      assert {:ok, subject} = Guardian.subject_for_token(player, %{})
      assert subject == to_string(player.id)
    end

    test "returns error for invalid resource" do
      assert {:error, :invalid_resource} = Guardian.subject_for_token(%{no_id: true}, %{})
      assert {:error, :invalid_resource} = Guardian.subject_for_token(nil, %{})
      assert {:error, :invalid_resource} = Guardian.subject_for_token("string", %{})
    end
  end

  describe "resource_from_claims/1" do
    test "returns player for valid claims" do
      player = player_fixture()
      claims = %{"sub" => to_string(player.id)}

      assert {:ok, found_player} = Guardian.resource_from_claims(claims)
      assert found_player.id == player.id
      assert found_player.email == player.email
    end

    test "returns error for non-existent player" do
      claims = %{"sub" => "99999"}

      assert {:error, :resource_not_found} = Guardian.resource_from_claims(claims)
    end

    test "returns error for invalid claims" do
      assert {:error, :invalid_claims} = Guardian.resource_from_claims(%{})
      assert {:error, :invalid_claims} = Guardian.resource_from_claims(%{"other" => "value"})
      assert {:error, :invalid_claims} = Guardian.resource_from_claims(nil)
    end
  end

  describe "encode_and_verify/1 integration" do
    test "can encode and decode a token for a player" do
      player = player_fixture()

      # Encode a token
      {:ok, token, _claims} = Guardian.encode_and_sign(player, %{}, token_type: "access")
      assert is_binary(token)

      # Decode and verify the token
      {:ok, claims} = Guardian.decode_and_verify(token)
      assert claims["sub"] == to_string(player.id)
      assert claims["typ"] == "access"

      # Get the resource from claims
      {:ok, found_player} = Guardian.resource_from_claims(claims)
      assert found_player.id == player.id
    end

    test "refresh token has correct type" do
      player = player_fixture()

      {:ok, token, _claims} = Guardian.encode_and_sign(player, %{}, token_type: "refresh")

      {:ok, claims} = Guardian.decode_and_verify(token)
      assert claims["typ"] == "refresh"
    end
  end

  # Helper to create a player fixture
  defp player_fixture(attrs \\ %{}) do
    unique_email = "test_#{System.unique_integer([:positive])}@example.com"

    {:ok, player} =
      attrs
      |> Enum.into(%{email: unique_email})
      |> Accounts.register_player()

    player
  end
end
