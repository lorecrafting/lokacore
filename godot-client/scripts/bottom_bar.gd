## Fixed bottom bar overlay with compass rose, minimap, and action buttons.
## Sits as a CanvasLayer child, stays in place during page turns.
class_name BottomBar
extends Control

## Emitted when a bottom bar button is pressed
signal bar_pressed(button: String)

## Bar dimensions
const BAR_HEIGHT := 120

## Colors
const COLOR_BG := Color(0.82, 0.75, 0.64)
const COLOR_SEPARATOR := Color(0.45, 0.38, 0.30)
const COLOR_ACTIVE := Color(0.22, 0.16, 0.10)
const COLOR_ACTIVE_HOVER := Color(0.35, 0.25, 0.15)
const COLOR_ACTIVE_PRESSED := Color(0.15, 0.10, 0.05)
const COLOR_DISABLED := Color(0.65, 0.58, 0.50)
const COLOR_DOT_CURRENT := Color(0.30, 0.22, 0.14)
const COLOR_DOT_VISITED := Color(0.70, 0.62, 0.52)
const COLOR_PATH_LINE := Color(0.55, 0.48, 0.40)

## Minimap settings
const MINIMAP_SIZE := 100
const MINIMAP_GRID_SPACING := 20
const MINIMAP_DOT_CURRENT := 6.0
const MINIMAP_DOT_VISITED := 4.5

## Compass direction button references
var _north_btn: Button
var _south_btn: Button
var _east_btn: Button
var _west_btn: Button
var _up_btn: Button
var _down_btn: Button
var _up_down_box: VBoxContainer

## Minimap
var _minimap: Control
var _minimap_nodes: Array = []  # [{key, grid_x, grid_y, is_current}]
var _minimap_edges: Array = []  # [{from, to}] - lines between rooms


func _ready() -> void:
	_build_ui()


func _build_ui() -> void:
	# Position at bottom of screen
	set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	offset_top = -BAR_HEIGHT

	# Background
	var bar_bg := ColorRect.new()
	bar_bg.color = COLOR_BG
	bar_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bar_bg)

	# Decorative separator line at top
	var separator := ColorRect.new()
	separator.color = COLOR_SEPARATOR
	separator.set_anchors_preset(Control.PRESET_TOP_WIDE)
	separator.custom_minimum_size = Vector2(0, 1)
	add_child(separator)

	# Main HBox layout
	var hbox := HBoxContainer.new()
	hbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	hbox.offset_left = 12
	hbox.offset_right = -12
	hbox.offset_top = 4
	hbox.offset_bottom = -4
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 8)
	add_child(hbox)

	# Left section: Compass Rose + Up/Down
	var left_section := HBoxContainer.new()
	left_section.add_theme_constant_override("separation", 6)
	hbox.add_child(left_section)

	var compass := _create_compass_rose()
	left_section.add_child(compass)

	_up_down_box = _create_up_down()
	left_section.add_child(_up_down_box)

	# Spacer
	var spacer1 := Control.new()
	spacer1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer1)

	# Center: Minimap
	_minimap = _create_minimap()
	hbox.add_child(_minimap)

	# Spacer
	var spacer2 := Control.new()
	spacer2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer2)

	# Right section: Menu + Say
	var right_section := VBoxContainer.new()
	right_section.alignment = BoxContainer.ALIGNMENT_CENTER
	right_section.add_theme_constant_override("separation", 4)
	hbox.add_child(right_section)

	var menu_btn := _create_action_button("Menu", "menu")
	right_section.add_child(menu_btn)

	var say_btn := _create_action_button("Say", "say")
	right_section.add_child(say_btn)


