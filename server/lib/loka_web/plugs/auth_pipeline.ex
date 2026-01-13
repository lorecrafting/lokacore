defmodule LokaWeb.Plugs.AuthPipeline do
  @moduledoc """
  Guardian authentication pipeline for API routes.
  """
  use Guardian.Plug.Pipeline,
    otp_app: :loka,
    module: Loka.Auth.Guardian,
    error_handler: LokaWeb.Plugs.AuthErrorHandler

  plug Guardian.Plug.VerifyHeader, scheme: "Bearer"
  plug Guardian.Plug.EnsureAuthenticated
  plug Guardian.Plug.LoadResource
end

defmodule LokaWeb.Plugs.AuthErrorHandler do
  @moduledoc """
  Error handler for Guardian authentication failures.
  """
  import Plug.Conn
  import Phoenix.Controller

  @behaviour Guardian.Plug.ErrorHandler

  @impl Guardian.Plug.ErrorHandler
  def auth_error(conn, {type, _reason}, _opts) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: to_string(type)})
    |> halt()
  end
end
