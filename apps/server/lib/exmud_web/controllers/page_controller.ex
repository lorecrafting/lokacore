defmodule ExmudWeb.PageController do
  use ExmudWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
