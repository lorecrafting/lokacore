defmodule Loka.WorldBuilder.Layout.Hierarchical do
  @moduledoc """
  Hierarchical tree layout algorithm for quest zones.

  Creates a tree structure with start at top, branches spreading downward.
  Ideal for quest progression visualization.

  ## Usage

      rooms = [%{id: "start"}, %{id: "branch1"}, %{id: "end"}]
      exits = [
        %{from: "start", to: "branch1"},
        %{from: "branch1", to: "end"}
      ]

      {:ok, positions} = Hierarchical.layout(rooms, exits, %{
        root_id: "start",
        level_height: 100,
        sibling_spacing: 80
      })
  """

  @default_options %{
    root_id: nil,
    level_height: 100,
    sibling_spacing: 80,
    start_x: 0,
    start_y: 0
  }

  @doc """
  Calculate hierarchical tree layout positions.

  ## Parameters
  - rooms: List of room maps
  - exits: List of exit maps with :from, :to
  - options: Configuration map (optional)
    - :root_id - ID of root room (auto-detected if nil)
    - :level_height - Vertical spacing between levels
    - :sibling_spacing - Horizontal spacing between siblings

  Returns {:ok, positions} where positions is %{room_id => {x, y}}
  """
  def layout(rooms, exits, options \\ %{}) do
    opts = Map.merge(@default_options, options)

    # Build adjacency map
    adjacency = build_adjacency(exits)

    # Find root (room with no incoming edges, or specified root_id)
    root =
      opts.root_id ||
        find_root(rooms, exits)

    if root do
      # Build tree structure
      tree = build_tree(root, adjacency, MapSet.new())

      # Calculate positions
      {positions, _} = layout_tree(tree, opts.start_x, opts.start_y, opts)

      {:ok, positions}
    else
      # No clear hierarchy - fall back to grid layout
      Loka.WorldBuilder.Layout.Grid.layout(rooms, %{})
    end
  end

  # =============================================================================
  # Private - Tree Building
  # =============================================================================

  defp build_adjacency(exits) do
    exits
    |> Enum.reduce(%{}, fn exit, acc ->
      from = exit.from || exit[:from]
      to = exit.to || exit[:to]

      Map.update(acc, from, [to], fn children -> [to | children] end)
    end)
  end

  defp find_root(rooms, exits) do
    # Find room with no incoming edges
    all_ids = MapSet.new(rooms, fn room -> room.id || room.key end)
    target_ids = MapSet.new(exits, fn exit -> exit.to || exit[:to] end)

    roots = MapSet.difference(all_ids, target_ids)

    # Return first root found, or first room if no clear root
    case MapSet.to_list(roots) do
      [root | _] -> root
      [] -> rooms |> List.first() |> then(fn r -> r.id || r.key end)
    end
  end

  defp build_tree(node_id, adjacency, visited) do
    if MapSet.member?(visited, node_id) do
      # Cycle detected - return leaf
      %{id: node_id, children: []}
    else
      visited = MapSet.put(visited, node_id)
      children_ids = Map.get(adjacency, node_id, [])

      children =
        children_ids
        |> Enum.map(fn child_id -> build_tree(child_id, adjacency, visited) end)

      %{id: node_id, children: children}
    end
  end

  # =============================================================================
  # Private - Layout Calculation
  # =============================================================================

  defp layout_tree(tree, x, y, opts) do
    # Calculate width needed for this subtree
    width = calculate_width(tree, opts)

    # Position this node at center of its width
    center_x = x + div(width, 2)

    positions = %{tree.id => {center_x, y}}

    # Layout children
    if Enum.empty?(tree.children) do
      {positions, width}
    else
      child_y = y + opts.level_height

      {child_positions, _} =
        tree.children
        |> Enum.reduce({positions, x}, fn child, {acc_positions, current_x} ->
          {child_pos, child_width} = layout_tree(child, current_x, child_y, opts)

          new_positions = Map.merge(acc_positions, child_pos)
          next_x = current_x + child_width + opts.sibling_spacing

          {new_positions, next_x}
        end)

      {child_positions, width}
    end
  end

  defp calculate_width(tree, opts) do
    if Enum.empty?(tree.children) do
      opts.sibling_spacing
    else
      children_width =
        tree.children
        |> Enum.map(fn child -> calculate_width(child, opts) end)
        |> Enum.sum()

      # Add spacing between children
      spacing = (length(tree.children) - 1) * opts.sibling_spacing

      children_width + spacing
    end
  end
end
