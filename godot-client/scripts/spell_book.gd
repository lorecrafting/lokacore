## Spell Book Panel
## Displays Sanskrit magic words grouped by type (RUPA, TATTVA, GUNA).
## Allows combining words to create mantras and assigning to quick slots.
## Handles stratum-gated word display based on INT requirements.
extends Panel
class_name SpellBook

## Emitted when a mantra is assigned to a quick slot
signal slot_assigned(slot_index: int, mantra_data: Dictionary)

## Emitted when the panel is closed
signal closed

# =============================================================================
# Constants
# =============================================================================

## Word types (order matters for display)
enum WordType { RUPA, TATTVA, GUNA }

## Stratum INT requirements
const STRATUM_INT := {
	1: 30,  # Everyone - hybrids, fighters with cantrips
	2: 50,  # Semi-dedicated casters
	3: 70   # Pure mages only
}

const QUICK_SLOT_COUNT := 5

## Type labels for display
const TYPE_LABELS := {
	WordType.RUPA: "RUPA (Form)",
	WordType.TATTVA: "TATTVA (Element)",
	WordType.GUNA: "GUNA (Modifier)"
}

## Type descriptions
const TYPE_DESCRIPTIONS := {
	WordType.RUPA: "How the spell travels",
	WordType.TATTVA: "What the spell does",
	WordType.GUNA: "Power modifier"
}

# =============================================================================
# State
# =============================================================================

## Currently known words (loaded from server/mock)
var known_words: Array = []

## All available words (for learning display)
var all_words: Array = []

## Current mantra being built
var building_mantra: Array = []

## Quick slots data
var quick_slots: Array = []

## Player stats (for stratum calculation)
var player_stats: Dictionary = {
	"int": 10,
	"spi": 10
}

# =============================================================================
# UI References
# =============================================================================

var close_button: Button
var word_container: VBoxContainer
var mantra_builder: HBoxContainer
var mantra_label: Label
var clear_mantra_btn: Button
var slot_container: HBoxContainer
var slot_buttons: Array = []
var stratum_label: Label

# =============================================================================
# Lifecycle
# =============================================================================

func _ready() -> void:
	_build_ui()
	_initialize_state()
	_update_display()


func _build_ui() -> void:
	# Panel styling
	self.size = Vector2(420, 650)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.06, 0.12, 0.98)
	style.border_color = Color(0.4, 0.3, 0.5)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	add_theme_stylebox_override("panel", style)

	# Main layout
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 10)
	vbox.set_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_KEEP_SIZE, 15)
	add_child(vbox)

	# Header with title and close button
	var header := HBoxContainer.new()

	var title := Label.new()
	title.text = "Spell Book"
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.8, 0.7, 0.9))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)

	close_button = Button.new()
	close_button.text = "X"
	close_button.custom_minimum_size = Vector2(32, 32)
	close_button.pressed.connect(_on_close_pressed)
	header.add_child(close_button)

	vbox.add_child(header)

	# Stratum info
	stratum_label = Label.new()
	stratum_label.add_theme_font_size_override("font_size", 14)
	stratum_label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.7))
	vbox.add_child(stratum_label)

	# Separator
	vbox.add_child(HSeparator.new())

	# Mantra Builder section
	var builder_title := Label.new()
	builder_title.text = "Building Mantra:"
	builder_title.add_theme_color_override("font_color", Color(0.7, 0.65, 0.8))
	vbox.add_child(builder_title)

	mantra_builder = HBoxContainer.new()
	mantra_builder.add_theme_constant_override("separation", 8)

	mantra_label = Label.new()
	mantra_label.text = "(Select words below)"
	mantra_label.add_theme_color_override("font_color", Color(0.9, 0.85, 0.7))
	mantra_label.add_theme_font_size_override("font_size", 18)
	mantra_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mantra_builder.add_child(mantra_label)

	clear_mantra_btn = Button.new()
	clear_mantra_btn.text = "Clear"
	clear_mantra_btn.custom_minimum_size = Vector2(60, 28)
	clear_mantra_btn.pressed.connect(_on_clear_mantra)
	clear_mantra_btn.disabled = true
	mantra_builder.add_child(clear_mantra_btn)

	vbox.add_child(mantra_builder)

	# Quick slots
	var slots_title := Label.new()
	slots_title.text = "Quick Slots (tap to assign):"
	slots_title.add_theme_color_override("font_color", Color(0.7, 0.65, 0.8))
	vbox.add_child(slots_title)

	slot_container = HBoxContainer.new()
	slot_container.add_theme_constant_override("separation", 8)
	slot_container.alignment = BoxContainer.ALIGNMENT_CENTER

	for i in range(QUICK_SLOT_COUNT):
		var slot_btn := Button.new()
		slot_btn.text = str(i + 1)
		slot_btn.custom_minimum_size = Vector2(60, 40)
		slot_btn.tooltip_text = "Slot %d (empty)" % (i + 1)
		slot_btn.pressed.connect(_on_slot_pressed.bind(i))
		slot_container.add_child(slot_btn)
		slot_buttons.append(slot_btn)

	vbox.add_child(slot_container)

	# Separator
	vbox.add_child(HSeparator.new())

	# Scrollable word list
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED

	word_container = VBoxContainer.new()
	word_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	word_container.add_theme_constant_override("separation", 6)
	scroll.add_child(word_container)

	vbox.add_child(scroll)


