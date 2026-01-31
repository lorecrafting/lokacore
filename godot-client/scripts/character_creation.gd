## Character Creation Panel
## Handles stat allocation for new characters.
## Displays the 6 stats (STR, DEX, CON, INT, PER, SPI) with +/- buttons.
## Shows derived stats (HP, Mana, MV) in real-time.
## Enforces: 60 total points, min 5 per stat, max 30 per stat.
extends Panel
class_name CharacterCreation

## Emitted when character is created successfully
signal character_created(stats: Dictionary)

## Emitted when creation is cancelled
signal creation_cancelled

# =============================================================================
# Constants (matching server balance.yml)
# =============================================================================

const TOTAL_POINTS := 60
const MIN_STAT := 5
const MAX_STAT := 30
const DEFAULT_STAT := 10

# Derived stat formulas (matching Loka.Mechanics.CharacterResources)
# HP = 50 + (CON * 4) + (level * 2) - at level 1
# Mana = 20 + (INT * 3) + (SPI * 2)
# MV = 100 + (CON * 2) + (DEX * 2)
const HP_BASE := 50
const HP_CON_MULT := 4
const HP_LEVEL_MULT := 2
const MANA_BASE := 20
const MANA_INT_MULT := 3
const MANA_SPI_MULT := 2
const MV_BASE := 100
const MV_CON_MULT := 2
const MV_DEX_MULT := 2

# =============================================================================
# UI References
# =============================================================================

var name_input: LineEdit
var create_button: Button
var cancel_button: Button
var error_label: Label
var points_label: Label

# Stat controls: {stat_key: {value_label, minus_btn, plus_btn}}
var stat_controls: Dictionary = {}

# Derived stat labels
var hp_label: Label
var mana_label: Label
var mv_label: Label

# =============================================================================
# State
# =============================================================================

var stats: Dictionary = {
	"str": DEFAULT_STAT,
	"dex": DEFAULT_STAT,
	"con": DEFAULT_STAT,
	"int": DEFAULT_STAT,
	"per": DEFAULT_STAT,
	"spi": DEFAULT_STAT
}


func _ready() -> void:
	_build_ui()
	_update_display()


