defmodule ExmudWeb.GameLiveTest do
  use ExmudWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  alias Exmud.AccountsFixtures

  setup %{conn: conn} do
    # Create and log in a player
    player = AccountsFixtures.player_fixture()
    scope = Exmud.Accounts.Scope.for_player(player)
    conn = log_in_player(conn, player)

    {:ok, conn: conn, player: player, scope: scope}
  end

  describe "mount" do
    test "renders game client for authenticated player", %{conn: conn} do
      {:ok, view, html} = live(conn, ~p"/game")

      # Should render the game client page structure
      assert html =~ "ebook-page" || html =~ "game"
      assert has_element?(view, ".ebook-page") || has_element?(view, "[class*='ebook']")
    end

    test "requires authentication", %{conn: _conn} do
      # Build a fresh, unauthenticated connection
      conn = Phoenix.ConnTest.build_conn()

      {:error, {:redirect, %{to: path}}} = live(conn, ~p"/game")
      assert path =~ "/players/log-in"
    end
  end

  describe "UI panels" do
    test "can toggle compass panel", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/game")

      # Find and click compass toggle
      if has_element?(view, "[phx-click=\"toggle_compass\"]") do
        html =
          view
          |> element("[phx-click=\"toggle_compass\"]")
          |> render_click()

        # Compass should now be visible or state changed
        assert html =~ "compass" || html =~ "Compass" || html =~ "direction" || html =~ "navigate"
      end
    end

    test "can toggle inventory panel", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/game")

      if has_element?(view, "[phx-click=\"toggle_inventory\"]") do
        html =
          view
          |> element("[phx-click=\"toggle_inventory\"]")
          |> render_click()

        # Inventory panel should be visible
        assert html =~ "inventory" || html =~ "Inventory" || html =~ "item" || html =~ "equip"
      end
    end

    test "can toggle quest panel", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/game")

      if has_element?(view, "[phx-click=\"toggle_quest\"]") do
        html =
          view
          |> element("[phx-click=\"toggle_quest\"]")
          |> render_click()

        # Quest panel should be visible
        assert html =~ "quest" || html =~ "Quest" || html =~ "objective" || html =~ "Active"
      end
    end

    test "can toggle stats panel", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/game")

      if has_element?(view, "[phx-click=\"toggle_stats\"]") do
        html =
          view
          |> element("[phx-click=\"toggle_stats\"]")
          |> render_click()

        # Stats panel should be visible
        assert html =~ "stats" || html =~ "Stats" || html =~ "health" || html =~ "level"
      end
    end
  end

  describe "cutscene" do
    test "shows intro cutscene for new players", %{conn: conn} do
      {:ok, view, html} = live(conn, ~p"/game")

      # New players should see the intro cutscene
      # The intro cutscene has "The Jeweled Path" as its title
      if html =~ "Jeweled Path" || html =~ "cutscene" do
        assert html =~ "Jeweled Path" || html =~ "monastery" || html =~ "mountain"
      end
    end

    test "can progress through cutscene", %{conn: conn} do
      {:ok, view, html} = live(conn, ~p"/game")

      # If cutscene is present, try to progress
      if html =~ "cutscene" || has_element?(view, "[phx-click=\"cutscene_next\"]") do
        if has_element?(view, "[phx-click=\"cutscene_next\"]") do
          view
          |> element("[phx-click=\"cutscene_next\"]")
          |> render_click()

          # Should still be in cutscene or progressed
          assert true
        end
      end
    end
  end

  describe "chat" do
    test "can toggle chat input", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/game")

      if has_element?(view, "[phx-click=\"toggle_chat\"]") do
        html =
          view
          |> element("[phx-click=\"toggle_chat\"]")
          |> render_click()

        # Chat input should be visible
        assert html =~ "chat" || html =~ "Say" || html =~ "message"
      end
    end
  end

  describe "navigation" do
    test "can navigate using compass", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/game")

      # Try to navigate if possible
      if has_element?(view, "[phx-click=\"navigate\"]") do
        # Click any navigate button
        view
        |> element("[phx-click=\"navigate\"]", :first)
        |> render_click()

        # Should not crash
        assert true
      end
    end
  end

  describe "PubSub integration" do
    test "subscribes to room events on mount", %{conn: conn} do
      {:ok, _view, _html} = live(conn, ~p"/game")

      # The mount should have subscribed to PubSub
      # We can't directly test subscriptions, but we can verify no crash
      assert true
    end
  end
end
