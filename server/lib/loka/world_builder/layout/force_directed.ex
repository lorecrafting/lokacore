defmodule Loka.WorldBuilder.Layout.ForceDirected do
  @moduledoc """
  Force-directed graph layout algorithm for room positioning.

  Uses physics simulation with:
  - Repulsion between all rooms (prevent overlap)
  - Attraction along exits (keep connected rooms nearby)
  - Damping to stabilize positions

  ## Usage

      rooms = [%{id: "1", x: 0, y: 0}, %{id: "2", x: 10, y: 10}]
      exits = [%{from: "1", to: "2", direction: "north"}]

      {:ok, new_positions} = ForceDirected.layout(rooms, exits, %{
        iterations: 100,
        repulsion: 500,
        attraction: 0.1,
        damping: 0.9
      })
  """

  @default_options %{
    iterations: 50,
    repulsion: 500.0,
    attraction: 0.1,
    damping: 0.9,
    spacing: 50.0
  }

  @doc """
  Calculate new positions for rooms using force-directed layout.

  ## Parameters
  - rooms: List of room maps with :id, :x, :y
  - exits: List of exit maps with :from, :to
  - options: Configuration map (optional)

  Returns {:ok, positions} where positions is %{room_id => {x, y}}
  """
  def layout(rooms, exits, options \\ %{}) do
    opts = Map.merge(@default_options, options)

    # Initialize positions and velocities
    state = initialize_state(rooms)

    # Run simulation
    final_state =
      Enum.reduce(1..opts.iterations, state, fn _i, acc ->
        simulate_step(acc, exits, opts)
      end)

    # Extract final positions
    positions =
      final_state
      |> Enum.map(fn {id, %{x: x, y: y}} -> {id, {round(x), round(y)}} end)
      |> Map.new()

    {:ok, positions}
  end

  # =============================================================================
  # Private - Initialization
  # =============================================================================

  defp initialize_state(rooms) do
    rooms
    |> Enum.map(fn room ->
      {room.id || room.key,
       %{
         x: (room.x || 0) * 1.0,
         y: (room.y || 0) * 1.0,
         vx: 0.0,
         vy: 0.0
       }}
    end)
    |> Map.new()
  end

  # =============================================================================
  # Private - Simulation
  # =============================================================================

  defp simulate_step(state, exits, opts) do
    # Calculate forces for each room
    state_with_forces =
      state
      |> Enum.map(fn {id, room} ->
        {fx, fy} = calculate_forces(id, room, state, exits, opts)
        {id, Map.merge(room, %{fx: fx, fy: fy})}
      end)
      |> Map.new()

    # Apply forces to update positions
    state_with_forces
    |> Enum.map(fn {id, room} ->
      # Update velocity with damping
      vx = (room.vx + room.fx) * opts.damping
      vy = (room.vy + room.fy) * opts.damping

      # Update position
      x = room.x + vx
      y = room.y + vy

      {id, %{x: x, y: y, vx: vx, vy: vy}}
    end)
    |> Map.new()
  end

  defp calculate_forces(id, room, state, exits, opts) do
    # Repulsion from all other rooms
    {repulsion_x, repulsion_y} = calculate_repulsion(id, room, state, opts)

    # Attraction along exits
    {attraction_x, attraction_y} = calculate_attraction(id, room, state, exits, opts)

    # Sum forces
    {repulsion_x + attraction_x, repulsion_y + attraction_y}
  end

  defp calculate_repulsion(id, room, state, opts) do
    state
    |> Enum.filter(fn {other_id, _} -> other_id != id end)
    |> Enum.reduce({0.0, 0.0}, fn {_, other}, {fx, fy} ->
      dx = room.x - other.x
      dy = room.y - other.y
      distance = :math.sqrt(dx * dx + dy * dy)

      # Avoid division by zero
      distance = max(distance, 1.0)

      # Repulsion force inversely proportional to distance
      force = opts.repulsion / (distance * distance)

      # Normalize direction and apply force
      {fx + dx / distance * force, fy + dy / distance * force}
    end)
  end

  defp calculate_attraction(id, room, state, exits, opts) do
    # Find all exits from this room
    connected_rooms =
      exits
      |> Enum.filter(fn exit -> (exit.from || exit[:from]) == id end)
      |> Enum.map(fn exit -> exit.to || exit[:to] end)
      |> Enum.filter(&Map.has_key?(state, &1))

    connected_rooms
    |> Enum.reduce({0.0, 0.0}, fn other_id, {fx, fy} ->
      other = Map.get(state, other_id)

      dx = other.x - room.x
      dy = other.y - room.y
      distance = :math.sqrt(dx * dx + dy * dy)

      # Attraction force proportional to distance (spring)
      force = distance * opts.attraction

      # Normalize direction and apply force
      if distance > 0 do
        {fx + dx / distance * force, fy + dy / distance * force}
      else
        {fx, fy}
      end
    end)
  end
end
