## Fixed bottom bar overlay with compass and action buttons.
## Sits as a CanvasLayer child, stays in place during page turns.
## Replaces the per-page bottom bar from PageMeshFactory.
class_name BottomBar
extends Control

## Emitted when a bottom bar button is pressed
signal bar_pressed(button: String)

## Bar dimensions
const BAR_HEIGHT := 120
const BUTTON_SIZE := 70

## Compass button references
var _north_btn: Button
var _south_btn: Button
var _east_btn: Button
var _west_btn: Button


func _ready() -> void:
	_build_ui()


func _build_ui() -> void:
	# Position at bottom of screen
	set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	offset_top = -BAR_HEIGHT

	# Background - slightly darker aged parchment
	var bar_bg := ColorRect.new()
	bar_bg.color = Color(0.82, 0.75, 0.64)
	bar_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bar_bg)

	# Decorative separator line at top
	var separator := ColorRect.new()
	separator.color = Color(0.45, 0.38, 0.30)
	separator.set_anchors_preset(Control.PRESET_TOP_WIDE)
	separator.custom_minimum_size = Vector2(0, 1)
	add_child(separator)

	# HBox for buttons
	var hbox := HBoxContainer.new()
	hbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	hbox.offset_left = 20
	hbox.offset_right = -20
	hbox.offset_top = 10
	hbox.offset_bottom = -10
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(hbox)

	# Menu button (left)
	var menu_btn := _create_bar_button("Menu", "menu")
	hbox.add_child(menu_btn)

	# Spacer
	var spacer1 := Control.new()
	spacer1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer1)

	# Compass (center)
	var compass := _create_compass()
	hbox.add_child(compass)

	# Spacer
	var spacer2 := Control.new()
	spacer2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer2)

	# Say button (right)
	var say_btn := _create_bar_button("Say", "say")
	hbox.add_child(say_btn)


func _create_bar_button(icon: String, action: String) -> Button:
	var btn := Button.new()
	btn.text = icon
	btn.custom_minimum_size = Vector2(BUTTON_SIZE, BUTTON_SIZE)
	btn.add_theme_font_size_override("font_size", 24)
	btn.pressed.connect(func(): bar_pressed.emit(action))
	return btn


func _create_compass() -> VBoxContainer:
	var compass := VBoxContainer.new()
	compass.alignment = BoxContainer.ALIGNMENT_CENTER

	# North
	_north_btn = Button.new()
	_north_btn.text = "^"
	_north_btn.name = "NorthBtn"
	_north_btn.custom_minimum_size = Vector2(40, 28)
	_north_btn.add_theme_font_size_override("font_size", 18)
	_north_btn.pressed.connect(func(): bar_pressed.emit("north"))
	compass.add_child(_north_btn)

	# Middle row (West . East)
	var mid_row := HBoxContainer.new()
	mid_row.alignment = BoxContainer.ALIGNMENT_CENTER

	_west_btn = Button.new()
	_west_btn.text = "<"
	_west_btn.name = "WestBtn"
	_west_btn.custom_minimum_size = Vector2(40, 28)
	_west_btn.add_theme_font_size_override("font_size", 18)
	_west_btn.pressed.connect(func(): bar_pressed.emit("west"))
	mid_row.add_child(_west_btn)

	var dot := Label.new()
	dot.text = "."
	dot.custom_minimum_size = Vector2(24, 0)
	dot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid_row.add_child(dot)

	_east_btn = Button.new()
	_east_btn.text = ">"
	_east_btn.name = "EastBtn"
	_east_btn.custom_minimum_size = Vector2(40, 28)
	_east_btn.add_theme_font_size_override("font_size", 18)
	_east_btn.pressed.connect(func(): bar_pressed.emit("east"))
	mid_row.add_child(_east_btn)

	compass.add_child(mid_row)

	# South
	_south_btn = Button.new()
	_south_btn.text = "v"
	_south_btn.name = "SouthBtn"
	_south_btn.custom_minimum_size = Vector2(40, 28)
	_south_btn.add_theme_font_size_override("font_size", 18)
	_south_btn.pressed.connect(func(): bar_pressed.emit("south"))
	compass.add_child(_south_btn)

	return compass


## Update compass button states based on available exits
func update_exits(exits: Array) -> void:
	_style_compass_button(_north_btn, exits.has("north"))
	_style_compass_button(_south_btn, exits.has("south"))
	_style_compass_button(_east_btn, exits.has("east"))
	_style_compass_button(_west_btn, exits.has("west"))


func _style_compass_button(btn: Button, is_available: bool) -> void:
	if btn == null:
		return

	btn.disabled = not is_available

	if is_available:
		btn.modulate = Color(1.0, 1.0, 1.0, 1.0)
		btn.add_theme_color_override("font_color", Color(0.22, 0.16, 0.10))
		btn.add_theme_color_override("font_hover_color", Color(0.35, 0.25, 0.15))
		btn.add_theme_color_override("font_pressed_color", Color(0.15, 0.10, 0.05))
	else:
		btn.modulate = Color(0.6, 0.6, 0.6, 0.5)
		btn.add_theme_color_override("font_color", Color(0.5, 0.45, 0.4))
		btn.add_theme_color_override("font_disabled_color", Color(0.5, 0.45, 0.4))
