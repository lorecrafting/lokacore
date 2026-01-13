defmodule LokaWeb.PageControllerTest do
  use LokaWeb.ConnCase

  test "GET / redirects to login", %{conn: conn} do
    conn = get(conn, ~p"/")
    assert redirected_to(conn) == ~p"/players/log-in"
  end
end