func _initialize_state() -> void:
	# Initialize empty quick slots
	quick_slots.clear()
	for i in range(QUICK_SLOT_COUNT):
		quick_slots.append(null)


# =============================================================================
# Public API
# =============================================================================

## Set player stats (affects stratum access)
func set_player_stats(stats: Dictionary) -> void:
	player_stats = stats
	_update_display()


## Set known words from server/mock data
func set_known_words(words: Array) -> void:
	known_words = words
	_update_display()


## Set all available words (for learning display)
func set_all_words(words: Array) -> void:
	all_words = words
	_update_display()


## Set quick slots from server/mock data
func set_quick_slots(slots: Array) -> void:
	quick_slots = slots
	_update_slot_display()


## Reset the spell book state
func reset() -> void:
	building_mantra.clear()
	_initialize_state()
	_update_display()


# =============================================================================
# Display
# =============================================================================

func _update_display() -> void:
	_update_stratum_display()
	_update_word_list()
	_update_mantra_display()
	_update_slot_display()


func _update_stratum_display() -> void:
	var int_val: int = player_stats.get("int", 10)
	var max_stratum := _get_max_stratum(int_val)

	if max_stratum == 0:
		stratum_label.text = "Stratum: None (INT %d, need %d for First)" % [int_val, STRATUM_INT[1]]
		stratum_label.add_theme_color_override("font_color", Color(0.5, 0.4, 0.4))
	elif max_stratum == 1:
		stratum_label.text = "Stratum: First (INT %d, need %d for Second)" % [int_val, STRATUM_INT[2]]
		stratum_label.add_theme_color_override("font_color", Color(0.6, 0.7, 0.6))
	elif max_stratum == 2:
		stratum_label.text = "Stratum: Second (INT %d, need %d for Third)" % [int_val, STRATUM_INT[3]]
		stratum_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.9))
	else:
		stratum_label.text = "Stratum: Third (INT %d) - All words unlocked!" % int_val
		stratum_label.add_theme_color_override("font_color", Color(0.9, 0.8, 0.5))


func _update_word_list() -> void:
	# Clear existing
	for child in word_container.get_children():
		child.queue_free()

	# Group words by type
	var words_by_type: Dictionary = {
		WordType.RUPA: [],
		WordType.TATTVA: [],
		WordType.GUNA: []
	}

	# Collect known words
	for word in known_words:
		var word_type: int = _parse_word_type(word.get("type", "tattva"))
		if word_type >= 0:
			words_by_type[word_type].append(word)

	# Add unknown words from all_words (grayed out)
	var known_keys := []
	for word in known_words:
		known_keys.append(word.get("key", ""))

	for word in all_words:
		var key: String = word.get("key", "")
		if key not in known_keys:
			var word_copy: Dictionary = word.duplicate()
			word_copy["_unknown"] = true
			var word_type: int = _parse_word_type(word.get("type", "tattva"))
			if word_type >= 0:
				words_by_type[word_type].append(word_copy)

	# Create sections for each type
	for type_enum in [WordType.RUPA, WordType.TATTVA, WordType.GUNA]:
		var words: Array = words_by_type[type_enum]
		if words.is_empty():
			continue

		# Type header
		var type_header := Label.new()
		type_header.text = TYPE_LABELS[type_enum]
		type_header.add_theme_font_size_override("font_size", 16)
		type_header.add_theme_color_override("font_color", Color(0.8, 0.75, 0.9))
		word_container.add_child(type_header)

		var type_desc := Label.new()
		type_desc.text = TYPE_DESCRIPTIONS[type_enum]
		type_desc.add_theme_font_size_override("font_size", 12)
		type_desc.add_theme_color_override("font_color", Color(0.5, 0.5, 0.6))
		word_container.add_child(type_desc)

		# Word buttons in a flow container
		var flow := HFlowContainer.new()
		flow.add_theme_constant_override("h_separation", 6)
		flow.add_theme_constant_override("v_separation", 6)

		for word in words:
			var btn := _create_word_button(word)
			flow.add_child(btn)

		word_container.add_child(flow)

		# Spacer
		var spacer := Control.new()
		spacer.custom_minimum_size = Vector2(0, 8)
		word_container.add_child(spacer)


