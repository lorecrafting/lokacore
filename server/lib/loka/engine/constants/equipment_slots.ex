defmodule Loka.Engine.Constants.EquipmentSlots do
  @moduledoc """
  Single source of truth for equipment slot definitions.

  All equipment-related modules should reference this module instead
  of defining their own slot lists.

  ## LegendMUD-Style Slots

  - `:head` - worn on head (helmets, hats)
  - `:neck` - worn around neck (necklaces, scarves)
  - `:torso` - worn on torso (shirts, robes, armor)
  - `:about` - worn about body (cloaks, capes)
  - `:arms` - worn on arms (bracers, sleeves)
  - `:hands` - worn on hands (gloves, gauntlets)
  - `:waist` - worn around waist (belts, sashes)
  - `:legs` - worn on legs (pants, greaves)
  - `:feet` - worn on feet (boots, shoes)
  - `:held` - held in hand (torches, shields)
  - `:wielded` - wielded weapon (swords, staves)
  - `:light` - light source (lamps, candles)
  - `:finger_left` - worn on left finger (rings)
  - `:finger_right` - worn on right finger (rings)
  - `:wrist_left` - worn on left wrist (bracelets)
  - `:wrist_right` - worn on right wrist (bracelets)

  ## Usage

      alias Loka.Engine.Constants.EquipmentSlots

      # Get all slots
      EquipmentSlots.all()

      # Check if valid
      EquipmentSlots.valid?(:wielded)  # true
      EquipmentSlots.valid?(:invalid)  # false

      # Generate default equipment map
      EquipmentSlots.default_equipment()
  """

  @slots [
    :head,
    :neck,
    :torso,
    :about,
    :arms,
    :hands,
    :waist,
    :legs,
    :feet,
    :held,
    :wielded,
    :light,
    :finger_left,
    :finger_right,
    :wrist_left,
    :wrist_right
  ]

  @type slot ::
          :head
          | :neck
          | :torso
          | :about
          | :arms
          | :hands
          | :waist
          | :legs
          | :feet
          | :held
          | :wielded
          | :light
          | :finger_left
          | :finger_right
          | :wrist_left
          | :wrist_right

  @doc "Returns all valid equipment slots."
  @spec all() :: [slot()]
  def all, do: @slots

  @doc "Returns true if the given slot is valid."
  @spec valid?(atom()) :: boolean()
  def valid?(slot), do: slot in @slots

  @doc "Returns a map with all slots set to nil (for default equipment)."
  @spec default_equipment() :: %{slot() => nil}
  def default_equipment do
    Map.new(@slots, fn slot -> {slot, nil} end)
  end

  @doc "Returns slot metadata for display (slot, label, description)."
  @spec slot_metadata() :: [{slot(), String.t(), String.t()}]
  def slot_metadata do
    [
      {:head, "Head", "worn on head"},
      {:neck, "Neck", "worn around neck"},
      {:torso, "Torso", "worn on torso"},
      {:about, "About", "worn about body"},
      {:arms, "Arms", "worn on arms"},
      {:hands, "Hands", "worn on hands"},
      {:waist, "Waist", "worn around waist"},
      {:legs, "Legs", "worn on legs"},
      {:feet, "Feet", "worn on feet"},
      {:held, "Held", "held in hand"},
      {:wielded, "Wielded", "wielded"},
      {:light, "Light", "light source"},
      {:finger_left, "Left Finger", "worn on left finger"},
      {:finger_right, "Right Finger", "worn on right finger"},
      {:wrist_left, "Left Wrist", "worn on left wrist"},
      {:wrist_right, "Right Wrist", "worn on right wrist"}
    ]
  end

  @doc "Parses a string or atom into a valid slot, or returns default."
  @spec parse(String.t() | atom(), slot()) :: slot()
  def parse(slot, default \\ :held)

  def parse(slot, _default) when is_atom(slot) and slot in @slots, do: slot

  def parse(slot, default) when is_binary(slot) do
    case slot do
      "head" -> :head
      "neck" -> :neck
      "torso" -> :torso
      "about" -> :about
      "arms" -> :arms
      "hands" -> :hands
      "waist" -> :waist
      "legs" -> :legs
      "feet" -> :feet
      "held" -> :held
      "wielded" -> :wielded
      "light" -> :light
      "finger_left" -> :finger_left
      "finger_right" -> :finger_right
      "wrist_left" -> :wrist_left
      "wrist_right" -> :wrist_right
      # Legacy mappings
      "weapon" -> :wielded
      "armor" -> :torso
      "accessory" -> :held
      _ -> default
    end
  end

  def parse(_, default), do: default
end
