## Renders page content to BBCode strings.
## Pure rendering logic - no state management or side effects.
## Extracted from book_page.gd for separation of concerns.
##
## Usage:
##   var renderer = PageContentRenderer.new()
##   var bbcode = renderer.render_room(room, events)
##   page.label.text = bbcode
class_name PageContentRenderer
extends RefCounted

# =============================================================================
# Color Constants (consistent theming)
# =============================================================================

const TITLE_COLOR := "#100a04"
const BODY_COLOR := "#181008"
const SECONDARY_COLOR := "#201408"
const EVENT_COLOR := "#302010"
const ENTITY_TITLE_COLOR := "#2a1f14"
const ENTITY_BODY_COLOR := "#362816"
const ACTION_COLOR := "#4a3828"
const PLAYER_COLOR := "#1a3a2a"
const CHOICE_COLOR := "#4a3828"
const DIALOGUE_EVENT_COLOR := "#5a4a3a"
const MENU_TITLE_COLOR := "#2a1f14"
const TAB_COLOR := "#4a3828"
const TAB_ACTIVE_COLOR := "#2a1a0a"
const SEPARATOR_COLOR := "#8a7a6a"


# =============================================================================
# Room Rendering
# =============================================================================

## Render room content to BBCode
## Returns: BBCode string for the room view
func render_room(room: MockWorld.Room, events: Array) -> String:
	if room == null:
		return ""

	var text := ""

	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [TITLE_COLOR, room.name]
	text += "[color=%s]%s[/color]\n" % [BODY_COLOR, room.description]

	if room.npcs.size() > 0:
		var npc_texts: Array[String] = []
		for npc in room.npcs:
			var npc_text := npc.long_desc if npc.long_desc != "" else "%s is here." % npc.name
			npc_text = npc_text.replace("\n", " ").replace("  ", " ")
			var keyword: String = npc.primary_keyword if npc.primary_keyword else ""
			var npc_key: String = npc.key if npc.key else ""
			if keyword != "" and keyword in npc_text and npc_key != "":
				npc_text = npc_text.replace(keyword, "[url=npc:%s][u]%s[/u][/url]" % [npc_key, keyword])
			npc_texts.append(npc_text)
		text += "[color=%s]%s[/color]\n" % [SECONDARY_COLOR, " ".join(npc_texts)]

	if room.items.size() > 0:
		var item_texts: Array[String] = []
		for item in room.items:
			var item_text := item.long_desc if item.long_desc != "" else "%s lies here." % item.name
			item_text = item_text.replace("\n", " ").replace("  ", " ")
			var keyword: String = item.primary_keyword if item.primary_keyword else ""
			var item_key: String = item.key if item.key else ""
			if keyword != "" and keyword in item_text and item_key != "":
				item_text = item_text.replace(keyword, "[url=item:%s][u]%s[/u][/url]" % [item_key, keyword])
			item_texts.append(item_text)
		text += "[color=%s]%s[/color]\n" % [SECONDARY_COLOR, " ".join(item_texts)]

	if events.size() > 0:
		text += "\n"
		for event in events:
			text += "[color=%s][i]%s[/i][/color]\n" % [EVENT_COLOR, event["text"]]

	return text


# =============================================================================
# Entity Rendering
# =============================================================================

## Render entity details to BBCode
## Returns: Dictionary with "text" (BBCode) and "actions" (Array of action keys)
func render_entity(entity: Variant) -> Dictionary:
	if entity == null:
		return {"text": "", "actions": []}

	var text := ""
	var actions: Array = []

	var entity_name: String = _get_entity_prop(entity, "name", "Unknown")
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [ENTITY_TITLE_COLOR, entity_name]

	var desc: String = _get_entity_prop(entity, "description", "")
	if desc == "":
		desc = _get_entity_prop(entity, "long_desc", "")
	if desc == "":
		desc = entity_name
	desc = desc.replace("\n", " ").replace("  ", " ")
	text += "[color=%s]%s[/color]\n\n" % [ENTITY_BODY_COLOR, desc]

	var entity_actions: Array = _get_entity_prop(entity, "actions", [])

	text += "\n"
	for action in entity_actions:
		var action_key: String = action.get("key", "") if action is Dictionary else str(action)
		var action_label: String = action.get("label", action_key.capitalize()) if action is Dictionary else action_key.capitalize()
		actions.append(action_key)
		text += "[color=%s][url=action:%s][u]%s[/u][/url][/color]\n\n" % [ACTION_COLOR, action_key, action_label]

	if "leave" not in actions:
		actions.append("leave")
		text += "[color=%s][url=action:leave][u]Leave[/u][/url][/color]\n" % ACTION_COLOR

	return {"text": text, "actions": actions}


