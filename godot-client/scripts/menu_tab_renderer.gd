## Renders menu tab content (Inventory, Equipment, Character, Quests, Map, Social, Settings).
## Extracted from book_page.gd for separation of concerns.
class_name MenuTabRenderer
extends RefCounted

# Color scheme for consistent styling
const TITLE_COLOR := "#2a1f14"
const BODY_COLOR := "#362816"
const ITEM_COLOR := "#3a2a1a"
const HINT_COLOR := "#6a5a4a"
const SLOT_COLOR := "#5a4a3a"
const EMPTY_COLOR := "#8a7a6a"
const COMPLETE_COLOR := "#1a4a2a"
const PLAYER_COLOR := "#2a4a3a"
const QUIT_COLOR := "#6b3a2a"
const TAB_COLOR := "#4a3828"
const TAB_ACTIVE_COLOR := "#2a1a0a"
const SEPARATOR_COLOR := "#8a7a6a"
const PATH_COLOR := "#5a4a3a"
const ROOM_COLOR := "#362816"
const CURRENT_ROOM_COLOR := "#1a4a2a"


func get_inventory_content() -> String:
	var text := "[color=%s][b]Your Pack[/b][/color]\n\n" % TITLE_COLOR

	var items: Array = []
	if GameState.is_online:
		items = GameState.server_state.get("inventory", [])
	else:
		items = MockWorld.get_player_inventory()

	if items.is_empty():
		text += "[color=%s][i]Your pack is empty.[/i][/color]\n" % HINT_COLOR
	else:
		for item in items:
			var iname: String = item.get("name", "Unknown")
			var qty: int = item.get("quantity", 1)
			if qty > 1:
				text += "[color=%s]* %s (x%d)[/color]\n" % [ITEM_COLOR, iname, qty]
			else:
				text += "[color=%s]* %s[/color]\n" % [ITEM_COLOR, iname]

	return text


func get_equipment_content() -> String:
	var text := "[color=%s][b]Equipment[/b][/color]\n\n" % TITLE_COLOR

	var equipment: Dictionary = {}
	if GameState.is_online:
		equipment = GameState.server_state.get("equipment", {})
	else:
		equipment = MockWorld.get_player_equipment()

	var slots := [
		{"key": "head", "label": "Head"},
		{"key": "neck", "label": "Neck"},
		{"key": "body", "label": "Body"},
		{"key": "arms", "label": "Arms"},
		{"key": "hands", "label": "Hands"},
		{"key": "waist", "label": "Waist"},
		{"key": "legs", "label": "Legs"},
		{"key": "feet", "label": "Feet"},
		{"key": "main_hand", "label": "Main Hand"},
		{"key": "off_hand", "label": "Off Hand"},
	]

	for slot in slots:
		var slot_key: String = slot.key
		var slot_label: String = slot.label
		var equipped = equipment.get(slot_key, null)

		if equipped != null and equipped is Dictionary:
			var item_name: String = equipped.get("name", "Unknown")
			text += "[color=%s]%s:[/color] [color=%s]%s[/color]\n" % [SLOT_COLOR, slot_label, ITEM_COLOR, item_name]
		else:
			text += "[color=%s]%s:[/color] [color=%s]-- empty --[/color]\n" % [SLOT_COLOR, slot_label, EMPTY_COLOR]

	return text


func get_character_content() -> String:
	var stats: Dictionary = MockWorld.get_player_stats()
	var player_name: String = MockWorld.get_player_name()

	var level: int = stats.get("level", 1)
	var hp: int = stats.get("hp", 100)
	var max_hp: int = stats.get("max_hp", 100)
	var mana: int = stats.get("mana", 50)
	var max_mana: int = stats.get("max_mana", 50)
	var mv: int = stats.get("mv", 100)
	var max_mv: int = stats.get("max_mv", 100)

	var str_val: int = stats.get("str", 10)
	var dex_val: int = stats.get("dex", 10)
	var con_val: int = stats.get("con", 10)
	var int_val: int = stats.get("int", 10)
	var per_val: int = stats.get("per", 10)
	var spi_val: int = stats.get("spi", 10)

	var crit: int = stats.get("crit_chance", 0)
	var dodge: int = stats.get("dodge_chance", 0)
	var magic_resist: int = stats.get("magic_resist", 0)

	var text := "[center][b]" + player_name + "[/b][/center]\n"
	text += "[center]Level " + str(level) + "[/center]\n\n"
	text += "[b]Resources[/b]\n"
	text += "HP:   " + str(hp) + " / " + str(max_hp) + "\n"
	text += "Mana: " + str(mana) + " / " + str(max_mana) + "\n"
	text += "MV:   " + str(mv) + " / " + str(max_mv) + "\n\n"
	text += "[b]Attributes[/b]\n"
	text += "STR " + str(str_val) + "    INT " + str(int_val) + "\n"
	text += "DEX " + str(dex_val) + "    PER " + str(per_val) + "\n"
	text += "CON " + str(con_val) + "    SPI " + str(spi_val) + "\n\n"
	text += "[b]Combat[/b]\n"
	text += "Crit: " + str(crit) + "%  Dodge: " + str(dodge) + "%\n"
	text += "Magic Resist: " + str(magic_resist) + "%\n"

	return text


