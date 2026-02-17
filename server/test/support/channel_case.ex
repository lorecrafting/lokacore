defmodule Loka.ChannelCase do
  @moduledoc """
  Test case for Phoenix channel tests.

  Provides support for Phoenix.ChannelTest and database sandboxing.
  This is required for ChannelBot testing which needs to use the
  Phoenix.ChannelTest functions (connect, subscribe_and_join, push, etc).

  ## Shared Helpers

  All modules that `use Loka.ChannelCase` get these helpers:

  - `create_test_player/1` — Creates a confirmed test player
  - `connect_player/1` — Connects player to GameChannel via JWT
  - `send_cmd/2` — Pushes a text command to the channel
  - `receive_output/0` — Receives next output push, returns text
  - `assert_output/1` — Asserts next output contains expected string

  ## Usage

      use Loka.ChannelCase

      test "my channel test" do
        player = create_test_player()
        {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)
        # ...
      end

      test "builder command test" do
        admin = create_test_player(name: "Admin")
        {:ok, socket} = connect_player(admin)
        send_cmd(socket, "create room my_room My Room")
        assert_output("created")
      end
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      # Import channel test helpers
      import Phoenix.ChannelTest

      # The default endpoint for testing
      @endpoint LokaWeb.Endpoint

      # Import common test helpers
      import Loka.ChannelCase

      # Import fixtures
      alias Loka.AccountsFixtures

      @doc """
      Connects a player to the game channel via JWT auth.

      Signs a Guardian token, connects to UserSocket, joins "game:lobby",
      and drains the initial game_state push. Returns `{:ok, socket}`.
      """
      def connect_player(player) do
        {:ok, token, _claims} = Loka.Auth.Guardian.encode_and_sign(player, %{})
        {:ok, socket} = connect(LokaWeb.UserSocket, %{"token" => token})

        {:ok, _reply, socket} =
          subscribe_and_join(socket, LokaWeb.GameChannel, "game:lobby", %{})

        assert_push "game_state", _state, 2000
        {:ok, socket}
      end

      @doc """
      Pushes a text command to the game channel and asserts the reply is :ok.
      """
      def send_cmd(socket, input) do
        ref = push(socket, "command", %{"input" => input})
        assert_reply ref, :ok, %{}, 2000
      end

      @doc """
      Receives the next "output" push from the channel. Returns the text string.
      """
      def receive_output do
        assert_push "output", %{text: text}, 2000
        text
      end

      @doc """
      Asserts the next output push contains `expected`. Returns the full text.
      """
      def assert_output(expected) do
        text = receive_output()
        assert text =~ expected, "Expected output to contain #{inspect(expected)}, got: #{text}"
        text
      end
    end
  end

  setup tags do
    Loka.DataCase.setup_sandbox(tags)
    :ok
  end

  @doc """
  Creates a test player for bot testing.

  The player is created with a unique email and confirmed.
  Returns the player struct.

  ## Options

  - `:email` - Custom email (default: auto-generated)
  - `:name` - Custom name (default: auto-generated)

  ## Example

      player = create_test_player()
      player = create_test_player(name: "BotOne")
  """
  def create_test_player(opts \\ []) do
    # Generate unique email
    unique_id = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    email = Keyword.get(opts, :email, "bot_#{unique_id}@test.local")
    name = Keyword.get(opts, :name, "TestBot#{unique_id}")

    # Create player (email_changeset only handles email)
    {:ok, player} =
      Loka.Accounts.register_player(%{
        email: email
      })

    # Confirm the player and set name
    # Truncate to second precision for Ecto :utc_datetime type
    confirmed_at = DateTime.utc_now() |> DateTime.truncate(:second)

    player
    |> Ecto.Changeset.change(%{confirmed_at: confirmed_at, name: name})
    |> Loka.Repo.update!()
  end
end
