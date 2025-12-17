defmodule ExmudWeb.PlayerSettingsController do
  use ExmudWeb, :controller

  alias Exmud.Accounts
  alias ExmudWeb.PlayerAuth

  import ExmudWeb.PlayerAuth, only: [require_sudo_mode: 2]

  plug :require_sudo_mode
  plug :assign_email_and_password_changesets

  def edit(conn, _params) do
    render(conn, :edit)
  end

  def update(conn, %{"action" => "update_email"} = params) do
    %{"player" => player_params} = params
    player = conn.assigns.current_scope.player

    case Accounts.change_player_email(player, player_params) do
      %{valid?: true} = changeset ->
        Accounts.deliver_player_update_email_instructions(
          Ecto.Changeset.apply_action!(changeset, :insert),
          player.email,
          &url(~p"/players/settings/confirm-email/#{&1}")
        )

        conn
        |> put_flash(
          :info,
          "A link to confirm your email change has been sent to the new address."
        )
        |> redirect(to: ~p"/players/settings")

      changeset ->
        render(conn, :edit, email_changeset: %{changeset | action: :insert})
    end
  end

  def update(conn, %{"action" => "update_password"} = params) do
    %{"player" => player_params} = params
    player = conn.assigns.current_scope.player

    case Accounts.update_player_password(player, player_params) do
      {:ok, {player, _}} ->
        conn
        |> put_flash(:info, "Password updated successfully.")
        |> put_session(:player_return_to, ~p"/players/settings")
        |> PlayerAuth.log_in_player(player)

      {:error, changeset} ->
        render(conn, :edit, password_changeset: changeset)
    end
  end

  def confirm_email(conn, %{"token" => token}) do
    case Accounts.update_player_email(conn.assigns.current_scope.player, token) do
      {:ok, _player} ->
        conn
        |> put_flash(:info, "Email changed successfully.")
        |> redirect(to: ~p"/players/settings")

      {:error, _} ->
        conn
        |> put_flash(:error, "Email change link is invalid or it has expired.")
        |> redirect(to: ~p"/players/settings")
    end
  end

  defp assign_email_and_password_changesets(conn, _opts) do
    player = conn.assigns.current_scope.player

    conn
    |> assign(:email_changeset, Accounts.change_player_email(player))
    |> assign(:password_changeset, Accounts.change_player_password(player))
  end
end
