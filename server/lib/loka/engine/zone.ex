defmodule Loka.Engine.Zone do
  @moduledoc """
  Zone struct for defining areas that reset periodically.

  Zones are collections of rooms that respawn mobs and items on a timer.
  This is based on DikuMUD's zone reset system.

  ## Reset Modes

  - `:always` - Reset runs on timer regardless of player presence
  - `:empty` - Reset only runs when no players are in the zone
  - `:never` - Automatic resets disabled (manual only)

  ## Example YAML

      key: monastery
      name: "The Mountain Monastery"
      rooms:
        - monastery_entrance
        - meditation_hall
        - abbot_quarters
      lifespan_minutes: 30
      reset_mode: empty

      resets:
        - type: mob
          prototype: abbot_tenzin
          room: abbot_quarters
          max: 1
          equipment:
            wield: prayer_beads
          inventory:
            - monastery_key

        - type: object
          prototype: incense_burner
          room: meditation_hall
          max: 1

        - type: door
          room: abbot_quarters
          direction: north
          state: closed
  """

  @type reset_mode :: :always | :empty | :never

  @type reset_command ::
          %{type: :mob, prototype: String.t(), room: String.t(), max: pos_integer()}
          | %{type: :object, prototype: String.t(), room: String.t(), max: pos_integer()}
          | %{type: :door, room: String.t(), direction: String.t(), state: atom()}
          | %{type: :remove, prototype: String.t(), room: String.t()}

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          rooms: [String.t()],
          rooms_with_tag: String.t() | nil,
          lifespan_minutes: pos_integer(),
          reset_mode: reset_mode(),
          resets: [reset_command()],
          enabled: boolean(),
          last_reset_at: DateTime.t() | nil
        }

  @enforce_keys [:key, :name]
  defstruct [
    :key,
    :name,
    :rooms_with_tag,
    :last_reset_at,
    rooms: [],
    lifespan_minutes: 30,
    reset_mode: :empty,
    resets: [],
    enabled: true
  ]

  @valid_reset_modes [:always, :empty, :never]
  @valid_reset_types [:mob, :object, :door, :remove]
  @valid_door_states [:open, :closed, :locked]

  @doc """
  Creates a new Zone from a map (typically from YAML parsing).

  ## Examples

      iex> Zone.new(%{key: "forest", name: "Dark Forest", rooms: ["forest_clearing"]})
      {:ok, %Zone{key: "forest", name: "Dark Forest", ...}}
  """
  @spec new(map()) :: {:ok, t()} | {:error, [String.t()]}
  def new(attrs) when is_map(attrs) do
    attrs = normalize_keys(attrs)

    zone = %__MODULE__{
      key: Map.get(attrs, :key),
      name: Map.get(attrs, :name),
      rooms: Map.get(attrs, :rooms, []),
      rooms_with_tag: Map.get(attrs, :rooms_with_tag),
      lifespan_minutes: Map.get(attrs, :lifespan_minutes, 30),
      reset_mode: normalize_reset_mode(Map.get(attrs, :reset_mode, :empty)),
      resets: normalize_resets(Map.get(attrs, :resets, [])),
      enabled: Map.get(attrs, :enabled, true),
      last_reset_at: nil
    }

    case validate(zone) do
      {:ok, _} -> {:ok, zone}
      error -> error
    end
  end

  @doc """
  Validates a Zone struct.
  """
  @spec validate(t()) :: {:ok, t()} | {:error, [String.t()]}
  def validate(%__MODULE__{} = zone) do
    errors =
      []
      |> validate_key(zone.key)
      |> validate_name(zone.name)
      |> validate_rooms(zone.rooms, zone.rooms_with_tag)
      |> validate_lifespan(zone.lifespan_minutes)
      |> validate_reset_mode(zone.reset_mode)
      |> validate_resets(zone.resets)

    case errors do
      [] -> {:ok, zone}
      errors -> {:error, Enum.reverse(errors)}
    end
  end

  @doc """
  Checks if a zone should reset based on its mode and player presence.
  """
  @spec should_reset?(t(), boolean()) :: boolean()
  def should_reset?(%__MODULE__{reset_mode: :never}, _players_present), do: false
  def should_reset?(%__MODULE__{reset_mode: :always}, _players_present), do: true
  def should_reset?(%__MODULE__{reset_mode: :empty}, players_present), do: not players_present

  @doc """
  Returns the next reset time for a zone.
  """
  @spec next_reset_at(t()) :: DateTime.t()
  def next_reset_at(%__MODULE__{last_reset_at: nil, lifespan_minutes: lifespan}) do
    DateTime.add(DateTime.utc_now(), lifespan * 60, :second)
  end

  def next_reset_at(%__MODULE__{last_reset_at: last, lifespan_minutes: lifespan}) do
    DateTime.add(last, lifespan * 60, :second)
  end

  # Private functions

  defp normalize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) ->
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {atom_key, v}

      {k, v} when is_atom(k) ->
        {k, v}
    end)
  end

  defp normalize_reset_mode(mode) when is_binary(mode) do
    case String.to_atom(mode) do
      m when m in @valid_reset_modes -> m
      _ -> mode
    end
  end

  defp normalize_reset_mode(mode) when is_atom(mode), do: mode
  defp normalize_reset_mode(mode), do: mode

  defp normalize_resets(resets) when is_list(resets) do
    Enum.map(resets, &normalize_reset/1)
  end

  defp normalize_resets(_), do: []

  defp normalize_reset(reset) when is_map(reset) do
    reset = normalize_keys(reset)

    type =
      case Map.get(reset, :type) do
        t when is_binary(t) -> String.to_atom(t)
        t when is_atom(t) -> t
        _ -> nil
      end

    Map.put(reset, :type, type)
    |> normalize_door_state()
  end

  defp normalize_reset(reset), do: reset

  defp normalize_door_state(%{type: :door, state: state} = reset) when is_binary(state) do
    Map.put(reset, :state, String.to_atom(state))
  end

  defp normalize_door_state(reset), do: reset

  defp validate_key(errors, key) when is_binary(key) and byte_size(key) > 0 do
    if valid_identifier?(key) do
      errors
    else
      ["key must be a valid identifier (alphanumeric, underscore, hyphen)" | errors]
    end
  end

  defp validate_key(errors, nil), do: ["key is required" | errors]
  defp validate_key(errors, ""), do: ["key must be a non-empty string" | errors]
  defp validate_key(errors, _), do: ["key must be a string" | errors]

  defp validate_name(errors, name) when is_binary(name) and byte_size(name) > 0, do: errors
  defp validate_name(errors, nil), do: ["name is required" | errors]
  defp validate_name(errors, ""), do: ["name must be a non-empty string" | errors]
  defp validate_name(errors, _), do: ["name must be a string" | errors]

  defp validate_rooms(errors, rooms, rooms_with_tag) do
    cond do
      is_list(rooms) and rooms != [] ->
        errors

      is_binary(rooms_with_tag) and byte_size(rooms_with_tag) > 0 ->
        errors

      true ->
        ["zone must have rooms or rooms_with_tag defined" | errors]
    end
  end

  defp validate_lifespan(errors, minutes) when is_integer(minutes) and minutes > 0, do: errors

  defp validate_lifespan(errors, _),
    do: ["lifespan_minutes must be a positive integer" | errors]

  defp validate_reset_mode(errors, mode) when mode in @valid_reset_modes, do: errors

  defp validate_reset_mode(errors, mode) do
    ["reset_mode must be one of #{inspect(@valid_reset_modes)}, got: #{inspect(mode)}" | errors]
  end

  defp validate_resets(errors, resets) when is_list(resets) do
    reset_errors =
      resets
      |> Enum.with_index()
      |> Enum.flat_map(fn {reset, idx} -> validate_reset(reset, idx) end)

    errors ++ reset_errors
  end

  defp validate_resets(errors, _), do: ["resets must be a list" | errors]

  defp validate_reset(reset, idx) when is_map(reset) do
    type = Map.get(reset, :type)

    cond do
      type not in @valid_reset_types ->
        [
          "reset[#{idx}]: type must be one of #{inspect(@valid_reset_types)}, got: #{inspect(type)}"
        ]

      type == :mob ->
        validate_mob_reset(reset, idx)

      type == :object ->
        validate_object_reset(reset, idx)

      type == :door ->
        validate_door_reset(reset, idx)

      type == :remove ->
        validate_remove_reset(reset, idx)

      true ->
        []
    end
  end

  defp validate_reset(_, idx), do: ["reset[#{idx}]: must be a map"]

  defp validate_mob_reset(reset, idx) do
    errors = []

    errors =
      if is_binary(Map.get(reset, :prototype)) do
        errors
      else
        ["reset[#{idx}]: mob reset requires prototype" | errors]
      end

    errors =
      if is_binary(Map.get(reset, :room)) or is_list(Map.get(reset, :rooms)) do
        errors
      else
        ["reset[#{idx}]: mob reset requires room or rooms" | errors]
      end

    errors =
      case Map.get(reset, :max) do
        nil -> errors
        max when is_integer(max) and max > 0 -> errors
        _ -> ["reset[#{idx}]: max must be a positive integer" | errors]
      end

    errors
  end

  defp validate_object_reset(reset, idx) do
    errors = []

    errors =
      if is_binary(Map.get(reset, :prototype)) do
        errors
      else
        ["reset[#{idx}]: object reset requires prototype" | errors]
      end

    errors =
      if is_binary(Map.get(reset, :room)) do
        errors
      else
        ["reset[#{idx}]: object reset requires room" | errors]
      end

    errors
  end

  defp validate_door_reset(reset, idx) do
    errors = []

    errors =
      if is_binary(Map.get(reset, :room)) do
        errors
      else
        ["reset[#{idx}]: door reset requires room" | errors]
      end

    errors =
      if is_binary(Map.get(reset, :direction)) do
        errors
      else
        ["reset[#{idx}]: door reset requires direction" | errors]
      end

    state = Map.get(reset, :state)

    errors =
      if state in @valid_door_states do
        errors
      else
        ["reset[#{idx}]: door state must be one of #{inspect(@valid_door_states)}" | errors]
      end

    errors
  end

  defp validate_remove_reset(reset, idx) do
    errors = []

    errors =
      if is_binary(Map.get(reset, :prototype)) do
        errors
      else
        ["reset[#{idx}]: remove reset requires prototype" | errors]
      end

    errors =
      if is_binary(Map.get(reset, :room)) do
        errors
      else
        ["reset[#{idx}]: remove reset requires room" | errors]
      end

    errors
  end

  defp valid_identifier?(key) do
    Regex.match?(~r/^[a-zA-Z][a-zA-Z0-9_-]*$/, key)
  end
end