func _build_ui() -> void:
	# Panel styling
	self.size = Vector2(380, 600)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.10, 0.08, 0.98)
	style.border_color = Color(0.4, 0.35, 0.28)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	add_theme_stylebox_override("panel", style)

	# Main VBox
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 8)
	vbox.set_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_KEEP_SIZE, 20)
	add_child(vbox)

	# Title
	var title := Label.new()
	title.text = "Create Your Character"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(0.9, 0.85, 0.7))
	vbox.add_child(title)

	# Name input
	var name_hbox := HBoxContainer.new()
	var name_label := Label.new()
	name_label.text = "Name:"
	name_label.add_theme_color_override("font_color", Color(0.8, 0.75, 0.65))
	name_label.custom_minimum_size.x = 60
	name_hbox.add_child(name_label)

	name_input = LineEdit.new()
	name_input.placeholder_text = "Enter name..."
	name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_hbox.add_child(name_input)
	vbox.add_child(name_hbox)

	# Points remaining
	points_label = Label.new()
	points_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	points_label.add_theme_font_size_override("font_size", 16)
	points_label.add_theme_color_override("font_color", Color(0.7, 0.65, 0.5))
	vbox.add_child(points_label)

	# Separator
	vbox.add_child(HSeparator.new())

	# Stats section title
	var stats_title := Label.new()
	stats_title.text = "Allocate Stats"
	stats_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stats_title.add_theme_color_override("font_color", Color(0.8, 0.75, 0.65))
	vbox.add_child(stats_title)

	# Stats grid
	var stats_grid := GridContainer.new()
	stats_grid.columns = 2
	stats_grid.add_theme_constant_override("h_separation", 20)
	stats_grid.add_theme_constant_override("v_separation", 10)
	vbox.add_child(stats_grid)

	# Create stat rows
	_add_stat_row(stats_grid, "str", "STR", "Strength - Physical power, slashing damage")
	_add_stat_row(stats_grid, "int", "INT", "Intelligence - Mana pool, spell power")
	_add_stat_row(stats_grid, "dex", "DEX", "Dexterity - Speed, piercing damage, dodge")
	_add_stat_row(stats_grid, "per", "PER", "Perception - Crit chance, awareness")
	_add_stat_row(stats_grid, "con", "CON", "Constitution - HP, bludgeon damage, poison resist")
	_add_stat_row(stats_grid, "spi", "SPI", "Spirit - Healing power, magic resist")

	# Separator
	vbox.add_child(HSeparator.new())

	# Derived stats section
	var derived_title := Label.new()
	derived_title.text = "Derived Stats (at Level 1)"
	derived_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	derived_title.add_theme_color_override("font_color", Color(0.8, 0.75, 0.65))
	vbox.add_child(derived_title)

	var derived_hbox := HBoxContainer.new()
	derived_hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	derived_hbox.add_theme_constant_override("separation", 30)

	hp_label = _create_derived_label("HP: 0")
	mana_label = _create_derived_label("Mana: 0")
	mv_label = _create_derived_label("MV: 0")

	derived_hbox.add_child(hp_label)
	derived_hbox.add_child(mana_label)
	derived_hbox.add_child(mv_label)
	vbox.add_child(derived_hbox)

	# Error label
	error_label = Label.new()
	error_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	error_label.add_theme_color_override("font_color", Color(0.9, 0.3, 0.3))
	error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(error_label)

	# Spacer
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(spacer)

	# Buttons
	var button_hbox := HBoxContainer.new()
	button_hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	button_hbox.add_theme_constant_override("separation", 20)

	cancel_button = Button.new()
	cancel_button.text = "Cancel"
	cancel_button.custom_minimum_size = Vector2(100, 40)
	cancel_button.pressed.connect(_on_cancel_pressed)
	button_hbox.add_child(cancel_button)

	create_button = Button.new()
	create_button.text = "Create"
	create_button.custom_minimum_size = Vector2(100, 40)
	create_button.pressed.connect(_on_create_pressed)
	button_hbox.add_child(create_button)

	vbox.add_child(button_hbox)


func _add_stat_row(parent: GridContainer, stat_key: String, stat_name: String, tooltip: String) -> void:
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 6)
	hbox.tooltip_text = tooltip

	# Stat name label
	var name_label := Label.new()
	name_label.text = stat_name
	name_label.custom_minimum_size.x = 40
	name_label.add_theme_color_override("font_color", Color(0.9, 0.85, 0.7))
	hbox.add_child(name_label)

	# Minus button
	var minus_btn := Button.new()
	minus_btn.text = "-"
	minus_btn.custom_minimum_size = Vector2(32, 32)
	minus_btn.pressed.connect(_on_stat_minus.bind(stat_key))
	hbox.add_child(minus_btn)

	# Value label
	var value_label := Label.new()
	value_label.text = str(stats[stat_key])
	value_label.custom_minimum_size.x = 30
	value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	value_label.add_theme_font_size_override("font_size", 18)
	value_label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.8))
	hbox.add_child(value_label)

	# Plus button
	var plus_btn := Button.new()
	plus_btn.text = "+"
	plus_btn.custom_minimum_size = Vector2(32, 32)
	plus_btn.pressed.connect(_on_stat_plus.bind(stat_key))
	hbox.add_child(plus_btn)

	parent.add_child(hbox)

	# Store references
	stat_controls[stat_key] = {
		"value_label": value_label,
		"minus_btn": minus_btn,
		"plus_btn": plus_btn
	}


func _create_derived_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", Color(0.6, 0.8, 0.6))
	return label


# =============================================================================
# Stat Manipulation
# =============================================================================

func _on_stat_minus(stat_key: String) -> void:
	if stats[stat_key] > MIN_STAT:
		stats[stat_key] -= 1
		_update_display()