func _create_word_button(word: Dictionary) -> Button:
	var btn := Button.new()
	var name: String = word.get("name", word.get("key", "???"))
	var is_unknown: bool = word.get("_unknown", false)
	var is_in_mantra: bool = word.get("key", "") in building_mantra

	btn.text = name
	btn.custom_minimum_size = Vector2(80, 36)

	# Tooltip with details
	var english: String = word.get("english", "")
	var stratum: int = word.get("stratum", 1)
	var mana_cost: int = word.get("mana_cost", 5)
	var description: String = word.get("description", "")

	var tooltip_text := "%s (%s)\nStratum %d | %d mana\n%s" % [name, english, stratum, mana_cost, description]
	if is_unknown:
		var int_req: int = word.get("int_required", 30)
		var spi_req: int = word.get("spi_required", 0)
		tooltip_text += "\n[Requires INT %d" % int_req
		if spi_req > 0:
			tooltip_text += ", SPI %d" % spi_req
		tooltip_text += "]"
	btn.tooltip_text = tooltip_text

	if is_unknown:
		btn.disabled = true
		btn.modulate = Color(0.4, 0.4, 0.5, 0.7)
	elif is_in_mantra:
		btn.modulate = Color(0.6, 0.9, 0.6)

	if not is_unknown:
		btn.pressed.connect(_on_word_pressed.bind(word))

	return btn


func _update_mantra_display() -> void:
	if building_mantra.is_empty():
		mantra_label.text = "(Select words below)"
		mantra_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
		clear_mantra_btn.disabled = true
	else:
		# Build display name
		var names: Array = []
		for key in building_mantra:
			var word := _find_word_by_key(key)
			if word:
				names.append(word.get("name", key.to_upper()))

		mantra_label.text = " ".join(names)
		mantra_label.add_theme_color_override("font_color", Color(0.9, 0.85, 0.7))
		clear_mantra_btn.disabled = false


func _update_slot_display() -> void:
	for i in range(QUICK_SLOT_COUNT):
		var slot_data = quick_slots[i] if i < quick_slots.size() else null
		var btn: Button = slot_buttons[i]

		if slot_data == null or slot_data.get("name", "") == "":
			btn.text = str(i + 1)
			btn.tooltip_text = "Slot %d (empty)\nBuild a mantra and tap to assign" % (i + 1)
			btn.modulate = Color(0.6, 0.6, 0.6)
		else:
			var slot_name: String = slot_data.get("name", "???")
			# Abbreviate long names
			if slot_name.length() > 8:
				btn.text = slot_name.left(7) + "."
			else:
				btn.text = slot_name
			btn.tooltip_text = "Slot %d: %s\nTap to replace" % [(i + 1), slot_name]
			btn.modulate = Color(0.8, 0.9, 0.8)


# =============================================================================
# Event Handlers
# =============================================================================

func _on_word_pressed(word: Dictionary) -> void:
	var key: String = word.get("key", "")
	if key.is_empty():
		return

	# Toggle word in building mantra
	if key in building_mantra:
		building_mantra.erase(key)
	else:
		# Limit to 3 words max (RUPA + TATTVA + GUNA)
		if building_mantra.size() < 3:
			building_mantra.append(key)

	_update_display()


func _on_clear_mantra() -> void:
	building_mantra.clear()
	_update_display()


func _on_slot_pressed(slot_index: int) -> void:
	if building_mantra.is_empty():
		# If no mantra building, clear the slot
		if quick_slots[slot_index] != null:
			quick_slots[slot_index] = null
			_update_slot_display()
			slot_assigned.emit(slot_index, {})
		return

	# Build mantra data
	var names: Array = []
	var words: Array = []
	var total_mana := 0

	for key in building_mantra:
		var word := _find_word_by_key(key)
		if word:
			names.append(word.get("name", key.to_upper()))
			words.append(key)
			total_mana += word.get("mana_cost", 5)

	var mantra_data := {
		"name": " ".join(names),
		"words": words,
		"mana_cost": total_mana
	}

	# Assign to slot
	quick_slots[slot_index] = mantra_data
	_update_slot_display()

	# Clear building mantra
	building_mantra.clear()
	_update_display()

	# Emit signal
	slot_assigned.emit(slot_index, mantra_data)


func _on_close_pressed() -> void:
	closed.emit()


# =============================================================================
# Helpers
# =============================================================================

func _get_max_stratum(int_val: int) -> int:
	if int_val >= STRATUM_INT[3]:
		return 3
	elif int_val >= STRATUM_INT[2]:
		return 2
	elif int_val >= STRATUM_INT[1]:
		return 1
	else:
		return 0


func _parse_word_type(type_string: String) -> int:
	match type_string.to_lower():
		"rupa":
			return WordType.RUPA
		"tattva":
			return WordType.TATTVA
		"guna":
			return WordType.GUNA
		_:
			return -1


func _find_word_by_key(key: String) -> Dictionary:
	for word in known_words:
		if word.get("key", "") == key:
			return word
	for word in all_words:
		if word.get("key", "") == key:
			return word
	return {}
