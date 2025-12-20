defmodule ExmudWeb.PageController do
  use ExmudWeb, :controller

  def home(conn, _params) do
    redirect(conn, to: ~p"/game")
  end
end
