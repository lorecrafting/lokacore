defmodule ExmudWeb.Plugs.RequireAdmin do
  @moduledoc """
  Plug that ensures the current player has admin privileges.

  Must be used after `:require_authenticated_player` in the pipeline.

  ## Usage

      pipeline :require_admin do
        plug ExmudWeb.Plugs.RequireAdmin
      end

      scope "/admin", ExmudWeb do
        pipe_through [:browser, :require_authenticated_player, :require_admin]

        live "/", AdminLive, :index
      end
  """

  import Plug.Conn
  import Phoenix.Controller

  def init(opts), do: opts

  def call(conn, _opts) do
    if admin?(conn.assigns[:current_scope]) do
      conn
    else
      conn
      |> put_flash(:error, "You must be an admin to access this page.")
      |> redirect(to: "/")
      |> halt()
    end
  end

  defp admin?(%{player: %{is_admin: true}}), do: true
  defp admin?(_), do: false
end
