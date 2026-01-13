defmodule Loka.ChannelCase do
  @moduledoc """
  Test case for Phoenix channel tests.

  Provides support for Phoenix.ChannelTest and database sandboxing.
  This is required for ChannelBot testing which needs to use the
  Phoenix.ChannelTest functions (connect, subscribe_and_join, push, etc).

  ## Usage

      use Loka.ChannelCase

      test "my channel test" do
        player = create_test_player()
        {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)
        # ...
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
