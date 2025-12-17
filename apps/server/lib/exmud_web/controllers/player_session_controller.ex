defmodule ExmudWeb.PlayerSessionController do
  use ExmudWeb, :controller

  alias Exmud.Accounts
  alias ExmudWeb.PlayerAuth

  def new(conn, _params) do
    email = get_in(conn.assigns, [:current_scope, Access.key(:player), Access.key(:email)])
    form = Phoenix.Component.to_form(%{"email" => email}, as: "player")

    render(conn, :new, form: form)
  end

  # magic link login
  def create(conn, %{"player" => %{"token" => token} = player_params} = params) do
    info =
      case params do
        %{"_action" => "confirmed"} -> "Player confirmed successfully."
        _ -> "Welcome back!"
      end

    case Accounts.login_player_by_magic_link(token) do
      {:ok, {player, _expired_tokens}} ->
        conn
        |> put_flash(:info, info)
        |> PlayerAuth.log_in_player(player, player_params)

      {:error, :not_found} ->
        conn
        |> put_flash(:error, "The link is invalid or it has expired.")
        |> render(:new, form: Phoenix.Component.to_form(%{}, as: "player"))
    end
  end

  # email + password login
  def create(conn, %{"player" => %{"email" => email, "password" => password} = player_params}) do
    if player = Accounts.get_player_by_email_and_password(email, password) do
      conn
      |> put_flash(:info, "Welcome back!")
      |> PlayerAuth.log_in_player(player, player_params)
    else
      form = Phoenix.Component.to_form(player_params, as: "player")

      # In order to prevent user enumeration attacks, don't disclose whether the email is registered.
      conn
      |> put_flash(:error, "Invalid email or password")
      |> render(:new, form: form)
    end
  end

  # magic link request
  def create(conn, %{"player" => %{"email" => email}}) do
    require Logger

    if player = Accounts.get_player_by_email(email) do
      Logger.warning("[PlayerSession] Player found for #{email}, sending login instructions")

      Accounts.deliver_login_instructions(
        player,
        &url(~p"/players/log-in/#{&1}")
      )
    else
      Logger.warning("[PlayerSession] No player found for #{email}, skipping email")
    end

    info =
      "If your email is in our system, you will receive instructions for logging in shortly."

    conn
    |> put_flash(:info, info)
    |> redirect(to: ~p"/players/log-in")
  end

  def confirm(conn, %{"token" => token}) do
    if player = Accounts.get_player_by_magic_link_token(token) do
      form = Phoenix.Component.to_form(%{"token" => token}, as: "player")

      conn
      |> assign(:player, player)
      |> assign(:form, form)
      |> render(:confirm)
    else
      conn
      |> put_flash(:error, "Magic link is invalid or it has expired.")
      |> redirect(to: ~p"/players/log-in")
    end
  end

  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Logged out successfully.")
    |> PlayerAuth.log_out_player()
  end
end