# =============================================================================
# Dialogue Rendering
# =============================================================================

## Render dialogue to BBCode
## Parameters:
##   data: Current dialogue node data (speaker, text, choices)
##   history: Array of dialogue history entries
## Returns: BBCode string
func render_dialogue(data: Dictionary, history: Array) -> String:
	if data.is_empty():
		return ""

	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	speaker = speaker.capitalize()

	var text := ""
	text += "[center][font_size=26][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [ENTITY_TITLE_COLOR, speaker]

	for entry in history:
		var entry_speaker: String = entry.get("speaker", "").capitalize()
		var entry_text: String = entry.get("text", "")
		var is_player: bool = entry.get("is_player", false)
		var entry_event: String = entry.get("event", "")

		if is_player:
			if entry_event != "":
				text += "[color=%s][%s][/color]\n" % [DIALOGUE_EVENT_COLOR, entry_event]
			text += "[color=%s]You say, [i]\"%s\"[/i][/color]\n\n" % [PLAYER_COLOR, entry_text]
		else:
			text += "[color=%s]%s says, \"%s\"[/color]\n\n" % [ENTITY_BODY_COLOR, entry_speaker, entry_text]

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
# Menu Rendering
# =============================================================================

## Menu tab enum (mirrors BookPage.MenuTab)
enum MenuTab { INVENTORY, EQUIPMENT, CHARACTER, QUESTS, MAP, SOCIAL, SETTINGS }

## Render menu header and tab bar
## Parameters:
##   current_tab: Currently selected MenuTab
##   menu_renderer: MenuTabRenderer instance for tab content
## Returns: BBCode string
func render_menu(current_tab: int, menu_renderer: MenuTabRenderer) -> String:
	var text := ""

	text += "[center][font_size=28][color=%s][b]Menu[/b][/color][/font_size][/center]\n\n" % MENU_TITLE_COLOR

	# Tab bar with clickable icons
	text += "[center]"
	var tabs := [
		{"key": "inventory", "icon": "Inv", "tab": MenuTab.INVENTORY},
		{"key": "equipment", "icon": "Eq", "tab": MenuTab.EQUIPMENT},
		{"key": "character", "icon": "Char", "tab": MenuTab.CHARACTER},
		{"key": "quests", "icon": "Qst", "tab": MenuTab.QUESTS},
		{"key": "map", "icon": "Map", "tab": MenuTab.MAP},
		{"key": "social", "icon": "Soc", "tab": MenuTab.SOCIAL},
		{"key": "settings", "icon": "Set", "tab": MenuTab.SETTINGS},
	]

	for tab in tabs:
		var is_active: bool = current_tab == tab.tab
		if is_active:
			text += "[color=%s][b][url=menu:%s]%s[/url][/b][/color]  " % [TAB_ACTIVE_COLOR, tab.key, tab.icon]
		else:
			text += "[color=%s][url=menu:%s]%s[/url][/color]  " % [TAB_COLOR, tab.key, tab.icon]

	text += "[/center]\n"
	text += "[color=%s]-------------------[/color]\n\n" % SEPARATOR_COLOR

	# Delegate to MenuTabRenderer for tab content
	match current_tab:
		MenuTab.INVENTORY:
			text += menu_renderer.get_inventory_content()
		MenuTab.EQUIPMENT:
			text += menu_renderer.get_equipment_content()
		MenuTab.CHARACTER:
			text += menu_renderer.get_character_content()
		MenuTab.QUESTS:
			text += menu_renderer.get_quests_content()
		MenuTab.MAP:
			text += menu_renderer.get_map_content()
		MenuTab.SOCIAL:
			text += menu_renderer.get_social_content()
		MenuTab.SETTINGS:
			text += menu_renderer.get_settings_content()

	return text


# =============================================================================
# Utility Functions
# =============================================================================

func _get_entity_prop(entity: Variant, prop: String, default: Variant = "") -> Variant:
	if entity is Dictionary:
		return entity.get(prop, default)
	else:
		var value = entity.get(prop)
		if value == null:
			return default
		return value
