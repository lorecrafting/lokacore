defmodule ExmudWeb.PageControllerTest do
  use ExmudWeb.ConnCase

  test "GET / redirects to /game", %{conn: conn} do
    conn = get(conn, ~p"/")
    assert redirected_to(conn) == ~p"/game"
  end
end
