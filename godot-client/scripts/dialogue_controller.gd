## Manages dialogue state and rendering for the book page.
## Extracted from book_page.gd for separation of concerns.
class_name DialogueController
extends RefCounted

# Color scheme
const TITLE_COLOR := "#2a1f14"
const BODY_COLOR := "#362816"
const PLAYER_COLOR := "#1a3a2a"
const CHOICE_COLOR := "#4a3828"
const EVENT_COLOR := "#5a4a3a"

## Current dialogue data from server
var dialogue_data: Dictionary = {}

## Dialogue history for conversation log
var dialogue_history: Array = []

## Page to return to after dialogue ends
var pre_dialogue_page: int = 0  # PageType.ROOM

## Mock dialogue state
var _mock_dialogue_node: int = 0
var _is_mock_dialogue: bool = false

## Reference to current entity being talked to
var current_entity: Variant = null


## Reset dialogue state
func reset() -> void:
	dialogue_data = {}
	dialogue_history = []
	_mock_dialogue_node = 0
	_is_mock_dialogue = false


## Start dialogue with given data
func start_dialogue(data: Dictionary, from_page: int) -> void:
	dialogue_data = data
	pre_dialogue_page = from_page
	_is_mock_dialogue = false

	# Add initial NPC line to history
	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	var text: String = data.get("text", "")
	text = text.replace("\n", " ").replace("  ", " ")

	_add_npc_line_to_history(speaker, text)


## Update dialogue with new data
func update_dialogue(data: Dictionary) -> void:
	dialogue_data = data

	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	var text: String = data.get("text", "")
	text = text.replace("\n", " ").replace("  ", " ")

	_add_npc_line_to_history(speaker, text)


## Add NPC line to history (avoids duplicates)
func _add_npc_line_to_history(speaker: String, text: String) -> void:
	var should_add := true
	if not dialogue_history.is_empty():
		var last_entry: Dictionary = dialogue_history[-1]
		if last_entry.get("speaker") == speaker and last_entry.get("text") == text and not last_entry.get("is_player", false):
			should_add = false

	if should_add:
		dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})


## Add player's choice to history
func add_player_choice(choice_text: String, choice_event: String = "") -> void:
	dialogue_history.append({
		"speaker": "You",
		"text": choice_text,
		"is_player": true,
		"event": choice_event
	})


## Render dialogue content to BBCode
func render() -> String:
	if dialogue_data.is_empty():
		return ""

	var speaker: String = dialogue_data.get("speaker", "")
	if speaker == "":
		speaker = dialogue_data.get("entity_id", "Someone")
	speaker = speaker.capitalize()

	var text := ""
	text += "[center][font_size=26][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [TITLE_COLOR, speaker]

	# Render history
	for entry in dialogue_history:
		var entry_speaker: String = entry.get("speaker", "").capitalize()
		var entry_text: String = entry.get("text", "")
		var is_player: bool = entry.get("is_player", false)
		var entry_event: String = entry.get("event", "")

		if is_player:
			if entry_event != "":
				text += "[color=%s][%s][/color]\n" % [EVENT_COLOR, entry_event]
			text += "[color=%s]You say, [i]\"%s\"[/i][/color]\n\n" % [PLAYER_COLOR, entry_text]
		else:
			text += "[color=%s]%s says, \"%s\"[/color]\n\n" % [BODY_COLOR, entry_speaker, entry_text]

	# Render choices
	var choices: Array = dialogue_data.get("choices", [])
	if choices.size() > 0:
		for i in range(choices.size()):
			var choice: Dictionary = choices[i]
			var choice_text: String = choice.get("text", "Continue")
			text += "[color=%s][url=%d][u]%s[/u][/url][/color]\n\n" % [CHOICE_COLOR, i, choice_text]
	else:
		text += "[color=%s][url=-1][u]Continue[/u][/url][/color]\n\n" % CHOICE_COLOR

	return text


## Render dialogue using GameState as source of truth
func render_from_game_state() -> String:
	var data: Dictionary = GameState.dialogue_data
	if data.is_empty():
		return ""

	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	speaker = speaker.capitalize()

	var text := ""
	text += "[center][font_size=26][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [TITLE_COLOR, speaker]

	# Use GameState's dialogue_history
	for entry in GameState.dialogue_history:
		var entry_speaker: String = entry.get("speaker", "").capitalize()
		var entry_text: String = entry.get("text", "")
		var is_player: bool = entry.get("is_player", false)
		var entry_event: String = entry.get("event", "")

		if is_player:
			if entry_event != "":
				text += "[color=%s][%s][/color]\n" % [EVENT_COLOR, entry_event]
			text += "[color=%s]You say, [i]\"%s\"[/i][/color]\n\n" % [PLAYER_COLOR, entry_text]
		else:
			text += "[color=%s]%s says, \"%s\"[/color]\n\n" % [BODY_COLOR, entry_speaker, entry_text]

	var choices: Array = data.get("choices", [])
	if choices.size() > 0:
		for i in range(choices.size()):
			var choice: Dictionary = choices[i]
			var choice_text: String = choice.get("text", "Continue")
			text += "[color=%s][url=%d][u]%s[/u][/url][/color]\n\n" % [CHOICE_COLOR, i, choice_text]
	else:
		text += "[color=%s][url=-1][u]Continue[/u][/url][/color]\n\n" % CHOICE_COLOR

	return text


# =============================================================================
# Mock Dialogue (Offline Testing)
# =============================================================================

func start_mock_dialogue(entity: Variant, from_page: int) -> void:
	current_entity = entity
	_mock_dialogue_node = 0
	_is_mock_dialogue = true
	pre_dialogue_page = from_page

	var mock_data := _get_mock_dialogue_node(entity, 0)
	dialogue_data = mock_data
	dialogue_history = []

	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})


func is_mock_dialogue() -> bool:
	return _is_mock_dialogue


func advance_mock_dialogue(_choice_index: int) -> bool:
	"""Returns true if dialogue should end."""
	_mock_dialogue_node += 1

	if _mock_dialogue_node >= 2:
		return true

	var mock_data := _get_mock_dialogue_node(current_entity, _mock_dialogue_node)
	dialogue_data = mock_data

	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})

	return false


func _get_mock_dialogue_node(entity: Variant, node_index: int) -> Dictionary:
	var entity_name: String = _get_entity_prop(entity, "name", "Someone") if entity else "Someone"
	var entity_key: String = _get_entity_prop(entity, "key", "unknown") if entity else "unknown"

	if node_index == 0:
		return {
			"entity_id": entity_key,
			"node_id": "start",
			"speaker": entity_name,
			"text": "Greetings, traveler. The mountain has been expecting you. Strange happenings have befallen our monastery of late.",
			"choices": [
				{"text": "Tell me more about these happenings."},
				{"text": "I'm just passing through."},
				{"text": "Farewell."}
			]
		}
	else:
		return {
			"entity_id": entity_key,
			"node_id": "more_info",
			"speaker": entity_name,
			"text": "The demons have grown restless. Master Tenzin went to investigate the old temple, but has not returned. We fear the worst.",
			"choices": [
				{"text": "I will find him.", "event": "Accept Quest"},
				{"text": "That sounds dangerous."}
			]
		}


func _get_entity_prop(entity: Variant, prop: String, default: Variant = "") -> Variant:
	if entity is Dictionary:
		return entity.get(prop, default)
	else:
		var value = entity.get(prop)
		if value == null:
			return default
		return value
