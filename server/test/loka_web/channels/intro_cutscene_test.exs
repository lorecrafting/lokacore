defmodule LokaWeb.Channels.IntroCutsceneTest do
  @moduledoc "Verify the grove awakening cutscene auto-plays on first join only."

  use Loka.ChannelCase, async: false

  alias Loka.Engine.EntitySeeder

  setup do
    EntitySeeder.seed()
    :ok
  end

  describe "intro cutscene on join" do
    test "first join pushes cutscene_start, second join does not" do
      player = create_test_player(name: "CutsceneTest")

      # First join — should get cutscene_start after game_state
      {:ok, token, _} = Loka.Auth.Guardian.encode_and_sign(player, %{})
      {:ok, socket} = connect(LokaWeb.UserSocket, %{"token" => token})
      {:ok, _reply, socket} = subscribe_and_join(socket, LokaWeb.GameChannel, "game:lobby", %{})

      assert_push "game_state", _state, 2000
      assert_push "cutscene_start", %{cutscene_key: "grove_awakening"}, 2000

      # Leave and rejoin — should NOT get cutscene_start
      Process.unlink(socket.channel_pid)
      ref = leave(socket)
      assert_reply ref, :ok

      # Small delay to let cleanup happen
      Process.sleep(200)

      {:ok, socket2} = connect(LokaWeb.UserSocket, %{"token" => token})

      {:ok, _reply, _socket2} =
        subscribe_and_join(socket2, LokaWeb.GameChannel, "game:lobby", %{})

      assert_push "game_state", _state2, 2000
      refute_push "cutscene_start", _, 500
    end
  end
end
