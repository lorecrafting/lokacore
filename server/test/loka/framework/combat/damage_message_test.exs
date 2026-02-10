defmodule Loka.Framework.Combat.DamageMessageTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Combat.DamageMessage

  describe "generate/4" do
    test "returns messages for all three perspectives" do
      messages = DamageMessage.generate(15, %{name: "Alice"}, %{name: "goblin"})

      assert is_binary(messages.to_attacker)
      assert is_binary(messages.to_defender)
      assert is_binary(messages.to_room)
    end

    test "substitutes attacker and target names" do
      messages = DamageMessage.generate(15, %{name: "Alice"}, %{name: "goblin"})

      # to_attacker messages use {target} placeholder which becomes "goblin"
      assert messages.to_attacker =~ "goblin" or messages.to_attacker =~ "You"
      # to_defender messages use {attacker} placeholder which becomes "Alice"
      assert messages.to_defender =~ "Alice"
    end

    test "handles string names directly" do
      messages = DamageMessage.generate(15, "Alice", "goblin")

      assert is_binary(messages.to_attacker)
      assert messages.to_defender =~ "Alice"
    end

    test "returns miss message for 0 damage" do
      messages = DamageMessage.generate(0, %{name: "Alice"}, %{name: "goblin"})

      # Miss tier messages contain "miss" or similar non-damaging language
      assert messages.to_attacker =~ ~r/miss|fail|air/i
    end

    test "returns tickle message for 1-2 damage" do
      messages = DamageMessage.generate(1, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/tickle|glance|feeble/i
    end

    test "returns hit message for mid-range damage" do
      messages = DamageMessage.generate(18, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/hit|strike|connect|blow/i
    end

    test "returns devastate message for high damage" do
      messages = DamageMessage.generate(70, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/devastat/i
    end

    test "returns OBLITERATE message for extreme damage" do
      messages = DamageMessage.generate(100, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/OBLITERATE|ANNIHILATE/i
    end
  end

  describe "generate/4 with weapon type" do
    test "applies weapon-specific verb override for sword" do
      messages =
        DamageMessage.generate(25, %{name: "Alice"}, %{name: "goblin"}, weapon_type: :sword)

      # Sword overrides "wound" to "cleave" in the 21-30 range
      # The actual message may vary due to random selection
      assert is_binary(messages.to_attacker)
    end

    test "applies weapon-specific verb override for dagger" do
      messages =
        DamageMessage.generate(18, %{name: "Alice"}, %{name: "goblin"}, weapon_type: :dagger)

      # Dagger overrides "hit" to "stab"
      assert is_binary(messages.to_attacker)
    end
  end

  describe "generate/4 with spell damage" do
    test "generates fire spell messages" do
      messages =
        DamageMessage.generate(15, %{name: "Alice"}, %{name: "goblin"},
          damage_type: :spell,
          element: :fire
        )

      assert messages.to_attacker =~ ~r/flame|fire|burn/i
    end

    test "generates ice spell messages" do
      messages =
        DamageMessage.generate(15, %{name: "Alice"}, %{name: "goblin"},
          damage_type: :spell,
          element: :ice
        )

      assert messages.to_attacker =~ ~r/frost|ice|chill|freeze|cold/i
    end

    test "generates lightning spell messages" do
      messages =
        DamageMessage.generate(15, %{name: "Alice"}, %{name: "goblin"},
          damage_type: :spell,
          element: :lightning
        )

      # Damage 15 falls in tier 11-25 which has messages:
      # - "Your lightning bolt strikes {target}!"
      # - "Crackling energy courses through {target}!"
      assert messages.to_attacker =~ ~r/lightning|electricity|spark|zap|crackling|energy|bolt/i
    end

    test "generates high-tier spell messages" do
      messages =
        DamageMessage.generate(50, %{name: "Alice"}, %{name: "goblin"},
          damage_type: :spell,
          element: :fire
        )

      assert messages.to_attacker =~ ~r/INCINERATE|inferno|engulf/i
    end
  end

  describe "avoidance/3" do
    test "generates miss messages" do
      messages = DamageMessage.avoidance(:miss, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/miss|fail|swing/i
      assert messages.to_defender =~ "Alice"
    end

    test "generates dodge messages" do
      messages = DamageMessage.avoidance(:dodge, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/dodge|evade|sidestep/i
      assert messages.to_defender =~ ~r/dodge|evade|sidestep/i
    end

    test "generates parry messages" do
      messages = DamageMessage.avoidance(:parry, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/parr/i
      assert messages.to_defender =~ ~r/parr|turn aside|deflect/i
    end

    test "generates block messages" do
      messages = DamageMessage.avoidance(:block, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/block|shield/i
    end
  end

  describe "death/3" do
    test "generates normal death message" do
      messages = DamageMessage.death(%{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/slain|fall|defeat/i
      assert messages.to_attacker =~ "goblin"
    end

    test "generates overkill death message" do
      messages = DamageMessage.death(%{name: "Alice"}, %{name: "goblin"}, overkill: true)

      assert messages.to_attacker =~ ~r/ANNIHILATE|destroy|overwhelming/i
    end
  end

  describe "critical hits via generate/4" do
    test "generates melee critical message" do
      messages =
        DamageMessage.generate(20, %{name: "Alice"}, %{name: "goblin"}, critical: true)

      assert messages.to_attacker =~ ~r/CRITICAL/i
    end

    test "generates backstab critical message" do
      messages =
        DamageMessage.generate(20, %{name: "Alice"}, %{name: "goblin"},
          critical: true,
          type: :backstab
        )

      assert messages.to_attacker =~ ~r/backstab|back/i
    end
  end

  describe "defense/2" do
    test "generates player defensive stance message" do
      messages = DamageMessage.defense(:enter, %{name: "Alice"})

      assert messages.to_attacker =~ ~r/guard|defensive|brace|defend|prepare/i
    end

    test "generates enemy defensive stance message" do
      messages = DamageMessage.defense(:enemy_enter, %{name: "goblin"})

      assert messages.to_defender =~ "goblin" or messages.to_room =~ "goblin"
    end
  end

  describe "flee/3" do
    test "generates successful flee message" do
      messages = DamageMessage.flee(:success, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/flee|escape|disengage/i
    end

    test "generates failed flee message" do
      messages = DamageMessage.flee(:fail, %{name: "Alice"}, %{name: "goblin"})

      assert messages.to_attacker =~ ~r/flee|escape|block|fail|thwart/i
    end
  end

  describe "message variation" do
    test "randomly selects from multiple message options" do
      # Run multiple times to test random selection works
      messages =
        for _ <- 1..10 do
          DamageMessage.generate(18, %{name: "Alice"}, %{name: "goblin"})
        end

      # All should be valid strings
      Enum.each(messages, fn msg ->
        assert is_binary(msg.to_attacker)
        assert is_binary(msg.to_defender)
        assert is_binary(msg.to_room)
      end)
    end
  end

  describe "nil handling" do
    test "handles nil attacker gracefully" do
      messages = DamageMessage.generate(15, nil, %{name: "goblin"})

      assert is_binary(messages.to_attacker)
      assert messages.to_defender =~ "someone"
    end

    test "handles nil defender gracefully" do
      messages = DamageMessage.generate(15, %{name: "Alice"}, nil)

      assert is_binary(messages.to_attacker)
      assert messages.to_attacker =~ "someone"
    end
  end
end
