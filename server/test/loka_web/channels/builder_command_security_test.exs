defmodule LokaWeb.Channels.BuilderCommandSecurityTest do
  @moduledoc """
  Tests that builder commands are properly gated by admin status.

  Non-admin players must receive identical "Unknown command" responses
  for builder commands (zero information leakage about command existence).
  Admin players must be able to execute builder commands.
  """
  use Loka.ChannelCase, async: false

  alias Loka.Auth.Guardian
  alias Loka.Engine.WorldLoader

  @builder_commands [
    "goto monastery_entrance",
    "rooms",
    "where",
    "flags",
    "quests",
    "validate",
    "godmode",
    "info monastery_entrance",
    "find monk",
    "list npcs",
    "setflag test_flag",
    "clearflag test_flag",
    "spawn monastery_guard",
    "purge",
    "reload",
    "settime dawn"
  ]

  setup do
    # Clean up entities
    {_, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)

    # Spawn minimal world
    {:ok, _stats} = WorldLoader.spawn_world()

    # Create admin player
    admin = create_test_player(name: "AdminTester")

    admin =
      admin
      |> Ecto.Changeset.change(%{is_admin: true})
      |> Loka.Repo.update!()

    # Create non-admin player
    regular = create_test_player(name: "RegularTester")

    on_exit(fn ->
      {_, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
    end)

    %{admin: admin, regular: regular}
  end

  describe "non-admin player" do
    test "receives 'Unknown command' for all builder commands", %{regular: player} do
      {:ok, socket} = connect_player(player)

      for cmd <- @builder_commands do
        ref = push(socket, "command", %{"input" => cmd})
        assert_reply ref, :ok

        # Non-admin should get "Unknown command" output
        assert_push "output", %{text: "Unknown command. Type 'help' for commands."}
      end
    end

    test "help output does not reveal builder commands", %{regular: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "help"})
      assert_reply ref, :ok

      assert_push "output", %{text: help_text}
      refute help_text =~ "Builder Commands"
      refute help_text =~ "goto"
      refute help_text =~ "spawn"
      refute help_text =~ "godmode"
    end
  end

  describe "admin player" do
    test "can execute builder commands", %{admin: player} do
      {:ok, socket} = connect_player(player)

      # Test a simple builder command - "where" reports current room
      ref = push(socket, "command", %{"input" => "where"})
      assert_reply ref, :ok

      assert_push "output", %{text: text}
      assert text =~ "[BUILDER]"
      assert text =~ "Room:"
    end

    test "can see builder commands in help", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "help"})
      assert_reply ref, :ok

      assert_push "output", %{text: help_text}
      assert help_text =~ "Builder Commands"
      assert help_text =~ "goto"
      assert help_text =~ "spawn"
      assert help_text =~ "godmode"
    end

    test "flags command works for admin", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "flags"})
      assert_reply ref, :ok

      assert_push "output", %{text: text}
      assert text =~ "[BUILDER]"
      assert text =~ "No flags set."
    end
  end

  describe "identical responses" do
    test "non-admin builder command response is identical to unknown command", %{regular: player} do
      {:ok, socket} = connect_player(player)

      # Send a builder command
      ref1 = push(socket, "command", %{"input" => "goto tavern"})
      assert_reply ref1, :ok
      assert_push "output", %{text: builder_response}

      # Send a genuinely unknown command
      ref2 = push(socket, "command", %{"input" => "xyzzy"})
      assert_reply ref2, :ok
      assert_push "output", %{text: unknown_response}

      # Responses must be identical (zero information leakage)
      assert builder_response == unknown_response
    end
  end

  # Connect a player to the game channel
  defp connect_player(player) do
    {:ok, token, _claims} = Guardian.encode_and_sign(player, %{})
    {:ok, socket} = connect(LokaWeb.UserSocket, %{"token" => token})
    {:ok, _reply, socket} = subscribe_and_join(socket, LokaWeb.GameChannel, "game:lobby", %{})

    # Drain the initial game_state push
    assert_push "game_state", _state

    {:ok, socket}
  end
end
