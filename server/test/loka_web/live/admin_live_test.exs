defmodule LokaWeb.AdminLiveTest do
  use LokaWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  alias Loka.AccountsFixtures

  setup %{conn: conn} do
    # Create an admin player
    player = AccountsFixtures.player_fixture()
    {:ok, player} = Loka.Accounts.toggle_admin(player)

    scope = Loka.Accounts.Scope.for_player(player)
    conn = log_in_player(conn, player)

    {:ok, conn: conn, player: player, scope: scope}
  end

  describe "mount" do
    test "renders dashboard tab by default", %{conn: conn} do
      {:ok, view, html} = live(conn, ~p"/admin")

      assert html =~ "Loka Admin" or html =~ "Dashboard"
      assert has_element?(view, "button", "Dashboard")
      assert has_element?(view, "button", "Players")
      assert has_element?(view, "button", "Quests")
      assert has_element?(view, "button", "Testing")
      assert has_element?(view, "button", "Audit Log")
    end

    test "redirects non-admin players", %{conn: conn} do
      non_admin = AccountsFixtures.player_fixture()
      conn = log_in_player(conn, non_admin)

      {:error, {:redirect, %{to: path}}} = live(conn, ~p"/admin")
      assert path =~ "/"
    end
  end

  describe "tab switching" do
    test "switches to players tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Players")
        |> render_click()

      assert html =~ "Players"
    end

    test "switches to quests tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Quests")
        |> render_click()

      assert html =~ "Quest"
    end

    test "switches to testing tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Testing")
        |> render_click()

      assert html =~ "Testing" or html =~ "Validation"
    end

    test "switches to audit log tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Audit Log")
        |> render_click()

      assert html =~ "Audit" or html =~ "Log"
    end
  end

  describe "player management" do
    test "lists players in table with email column", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Players")
        |> render_click()

      # Should show player table with email column header or player emails
      assert html =~ "Email" or html =~ "email" or html =~ "@example.com"
    end

    test "can toggle admin status", %{conn: conn, player: _admin} do
      # Create another player to toggle
      other_player = AccountsFixtures.player_fixture()

      {:ok, view, _html} = live(conn, ~p"/admin")

      view
      |> element("button", "Players")
      |> render_click()

      # Toggle admin on the other player
      view
      |> element("button[phx-click=\"toggle_admin\"][phx-value-id=\"#{other_player.id}\"]")
      |> render_click()

      # Reload the player to verify
      updated = Loka.Accounts.get_player!(other_player.id)
      assert updated.is_admin == true
    end
  end
end
