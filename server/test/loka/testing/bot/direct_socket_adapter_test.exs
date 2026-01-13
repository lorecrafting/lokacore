defmodule Loka.Testing.Bot.DirectSocketAdapterTest do
  use Loka.DataCase, async: false

  alias Loka.Testing.Bot.DirectSocketAdapter
  alias Loka.Accounts

  describe "join/1 - system quest granting" do
    test "grants system quests to new bot on first join" do
      # Create a test player
      player = create_test_player()

      # Start adapter
      {:ok, adapter} = DirectSocketAdapter.start_link(player)

      # Join the game
      {:ok, initial_state} = DirectSocketAdapter.join(adapter)

      # Verify that system quests were granted
      active_quests = initial_state.quests["active"] || %{}

      # Check that intro_welcome quest (a system quest) was granted
      quest_ids = Map.keys(active_quests)

      assert "intro_welcome" in quest_ids,
             "Expected intro_welcome system quest to be granted, got: #{inspect(quest_ids)}"

      # Stop adapter
      DirectSocketAdapter.stop(adapter)
    end

    test "does not grant system quests twice" do
      # Create a test player
      player = create_test_player()

      # Start adapter and join
      {:ok, adapter} = DirectSocketAdapter.start_link(player)
      {:ok, first_state} = DirectSocketAdapter.join(adapter)

      first_active_quests = first_state.quests["active"] || %{}
      first_quest_count = map_size(first_active_quests)
      assert first_quest_count > 0, "Expected system quests to be granted on first join"

      # Stop and restart
      DirectSocketAdapter.stop(adapter)

      {:ok, adapter2} = DirectSocketAdapter.start_link(player)
      {:ok, second_state} = DirectSocketAdapter.join(adapter2)

      second_active_quests = second_state.quests["active"] || %{}
      second_quest_count = map_size(second_active_quests)

      # Should have the same quests (not duplicated)
      assert second_quest_count == first_quest_count,
             "System quests should not be duplicated on rejoin"

      DirectSocketAdapter.stop(adapter2)
    end
  end

  # Helper to create a test player
  defp create_test_player do
    unique_id = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    email = "test_adapter_#{unique_id}@test.local"
    name = "TestAdapter#{unique_id}"

    {:ok, player} = Accounts.register_player(%{email: email})

    # Confirm and set name
    confirmed_at = DateTime.utc_now() |> DateTime.truncate(:second)

    player
    |> Ecto.Changeset.change(%{confirmed_at: confirmed_at, name: name})
    |> Loka.Repo.update!()
  end
end