func get_quests_content() -> String:
	var text := "[color=%s][b]Quests[/b][/color]\n\n" % TITLE_COLOR

	var quests: Array = []
	if GameState.is_online:
		quests = GameState.server_state.get("quests", [])

	if quests.is_empty():
		text += "[color=%s][i]No active quests.[/i][/color]\n\n" % HINT_COLOR
		text += "[color=%s]Talk to NPCs to discover quests.[/color]\n" % HINT_COLOR
	else:
		for quest in quests:
			var quest_name: String = quest.get("title", quest.get("name", "Unknown Quest"))
			var status: String = quest.get("status", "active")
			var objectives: Array = quest.get("objectives", [])

			if status == "completed":
				text += "[color=%s][s]%s[/s] (Complete)[/color]\n" % [COMPLETE_COLOR, quest_name]
			else:
				text += "[color=%s]* %s[/color]\n" % [BODY_COLOR, quest_name]

			for obj in objectives:
				var obj_text: String = obj.get("description", obj.get("text", ""))
				var current: int = obj.get("current", 0)
				var total: int = obj.get("total", 1)
				var obj_complete: bool = obj.get("complete", false) or current >= total

				if obj_complete:
					text += "[color=%s]  [x] %s[/color]\n" % [COMPLETE_COLOR, obj_text]
				elif total > 1:
					text += "[color=%s]  [ ] %s (%d/%d)[/color]\n" % [SLOT_COLOR, obj_text, current, total]
				else:
					text += "[color=%s]  [ ] %s[/color]\n" % [SLOT_COLOR, obj_text]

			text += "\n"

	return text


func get_map_content() -> String:
	var room_positions: Dictionary = _build_room_grid()

	var min_x := 0
	var max_x := 0
	var min_y := 0
	var max_y := 0
	for room_key in room_positions:
		var pos: Vector2i = room_positions[room_key]
		min_x = mini(min_x, pos.x)
		max_x = maxi(max_x, pos.x)
		min_y = mini(min_y, pos.y)
		max_y = maxi(max_y, pos.y)

	var text := "[center]"
	var current_room_key: String = ""
	if GameState.current_room and MockWorld.get_room(GameState.current_room.key) != null:
		current_room_key = GameState.current_room.key
	elif GameState.explored_rooms.size() > 0:
		current_room_key = GameState.explored_rooms[GameState.explored_rooms.size() - 1]

	for y in range(max_y, min_y - 1, -1):
		var row_rooms := ""

		for x in range(min_x, max_x + 1):
			var room_key := _get_room_at_position(room_positions, x, y)

			if room_key != "":
				var room := MockWorld.get_room(room_key)
				var is_current := room_key == current_room_key
				var is_explored := GameState.is_room_explored(room_key)

				if is_explored:
					if is_current:
						row_rooms += "[color=%s][b][.][/b][/color]" % CURRENT_ROOM_COLOR
					else:
						row_rooms += "[color=%s][ ][/color]" % ROOM_COLOR
				else:
					row_rooms += " "

				if x < max_x:
					var east_room_key := _get_room_at_position(room_positions, x + 1, y)
					var show_east_path := false
					if east_room_key != "":
						var east_room := MockWorld.get_room(east_room_key)
						var east_explored := GameState.is_room_explored(east_room_key)
						if is_explored and room and room.exits.has("east"):
							show_east_path = true
						elif east_explored and east_room and east_room.exits.has("west"):
							show_east_path = true
					if show_east_path:
						row_rooms += "[color=%s]-[/color]" % PATH_COLOR
					else:
						row_rooms += " "
			else:
				row_rooms += " "
				if x < max_x:
					row_rooms += " "

		text += row_rooms + "\n"

		if y > min_y:
			var vert_paths := ""
			for x in range(min_x, max_x + 1):
				var room_key := _get_room_at_position(room_positions, x, y)
				var south_room_key := _get_room_at_position(room_positions, x, y - 1)

				var show_path := false
				if room_key != "" and south_room_key != "":
					var room := MockWorld.get_room(room_key)
					var south_room := MockWorld.get_room(south_room_key)
					var room_explored := GameState.is_room_explored(room_key)
					var south_explored := GameState.is_room_explored(south_room_key)

					if room_explored and room and room.exits.has("south"):
						show_path = true
					elif south_explored and south_room and south_room.exits.has("north"):
						show_path = true

				if show_path:
					vert_paths += "[color=%s]|[/color]" % PATH_COLOR
				else:
					vert_paths += " "

				if x < max_x:
					vert_paths += " "
			text += vert_paths + "\n"

	text += "[/center]"
	return text