func _on_stat_plus(stat_key: String) -> void:
	var current_total := _get_total_points()
	if current_total < TOTAL_POINTS and stats[stat_key] < MAX_STAT:
		stats[stat_key] += 1
		_update_display()


func _get_total_points() -> int:
	var total := 0
	for value in stats.values():
		total += value
	return total


func _get_remaining_points() -> int:
	return TOTAL_POINTS - _get_total_points()


# =============================================================================
# Display Update
# =============================================================================

func _update_display() -> void:
	var remaining := _get_remaining_points()

	# Update points label
	if remaining == 0:
		points_label.text = "Points: 0 remaining (ready!)"
		points_label.add_theme_color_override("font_color", Color(0.5, 0.8, 0.5))
	elif remaining < 0:
		points_label.text = "Points: %d over (reduce stats)" % (-remaining)
		points_label.add_theme_color_override("font_color", Color(0.9, 0.4, 0.4))
	else:
		points_label.text = "Points: %d remaining" % remaining
		points_label.add_theme_color_override("font_color", Color(0.7, 0.65, 0.5))

	# Update stat displays and buttons
	for stat_key in stat_controls:
		var controls: Dictionary = stat_controls[stat_key]
		var value: int = stats[stat_key]

		controls.value_label.text = str(value)
		controls.minus_btn.disabled = (value <= MIN_STAT)
		controls.plus_btn.disabled = (value >= MAX_STAT or remaining <= 0)

		# Color code based on value
		if value < DEFAULT_STAT:
			controls.value_label.add_theme_color_override("font_color", Color(0.8, 0.6, 0.6))
		elif value > DEFAULT_STAT:
			controls.value_label.add_theme_color_override("font_color", Color(0.6, 0.8, 0.6))
		else:
			controls.value_label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.8))

	# Update derived stats
	var con_val: int = stats["con"]
	var int_val: int = stats["int"]
	var spi_val: int = stats["spi"]
	var dex_val: int = stats["dex"]
	var hp: int = HP_BASE + (con_val * HP_CON_MULT) + (1 * HP_LEVEL_MULT)
	var mana: int = MANA_BASE + (int_val * MANA_INT_MULT) + (spi_val * MANA_SPI_MULT)
	var mv: int = MV_BASE + (con_val * MV_CON_MULT) + (dex_val * MV_DEX_MULT)

	hp_label.text = "HP: %d" % hp
	mana_label.text = "Mana: %d" % mana
	mv_label.text = "MV: %d" % mv

	# Update create button state
	create_button.disabled = (remaining != 0)


# =============================================================================
# Actions
# =============================================================================

func _on_create_pressed() -> void:
	var char_name := name_input.text.strip_edges()

	# Validate name
	if char_name.is_empty():
		error_label.text = "Please enter a character name."
		return

	if char_name.length() < 2:
		error_label.text = "Name must be at least 2 characters."
		return

	if char_name.length() > 20:
		error_label.text = "Name must be 20 characters or less."
		return

	# Validate stats
	var remaining := _get_remaining_points()
	if remaining != 0:
		error_label.text = "You must allocate exactly %d points." % TOTAL_POINTS
		return

	# Success!
	error_label.text = ""

	var character_data := {
		"name": char_name,
		"stats": stats.duplicate()
	}

	character_created.emit(character_data)


func _on_cancel_pressed() -> void:
	creation_cancelled.emit()


# =============================================================================
# Public API
# =============================================================================

## Reset to default state
func reset() -> void:
	name_input.text = ""
	error_label.text = ""
	stats = {
		"str": DEFAULT_STAT,
		"dex": DEFAULT_STAT,
		"con": DEFAULT_STAT,
		"int": DEFAULT_STAT,
		"per": DEFAULT_STAT,
		"spi": DEFAULT_STAT
	}
	_update_display()


## Pre-fill with suggested stats
func set_suggested_stats(suggested: Dictionary) -> void:
	for key in suggested:
		if key in stats:
			stats[key] = clampi(suggested[key], MIN_STAT, MAX_STAT)
	_update_display()
