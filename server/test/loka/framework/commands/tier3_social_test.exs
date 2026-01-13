defmodule Loka.Framework.Commands.Tier3SocialTest do
  @moduledoc """
  Tests for Tier 3 social commands: mood, pose, shout, yell.
  """

  use ExUnit.Case, async: true

  alias Loka.Framework.Commands.{MoodCommand, PoseCommand, ShoutCommand, YellCommand}

  describe "MoodCommand" do
    setup do
      actor = %{
        id: "player_123",
        player_id: "player_123",
        name: "TestPlayer",
        short_desc: "TestPlayer"
      }

      location = %{id: "room_001"}
      game_state = %{social: %{}}

      context = %{
        actor: actor,
        location: location,
        game_state: game_state
      }

      {:ok, context: context, actor: actor}
    end

    test "key returns 'mood'" do
      assert MoodCommand.key() == "mood"
    end

    test "parse with no args returns show action" do
      assert {:ok, %{action: :show}} = MoodCommand.parse("", %{})
    end

    test "parse with valid mood returns set action" do
      assert {:ok, %{action: :set, mood: :cheerful}} = MoodCommand.parse("cheerful", %{})
      assert {:ok, %{action: :set, mood: :melancholy}} = MoodCommand.parse("melancholy", %{})
      assert {:ok, %{action: :set, mood: :fierce}} = MoodCommand.parse("fierce", %{})
    end

    test "parse with mood alias returns correct mood" do
      assert {:ok, %{action: :set, mood: :cheerful}} = MoodCommand.parse("happy", %{})
      assert {:ok, %{action: :set, mood: :melancholy}} = MoodCommand.parse("sad", %{})
      assert {:ok, %{action: :set, mood: :neutral}} = MoodCommand.parse("clear", %{})
    end

    test "parse with invalid mood returns error" do
      assert {:error, _message} = MoodCommand.parse("invalid_mood", %{})
    end

    test "execute show returns current mood info", %{context: context} do
      {:ok, events} = MoodCommand.execute(%{action: :show}, context)

      assert [event] = events
      assert event.type == :info
      assert event.recipient == :actor
      assert String.contains?(event.text, "Your mood:")
    end

    test "execute set mood returns state update and info", %{context: context} do
      {:ok, events} = MoodCommand.execute(%{action: :set, mood: :cheerful}, context)

      # Should have at least an info event and a state_update event
      info_event = Enum.find(events, &(&1.type == :info))
      state_event = Enum.find(events, &(&1.type == :state_update))

      assert info_event != nil
      assert String.contains?(info_event.text, "cheerful")

      assert state_event != nil
      assert state_event.updates.social.mood.current == :cheerful
    end

    test "valid_moods returns all mood atoms" do
      moods = MoodCommand.valid_moods()

      assert :neutral in moods
      assert :cheerful in moods
      assert :melancholy in moods
      assert :fierce in moods
      assert :distracted in moods
      assert :formal in moods
      assert :playful in moods
      assert :weary in moods
    end

    test "mood_adverb returns correct adverb for each mood" do
      assert MoodCommand.mood_adverb(:neutral) == nil
      assert MoodCommand.mood_adverb(:cheerful) == "cheerfully"
      assert MoodCommand.mood_adverb(:melancholy) == "sadly"
      assert MoodCommand.mood_adverb(:fierce) == "fiercely"
      assert MoodCommand.mood_adverb(:distracted) == "absently"
      assert MoodCommand.mood_adverb(:formal) == "formally"
      assert MoodCommand.mood_adverb(:playful) == "playfully"
      assert MoodCommand.mood_adverb(:weary) == "wearily"
    end

    test "mood_look_description returns description for non-neutral moods" do
      assert MoodCommand.mood_look_description(:neutral) == nil
      assert MoodCommand.mood_look_description(:cheerful) == "looking cheerful"
      assert MoodCommand.mood_look_description(:melancholy) == "looking somewhat melancholy"
    end

    test "apply_mood modifies message with mood adverb" do
      assert MoodCommand.apply_mood("You smile happily.", :cheerful) == "You smile cheerfully."
      assert MoodCommand.apply_mood("You wave warmly.", :fierce) == "You wave fiercely."
      assert MoodCommand.apply_mood("You smile happily.", :neutral) == "You smile happily."
    end
  end

  describe "PoseCommand" do
    setup do
      actor = %{
        id: "player_123",
        player_id: "player_123",
        name: "TestPlayer",
        short_desc: "TestPlayer"
      }

      location = %{id: "room_001"}
      game_state = %{social: %{}}

      context = %{
        actor: actor,
        location: location,
        game_state: game_state
      }

      {:ok, context: context, actor: actor}
    end

    test "key returns 'pose'" do
      assert PoseCommand.key() == "pose"
    end

    test "aliases includes '@'" do
      assert "@" in PoseCommand.aliases()
    end

    test "parse with no args returns clear action" do
      assert {:ok, %{action: :clear}} = PoseCommand.parse("", %{})
    end

    test "parse with 'clear' returns clear action" do
      assert {:ok, %{action: :clear}} = PoseCommand.parse("clear", %{})
    end

    test "parse with valid pose returns set action" do
      pose = "sits cross-legged, reading a tome"
      assert {:ok, %{action: :set, pose: ^pose}} = PoseCommand.parse(pose, %{})
    end

    test "parse with too long pose returns error" do
      long_pose = String.duplicate("a", 201)
      assert {:error, message} = PoseCommand.parse(long_pose, %{})
      assert String.contains?(message, "too long")
    end

    test "parse with newline in pose returns error" do
      assert {:error, message} = PoseCommand.parse("sits\nreading", %{})
      assert String.contains?(message, "newlines")
    end

    test "execute clear returns state update", %{context: context} do
      {:ok, events} = PoseCommand.execute(%{action: :clear}, context)

      info_event = Enum.find(events, &(&1.type == :info))
      state_event = Enum.find(events, &(&1.type == :state_update))

      assert info_event != nil
      assert String.contains?(info_event.text, "relax")

      assert state_event != nil
      assert state_event.updates.social.pose == nil
    end

    test "execute set pose returns state update", %{context: context} do
      pose = "sits meditating"
      {:ok, events} = PoseCommand.execute(%{action: :set, pose: pose}, context)

      info_event = Enum.find(events, &(&1.type == :info))
      state_event = Enum.find(events, &(&1.type == :state_update))

      assert info_event != nil
      assert String.contains?(info_event.text, pose)

      assert state_event != nil
      assert state_event.updates.social.pose.text == pose
    end

    test "format_room_presence with nil pose" do
      assert PoseCommand.format_room_presence("Alice", nil) == "Alice is here."
    end

    test "format_room_presence with empty pose" do
      assert PoseCommand.format_room_presence("Alice", "") == "Alice is here."
    end

    test "format_room_presence with pose" do
      assert PoseCommand.format_room_presence("Alice", "sits reading") == "Alice sits reading."
    end

    test "get_pose returns pose from game_state" do
      state = %{social: %{pose: %{text: "sits quietly"}}}
      assert PoseCommand.get_pose(state) == "sits quietly"
    end

    test "get_pose returns nil for empty state" do
      assert PoseCommand.get_pose(%{}) == nil
    end

    test "clear_pose_update returns correct update map" do
      update = PoseCommand.clear_pose_update()
      assert update == %{social: %{pose: nil}}
    end

    test "auto_clear_triggers includes expected actions" do
      triggers = PoseCommand.auto_clear_triggers()

      assert :move in triggers
      assert :attack in triggers
      assert :enter_combat in triggers
    end
  end

  describe "ShoutCommand" do
    setup do
      actor = %{
        id: "player_123",
        player_id: "player_123",
        name: "TestPlayer",
        short_desc: "TestPlayer"
      }

      location = %{id: "room_001"}
      game_state = %{social: %{}}

      context = %{
        actor: actor,
        location: location,
        game_state: game_state
      }

      {:ok, context: context, actor: actor}
    end

    test "key returns 'shout'" do
      assert ShoutCommand.key() == "shout"
    end

    test "parse with no args returns error" do
      assert {:error, "Shout what?"} = ShoutCommand.parse("", %{})
    end

    test "parse with message returns ok" do
      assert {:ok, %{message: "Help!"}} = ShoutCommand.parse("Help!", %{})
    end

    test "parse while on cooldown returns error" do
      context = %{
        game_state: %{
          social: %{
            last_shout_at: DateTime.utc_now()
          }
        }
      }

      assert {:error, message} = ShoutCommand.parse("Help!", context)
      assert String.contains?(message, "catch your breath")
    end

    test "parse after cooldown expires returns ok" do
      # 15 seconds ago (cooldown is 10 seconds)
      past = DateTime.add(DateTime.utc_now(), -15, :second)

      context = %{
        game_state: %{
          social: %{
            last_shout_at: past
          }
        }
      }

      assert {:ok, %{message: "Help!"}} = ShoutCommand.parse("Help!", context)
    end

    test "execute returns shout event and state update", %{context: context} do
      {:ok, events} = ShoutCommand.execute(%{message: "Help!"}, context)

      shout_event = Enum.find(events, &(&1.type == :shout))
      state_event = Enum.find(events, &(&1.type == :state_update))

      assert shout_event != nil
      assert String.contains?(shout_event.text, "Help!")

      assert state_event != nil
      assert state_event.updates.social.last_shout_at != nil
    end

    test "execute without location returns error" do
      context = %{actor: %{id: "player_123"}, location: nil, game_state: %{}}

      assert {:error, "You cannot shout here."} =
               ShoutCommand.execute(%{message: "Help!"}, context)
    end
  end

  describe "YellCommand" do
    setup do
      actor = %{
        id: "player_123",
        player_id: "player_123",
        name: "TestPlayer",
        short_desc: "TestPlayer"
      }

      location = %{id: "room_001"}
      game_state = %{social: %{}}

      context = %{
        actor: actor,
        location: location,
        game_state: game_state
      }

      {:ok, context: context, actor: actor}
    end

    test "key returns 'yell'" do
      assert YellCommand.key() == "yell"
    end

    test "parse with no args returns error" do
      assert {:error, "Yell what?"} = YellCommand.parse("", %{})
    end

    test "parse with message returns ok" do
      assert {:ok, %{message: "Rally!"}} = YellCommand.parse("Rally!", %{})
    end

    test "parse while on cooldown returns error" do
      context = %{
        game_state: %{
          social: %{
            last_yell_at: DateTime.utc_now()
          }
        }
      }

      assert {:error, message} = YellCommand.parse("Rally!", context)
      assert String.contains?(message, "hoarse")
    end

    test "parse after cooldown expires returns ok" do
      # 35 seconds ago (cooldown is 30 seconds)
      past = DateTime.add(DateTime.utc_now(), -35, :second)

      context = %{
        game_state: %{
          social: %{
            last_yell_at: past
          }
        }
      }

      assert {:ok, %{message: "Rally!"}} = YellCommand.parse("Rally!", context)
    end

    test "execute returns yell event and state update", %{context: context} do
      {:ok, events} = YellCommand.execute(%{message: "Rally!"}, context)

      yell_event = Enum.find(events, &(&1.type == :yell))
      state_event = Enum.find(events, &(&1.type == :state_update))

      assert yell_event != nil
      assert String.contains?(yell_event.text, "Rally!")

      assert state_event != nil
      assert state_event.updates.social.last_yell_at != nil
    end

    test "execute without location returns error" do
      context = %{actor: %{id: "player_123"}, location: nil, game_state: %{}}

      assert {:error, "You cannot yell here."} =
               YellCommand.execute(%{message: "Rally!"}, context)
    end
  end
end