func _create_compass_rose() -> VBoxContainer:
	var compass := VBoxContainer.new()
	compass.alignment = BoxContainer.ALIGNMENT_CENTER
	compass.add_theme_constant_override("separation", 0)

	# North row
	var north_row := HBoxContainer.new()
	north_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_north_btn = _create_direction_button("N", "north")
	north_row.add_child(_north_btn)
	compass.add_child(north_row)

	# Middle row: W · E
	var mid_row := HBoxContainer.new()
	mid_row.alignment = BoxContainer.ALIGNMENT_CENTER
	mid_row.add_theme_constant_override("separation", 0)

	_west_btn = _create_direction_button("W", "west")
	mid_row.add_child(_west_btn)

	var dot := Label.new()
	dot.text = "·"
	dot.custom_minimum_size = Vector2(16, 0)
	dot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dot.add_theme_font_size_override("font_size", 16)
	dot.add_theme_color_override("font_color", COLOR_DISABLED)
	mid_row.add_child(dot)

	_east_btn = _create_direction_button("E", "east")
	mid_row.add_child(_east_btn)

	compass.add_child(mid_row)

	# South row
	var south_row := HBoxContainer.new()
	south_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_south_btn = _create_direction_button("S", "south")
	south_row.add_child(_south_btn)
	compass.add_child(south_row)

	return compass


func _create_direction_button(label: String, direction: String) -> Button:
	var btn := Button.new()
	btn.text = label
	btn.custom_minimum_size = Vector2(32, 28)
	btn.add_theme_font_size_override("font_size", 16)
	btn.flat = true
	btn.pressed.connect(func(): bar_pressed.emit(direction))
	return btn


func _create_up_down() -> VBoxContainer:
	var vbox := VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 2)
	vbox.custom_minimum_size = Vector2(28, 0)

	_up_btn = _create_direction_button("Up", "up")
	_up_btn.add_theme_font_size_override("font_size", 12)
	_up_btn.custom_minimum_size = Vector2(28, 26)
	vbox.add_child(_up_btn)

	_down_btn = _create_direction_button("Dn", "down")
	_down_btn.add_theme_font_size_override("font_size", 12)
	_down_btn.custom_minimum_size = Vector2(28, 26)
	vbox.add_child(_down_btn)

	return vbox


func _create_minimap() -> Control:
	var minimap := Control.new()
	minimap.custom_minimum_size = Vector2(MINIMAP_SIZE, MINIMAP_SIZE)
	minimap.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	minimap.clip_contents = true
	minimap.draw.connect(_draw_minimap.bind(minimap))
	return minimap


func _create_action_button(label: String, action: String) -> Button:
	var btn := Button.new()
	btn.text = label
	btn.custom_minimum_size = Vector2(48, 36)
	btn.add_theme_font_size_override("font_size", 16)
	btn.flat = true
	btn.add_theme_color_override("font_color", COLOR_ACTIVE)
	btn.add_theme_color_override("font_hover_color", COLOR_ACTIVE_HOVER)
	btn.add_theme_color_override("font_pressed_color", COLOR_ACTIVE_PRESSED)
	btn.pressed.connect(func(): bar_pressed.emit(action))
	return btn


## Show or hide the entire bar
func set_bar_visible(is_visible: bool) -> void:
	visible = is_visible


## Update compass button states based on available exits
func update_exits(exits: Array) -> void:
	_style_direction_button(_north_btn, exits.has("north"))
	_style_direction_button(_south_btn, exits.has("south"))
	_style_direction_button(_east_btn, exits.has("east"))
	_style_direction_button(_west_btn, exits.has("west"))

	# Up/Down: always visible, grayed out when unavailable
	_style_direction_button(_up_btn, exits.has("up"))
	_style_direction_button(_down_btn, exits.has("down"))


func _style_direction_button(btn: Button, is_available: bool) -> void:
	if btn == null:
		return

	btn.disabled = not is_available

	if is_available:
		btn.modulate = Color(1.0, 1.0, 1.0, 1.0)
		btn.add_theme_color_override("font_color", COLOR_ACTIVE)
		btn.add_theme_color_override("font_hover_color", COLOR_ACTIVE_HOVER)
		btn.add_theme_color_override("font_pressed_color", COLOR_ACTIVE_PRESSED)
	else:
		btn.modulate = Color(0.6, 0.6, 0.6, 0.5)
		btn.add_theme_color_override("font_color", COLOR_DISABLED)
		btn.add_theme_color_override("font_disabled_color", COLOR_DISABLED)


