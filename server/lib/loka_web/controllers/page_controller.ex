defmodule LokaWeb.PageController do
  use LokaWeb, :controller

  def home(conn, _params) do
    # Main client is mobile - redirect web visitors to login
    redirect(conn, to: ~p"/players/log-in")
  end
end