func get_social_content() -> String:
	var text := "[color=%s][b]Players Nearby[/b][/color]\n\n" % TITLE_COLOR

	var players: Array = GameState.server_state.get("other_players", [])

	if players.is_empty():
		text += "[color=%s][i]No other players nearby.[/i][/color]\n\n" % HINT_COLOR
	else:
		for p in players:
			var pname: String = p.get("name", "Unknown")
			var level: int = p.get("level", 1)
			text += "[color=%s]* %s[/color] [color=%s](Lv.%d)[/color]\n" % [PLAYER_COLOR, pname, HINT_COLOR, level]
		text += "\n"

	var player_name: String = str(AuthClient.player.get("name", "You"))
	text += "[color=%s]-------------------[/color]\n\n" % HINT_COLOR
	text += "[color=%s]You are:[/color] [color=%s]%s[/color]\n" % [HINT_COLOR, BODY_COLOR, player_name]

	if GameState.is_online:
		text += "[color=%s]Status:[/color] [color=#2a6a2a]Online[/color]\n" % HINT_COLOR
	else:
		text += "[color=%s]Status:[/color] [color=#6a3a2a]Offline[/color]\n" % HINT_COLOR

	return text


func get_settings_content() -> String:
	var text := "[color=%s][b]Settings[/b][/color]\n\n" % TITLE_COLOR
	text += "[color=%s][i]Settings coming soon...[/i][/color]\n\n" % HINT_COLOR
	text += "[color=%s]* Sound: On[/color]\n" % TAB_COLOR
	text += "[color=%s]* Music: On[/color]\n" % TAB_COLOR
	text += "\n\n[center][color=%s][url=menu:quit][b][ Quit Game ][/b][/url][/color][/center]" % QUIT_COLOR
	return text


# =============================================================================
# Map Helper Functions
# =============================================================================

func _build_room_grid() -> Dictionary:
	var positions: Dictionary = {}
	var visited: Dictionary = {}
	var queue: Array = []

	var dir_offset := {
		"north": Vector2i(0, 1),
		"south": Vector2i(0, -1),
		"east": Vector2i(1, 0),
		"west": Vector2i(-1, 0)
	}

	var start_key := "monastery_gate"
	var start_room := MockWorld.get_room(start_key)
	if start_room == null:
		for room_key in GameState.explored_rooms:
			var room := MockWorld.get_room(room_key)
			if room != null:
				start_key = room_key
				start_room = room
				break
		if start_room == null:
			return positions

	positions[start_key] = Vector2i(0, 0)
	visited[start_key] = true
	queue.append(start_key)

	while queue.size() > 0:
		var current_key: String = queue.pop_front()
		var current_pos: Vector2i = positions[current_key]
		var room := MockWorld.get_room(current_key)

		if room == null:
			continue

		for direction in room.exits:
			var dest_key: String = room.exits[direction]
			if visited.has(dest_key):
				continue

			var offset: Vector2i = dir_offset.get(direction, Vector2i(0, 0))
			positions[dest_key] = current_pos + offset
			visited[dest_key] = true
			queue.append(dest_key)

	return positions


func _get_room_at_position(positions: Dictionary, x: int, y: int) -> String:
	for room_key in positions:
		var pos: Vector2i = positions[room_key]
		if pos.x == x and pos.y == y:
			return room_key
	return ""
