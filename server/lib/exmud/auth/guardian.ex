defmodule Exmud.Auth.Guardian do
  @moduledoc """
  Guardian implementation for JWT-based authentication.
  Used primarily for mobile client authentication via Phoenix Channels.
  """
  use Guardian, otp_app: :exmud

  alias Exmud.Accounts

  @doc """
  Returns the subject for the token (player ID).
  """
  def subject_for_token(%{id: id}, _claims) do
    {:ok, to_string(id)}
  end

  def subject_for_token(_, _) do
    {:error, :invalid_resource}
  end

  @doc """
  Returns the resource (player) from the token claims.
  """
  def resource_from_claims(%{"sub" => id}) do
    case Accounts.get_player(id) do
      nil -> {:error, :resource_not_found}
      player -> {:ok, player}
    end
  end

  def resource_from_claims(_claims) do
    {:error, :invalid_claims}
  end
end
