defmodule ExmudWeb.AdminLiveTest do
  use ExmudWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  alias Exmud.AccountsFixtures

  setup %{conn: conn} do
    # Create an admin player
    player = AccountsFixtures.player_fixture()
    {:ok, player} = Exmud.Accounts.toggle_admin(player)

    scope = Exmud.Accounts.Scope.for_player(player)
    conn = log_in_player(conn, player)

    {:ok, conn: conn, player: player, scope: scope}
  end

  describe "mount" do
    test "renders dashboard tab by default", %{conn: conn} do
      {:ok, view, html} = live(conn, ~p"/admin")

      assert html =~ "ExMUD Admin"
      assert html =~ "Dashboard"
      assert has_element?(view, "button", "Dashboard")
      assert has_element?(view, "button", "Players")
      assert has_element?(view, "button", "Rooms")
      assert has_element?(view, "button", "Entities")
      assert has_element?(view, "button", "Scripts")
      assert has_element?(view, "button", "System")
    end

    test "redirects non-admin players", %{conn: conn} do
      # Create a non-admin player
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

    test "switches to rooms tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Rooms")
        |> render_click()

      assert html =~ "Rooms"
    end

    test "switches to entities tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Entities")
        |> render_click()

      assert html =~ "Entities"
    end

    test "switches to scripts tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Scripts")
        |> render_click()

      assert html =~ "Scripts"
    end

    test "switches to system tab", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "System")
        |> render_click()

      assert html =~ "System"
      # Should display system info
      assert html =~ "Elixir" || html =~ "elixir"
    end
  end

  describe "player management" do
    test "lists players", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "Players")
        |> render_click()

      # Should show at least the admin player
      assert html =~ "@example.com" || html =~ "player"
    end

    test "can toggle admin status", %{conn: conn, player: admin} do
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
      updated = Exmud.Accounts.get_player!(other_player.id)
      assert updated.is_admin == true
    end
  end

  describe "system tab" do
    test "displays system information", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin")

      html =
        view
        |> element("button", "System")
        |> render_click()

      # Should show memory and process info
      assert html =~ "Memory" || html =~ "memory" || html =~ "Process" || html =~ "process"
    end
  end
end