## Update the minimap with BFS graph data from the current room
func update_minimap(current_room: MockWorld.Room, visited_rooms: Dictionary) -> void:
	_minimap_nodes.clear()
	_minimap_edges.clear()

	if current_room == null:
		_minimap.queue_redraw()
		return

	# Direction -> grid offset mapping
	var dir_offsets := {
		"north": Vector2i(0, -1),
		"south": Vector2i(0, 1),
		"east": Vector2i(1, 0),
		"west": Vector2i(-1, 0),
		"up": Vector2i(0, -1),
		"down": Vector2i(0, 1),
	}

	# BFS up to 2 hops
	var grid_positions: Dictionary = {}  # room_key -> Vector2i
	var queue: Array = []  # [room_key, depth]

	grid_positions[current_room.key] = Vector2i(0, 0)
	queue.append([current_room.key, 0])

	var processed: Dictionary = {}

	while queue.size() > 0:
		var entry: Array = queue.pop_front()
		var room_key: String = entry[0]
		var depth: int = entry[1]

		if processed.has(room_key):
			continue
		processed[room_key] = true

		# Get room data from visited cache or MockWorld
		var room: MockWorld.Room = null
		if visited_rooms.has(room_key):
			room = visited_rooms[room_key]
		else:
			room = MockWorld.get_room(room_key)

		if room == null:
			continue

		var from_pos: Vector2i = grid_positions[room_key]

		# Only expand if within depth limit
		if depth < 2:
			for dir in room.exits:
				if not dir_offsets.has(dir):
					continue
				var dest_key: String = room.exits[dir]
				var offset: Vector2i = dir_offsets[dir]
				var to_pos: Vector2i = from_pos + offset

				# Don't overwrite existing grid positions
				if not grid_positions.has(dest_key):
					grid_positions[dest_key] = to_pos

				# Add edge
				_minimap_edges.append({
					"from": from_pos,
					"to": grid_positions[dest_key],
				})

				if not processed.has(dest_key):
					queue.append([dest_key, depth + 1])

	# Convert grid positions to node list
	for room_key in grid_positions:
		var gpos: Vector2i = grid_positions[room_key]
		_minimap_nodes.append({
			"key": room_key,
			"grid_x": gpos.x,
			"grid_y": gpos.y,
			"is_current": room_key == current_room.key,
		})

	_minimap.queue_redraw()


func _draw_minimap(minimap: Control) -> void:
	var center := minimap.size / 2.0

	# Draw edges (lines between rooms)
	for edge in _minimap_edges:
		var from_pos: Vector2i = edge["from"]
		var to_pos: Vector2i = edge["to"]
		var from_px := center + Vector2(from_pos.x * MINIMAP_GRID_SPACING, from_pos.y * MINIMAP_GRID_SPACING)
		var to_px := center + Vector2(to_pos.x * MINIMAP_GRID_SPACING, to_pos.y * MINIMAP_GRID_SPACING)
		minimap.draw_line(from_px, to_px, COLOR_PATH_LINE, 1.5)

	# Draw nodes (room dots)
	for node in _minimap_nodes:
		var grid_x: int = node["grid_x"]
		var grid_y: int = node["grid_y"]
		var pos := center + Vector2(grid_x * MINIMAP_GRID_SPACING, grid_y * MINIMAP_GRID_SPACING)
		var is_current: bool = node["is_current"]

		if is_current:
			minimap.draw_circle(pos, MINIMAP_DOT_CURRENT, COLOR_DOT_CURRENT)
		else:
			minimap.draw_circle(pos, MINIMAP_DOT_VISITED, COLOR_DOT_VISITED)
