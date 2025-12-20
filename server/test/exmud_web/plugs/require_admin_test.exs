defmodule ExmudWeb.Plugs.RequireAdminTest do
  use ExmudWeb.ConnCase

  alias ExmudWeb.Plugs.RequireAdmin
  alias Exmud.Accounts
  alias Exmud.Accounts.Scope

  import Exmud.AccountsFixtures

  describe "call/2" do
    test "allows admin users through", %{conn: conn} do
      player = player_fixture()
      {:ok, player} = Accounts.set_admin(player, true)
      scope = Scope.for_player(player)

      conn =
        conn
        |> assign(:current_scope, scope)
        |> RequireAdmin.call([])

      refute conn.halted
    end

    test "redirects non-admin users", %{conn: conn} do
      player = player_fixture()
      scope = Scope.for_player(player)

      conn =
        conn
        |> Phoenix.ConnTest.init_test_session(%{})
        |> fetch_flash()
        |> assign(:current_scope, scope)
        |> RequireAdmin.call([])

      assert conn.halted
      assert redirected_to(conn) == "/"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "You must be an admin to access this page."
    end

    test "redirects when no current_scope", %{conn: conn} do
      conn =
        conn
        |> Phoenix.ConnTest.init_test_session(%{})
        |> fetch_flash()
        |> assign(:current_scope, nil)
        |> RequireAdmin.call([])

      assert conn.halted
      assert redirected_to(conn) == "/"
    end

    test "redirects when current_scope has no player", %{conn: conn} do
      conn =
        conn
        |> Phoenix.ConnTest.init_test_session(%{})
        |> fetch_flash()
        |> assign(:current_scope, %{player: nil})
        |> RequireAdmin.call([])

      assert conn.halted
      assert redirected_to(conn) == "/"
    end
  end

  describe "init/1" do
    test "returns opts unchanged" do
      opts = [some: :option]
      assert RequireAdmin.init(opts) == opts
    end
  end
end
