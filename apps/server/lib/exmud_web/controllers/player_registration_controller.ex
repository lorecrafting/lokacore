defmodule ExmudWeb.PlayerRegistrationController do
  use ExmudWeb, :controller

  alias Exmud.Accounts
  alias Exmud.Accounts.Player

  def new(conn, _params) do
    changeset = Accounts.change_player_email(%Player{})
    render(conn, :new, changeset: changeset)
  end

  def create(conn, %{"player" => player_params}) do
    case Accounts.register_player(player_params) do
      {:ok, player} ->
        {:ok, _} =
          Accounts.deliver_login_instructions(
            player,
            &url(~p"/players/log-in/#{&1}")
          )

        conn
        |> put_flash(
          :info,
          "An email was sent to #{player.email}, please access it to confirm your account."
        )
        |> redirect(to: ~p"/players/log-in")

      {:error, %Ecto.Changeset{} = changeset} ->
        render(conn, :new, changeset: changeset)
    end
  end
end
