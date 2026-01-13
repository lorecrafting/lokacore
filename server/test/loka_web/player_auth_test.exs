defmodule LokaWeb.PlayerAuthTest do
  use LokaWeb.ConnCase

  alias Loka.Accounts
  alias Loka.Accounts.Scope
  alias LokaWeb.PlayerAuth

  import Loka.AccountsFixtures

  @remember_me_cookie "_loka_web_player_remember_me"
  @remember_me_cookie_max_age 60 * 60 * 24 * 14

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, LokaWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{player: %{player_fixture() | authenticated_at: DateTime.utc_now(:second)}, conn: conn}
  end

  describe "log_in_player/3" do
    test "stores the player token in the session", %{conn: conn, player: player} do
      conn = PlayerAuth.log_in_player(conn, player)
      assert token = get_session(conn, :player_token)
      assert redirected_to(conn) == ~p"/players/log-in"
      assert Accounts.get_player_by_session_token(token)
    end

    test "clears everything previously stored in the session", %{conn: conn, player: player} do
      conn = conn |> put_session(:to_be_removed, "value") |> PlayerAuth.log_in_player(player)
      refute get_session(conn, :to_be_removed)
    end

    test "keeps session when re-authenticating", %{conn: conn, player: player} do
      conn =
        conn
        |> assign(:current_scope, Scope.for_player(player))
        |> put_session(:to_be_removed, "value")
        |> PlayerAuth.log_in_player(player)

      assert get_session(conn, :to_be_removed)
    end

    test "clears session when player does not match when re-authenticating", %{
      conn: conn,
      player: player
    } do
      other_player = player_fixture()

      conn =
        conn
        |> assign(:current_scope, Scope.for_player(other_player))
        |> put_session(:to_be_removed, "value")
        |> PlayerAuth.log_in_player(player)

      refute get_session(conn, :to_be_removed)
    end

    test "redirects to the configured path", %{conn: conn, player: player} do
      conn = conn |> put_session(:player_return_to, "/hello") |> PlayerAuth.log_in_player(player)
      assert redirected_to(conn) == "/hello"
    end

    test "writes a cookie if remember_me is configured", %{conn: conn, player: player} do
      conn =
        conn |> fetch_cookies() |> PlayerAuth.log_in_player(player, %{"remember_me" => "true"})

      assert get_session(conn, :player_token) == conn.cookies[@remember_me_cookie]
      assert get_session(conn, :player_remember_me) == true

      assert %{value: signed_token, max_age: max_age} = conn.resp_cookies[@remember_me_cookie]
      assert signed_token != get_session(conn, :player_token)
      assert max_age == @remember_me_cookie_max_age
    end

    test "writes a cookie if remember_me was set in previous session", %{
      conn: conn,
      player: player
    } do
      conn =
        conn |> fetch_cookies() |> PlayerAuth.log_in_player(player, %{"remember_me" => "true"})

      assert get_session(conn, :player_token) == conn.cookies[@remember_me_cookie]
      assert get_session(conn, :player_remember_me) == true

      conn =
        conn
        |> recycle()
        |> Map.replace!(:secret_key_base, LokaWeb.Endpoint.config(:secret_key_base))
        |> fetch_cookies()
        |> init_test_session(%{player_remember_me: true})

      # the conn is already logged in and has the remember_me cookie set,
      # now we log in again and even without explicitly setting remember_me,
      # the cookie should be set again
      conn = conn |> PlayerAuth.log_in_player(player, %{})
      assert %{value: signed_token, max_age: max_age} = conn.resp_cookies[@remember_me_cookie]
      assert signed_token != get_session(conn, :player_token)
      assert max_age == @remember_me_cookie_max_age
      assert get_session(conn, :player_remember_me) == true
    end
  end

  describe "logout_player/1" do
    test "erases session and cookies", %{conn: conn, player: player} do
      player_token = Accounts.generate_player_session_token(player)

      conn =
        conn
        |> put_session(:player_token, player_token)
        |> put_req_cookie(@remember_me_cookie, player_token)
        |> fetch_cookies()
        |> PlayerAuth.log_out_player()

      refute get_session(conn, :player_token)
      refute conn.cookies[@remember_me_cookie]
      assert %{max_age: 0} = conn.resp_cookies[@remember_me_cookie]
      assert redirected_to(conn) == ~p"/"
      refute Accounts.get_player_by_session_token(player_token)
    end

    test "works even if player is already logged out", %{conn: conn} do
      conn = conn |> fetch_cookies() |> PlayerAuth.log_out_player()
      refute get_session(conn, :player_token)
      assert %{max_age: 0} = conn.resp_cookies[@remember_me_cookie]
      assert redirected_to(conn) == ~p"/"
    end
  end

  describe "fetch_current_scope_for_player/2" do
    test "authenticates player from session", %{conn: conn, player: player} do
      player_token = Accounts.generate_player_session_token(player)

      conn =
        conn
        |> put_session(:player_token, player_token)
        |> PlayerAuth.fetch_current_scope_for_player([])

      assert conn.assigns.current_scope.player.id == player.id
      assert conn.assigns.current_scope.player.authenticated_at == player.authenticated_at
      assert get_session(conn, :player_token) == player_token
    end

    test "authenticates player from cookies", %{conn: conn, player: player} do
      logged_in_conn =
        conn |> fetch_cookies() |> PlayerAuth.log_in_player(player, %{"remember_me" => "true"})

      player_token = logged_in_conn.cookies[@remember_me_cookie]
      %{value: signed_token} = logged_in_conn.resp_cookies[@remember_me_cookie]

      conn =
        conn
        |> put_req_cookie(@remember_me_cookie, signed_token)
        |> PlayerAuth.fetch_current_scope_for_player([])

      assert conn.assigns.current_scope.player.id == player.id
      assert conn.assigns.current_scope.player.authenticated_at == player.authenticated_at
      assert get_session(conn, :player_token) == player_token
      assert get_session(conn, :player_remember_me)
    end

    test "does not authenticate if data is missing", %{conn: conn, player: player} do
      _ = Accounts.generate_player_session_token(player)
      conn = PlayerAuth.fetch_current_scope_for_player(conn, [])
      refute get_session(conn, :player_token)
      refute conn.assigns.current_scope
    end

    test "reissues a new token after a few days and refreshes cookie", %{
      conn: conn,
      player: player
    } do
      logged_in_conn =
        conn |> fetch_cookies() |> PlayerAuth.log_in_player(player, %{"remember_me" => "true"})

      token = logged_in_conn.cookies[@remember_me_cookie]
      %{value: signed_token} = logged_in_conn.resp_cookies[@remember_me_cookie]

      offset_player_token(token, -10, :day)
      {player, _} = Accounts.get_player_by_session_token(token)

      conn =
        conn
        |> put_session(:player_token, token)
        |> put_session(:player_remember_me, true)
        |> put_req_cookie(@remember_me_cookie, signed_token)
        |> PlayerAuth.fetch_current_scope_for_player([])

      assert conn.assigns.current_scope.player.id == player.id
      assert conn.assigns.current_scope.player.authenticated_at == player.authenticated_at
      assert new_token = get_session(conn, :player_token)
      assert new_token != token
      assert %{value: new_signed_token, max_age: max_age} = conn.resp_cookies[@remember_me_cookie]
      assert new_signed_token != signed_token
      assert max_age == @remember_me_cookie_max_age
    end
  end

  describe "require_sudo_mode/2" do
    test "allows players that have authenticated in the last 10 minutes", %{
      conn: conn,
      player: player
    } do
      conn =
        conn
        |> fetch_flash()
        |> assign(:current_scope, Scope.for_player(player))
        |> PlayerAuth.require_sudo_mode([])

      refute conn.halted
      refute conn.status
    end

    test "redirects when authentication is too old", %{conn: conn, player: player} do
      eleven_minutes_ago = DateTime.utc_now(:second) |> DateTime.add(-11, :minute)
      player = %{player | authenticated_at: eleven_minutes_ago}
      player_token = Accounts.generate_player_session_token(player)
      {player, token_inserted_at} = Accounts.get_player_by_session_token(player_token)
      assert DateTime.compare(token_inserted_at, player.authenticated_at) == :gt

      conn =
        conn
        |> fetch_flash()
        |> assign(:current_scope, Scope.for_player(player))
        |> PlayerAuth.require_sudo_mode([])

      assert redirected_to(conn) == ~p"/players/log-in"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "You must re-authenticate to access this page."
    end
  end

  describe "redirect_if_player_is_authenticated/2" do
    setup %{conn: conn} do
      %{conn: PlayerAuth.fetch_current_scope_for_player(conn, [])}
    end

    test "redirects if player is authenticated", %{conn: conn, player: player} do
      conn =
        conn
        |> assign(:current_scope, Scope.for_player(player))
        |> PlayerAuth.redirect_if_player_is_authenticated([])

      assert conn.halted
      assert redirected_to(conn) == ~p"/players/log-in"
    end

    test "does not redirect if player is not authenticated", %{conn: conn} do
      conn = PlayerAuth.redirect_if_player_is_authenticated(conn, [])
      refute conn.halted
      refute conn.status
    end
  end

  describe "require_authenticated_player/2" do
    setup %{conn: conn} do
      %{conn: PlayerAuth.fetch_current_scope_for_player(conn, [])}
    end

    test "redirects if player is not authenticated", %{conn: conn} do
      conn = conn |> fetch_flash() |> PlayerAuth.require_authenticated_player([])
      assert conn.halted

      assert redirected_to(conn) == ~p"/players/log-in"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "You must log in to access this page."
    end

    test "stores the path to redirect to on GET", %{conn: conn} do
      halted_conn =
        %{conn | path_info: ["foo"], query_string: ""}
        |> fetch_flash()
        |> PlayerAuth.require_authenticated_player([])

      assert halted_conn.halted
      assert get_session(halted_conn, :player_return_to) == "/foo"

      halted_conn =
        %{conn | path_info: ["foo"], query_string: "bar=baz"}
        |> fetch_flash()
        |> PlayerAuth.require_authenticated_player([])

      assert halted_conn.halted
      assert get_session(halted_conn, :player_return_to) == "/foo?bar=baz"

      halted_conn =
        %{conn | path_info: ["foo"], query_string: "bar", method: "POST"}
        |> fetch_flash()
        |> PlayerAuth.require_authenticated_player([])

      assert halted_conn.halted
      refute get_session(halted_conn, :player_return_to)
    end

    test "does not redirect if player is authenticated", %{conn: conn, player: player} do
      conn =
        conn
        |> assign(:current_scope, Scope.for_player(player))
        |> PlayerAuth.require_authenticated_player([])

      refute conn.halted
      refute conn.status
    end
  end
end
