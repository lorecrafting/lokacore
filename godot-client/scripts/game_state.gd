## Global game state singleton.
## Manages current room, navigation, and server communication.
## Supports both online (Phoenix server) and offline (MockWorld) modes.
## Single source of truth for all game state - views read from here.
extends Node

# =============================================================================
# Page Types
# =============================================================================

enum PageType {
	ROOM,       # Main room view with NPCs, items, description
	MENU,       # Menu tabs (inventory, character, map, social, settings)
	ENTITY,     # Viewing a specific entity (NPC/item detail)
	DIALOGUE,   # In a dialogue with an NPC
	SHOP,       # Shopping interface
	CONTAINER,  # Container/chest interface
}

# =============================================================================
# Signals - Room & Navigation
# =============================================================================

## Emitted when the player moves to a new room
signal room_changed(room: MockWorld.Room)

## Emitted when navigation fails
signal navigation_failed(direction: String, reason: String)

# =============================================================================
# Signals - Connection
# =============================================================================

## Emitted when connected to server
signal server_connected

## Emitted when disconnected from server
signal server_disconnected

## Emitted when forcibly disconnected by server
signal force_disconnect(reason: String)

# =============================================================================
# Signals - Page & UI State
# =============================================================================

## Emitted when current page changes
signal page_changed(new_page: PageType)

## Emitted when current entity changes (for entity page)
signal entity_changed(entity: Dictionary)

## Emitted when event log changes
signal events_changed

# =============================================================================
# Signals - Dialogue
# =============================================================================

## Emitted when dialogue data changes
signal dialogue_changed(data: Dictionary)

## Emitted when dialogue ends
signal dialogue_ended

# =============================================================================
# Signals - Game Events
# =============================================================================

## Emitted when a game event is received (chat, combat feedback, etc.)
signal game_event(event: Dictionary)

## Emitted when entity context is received (after clicking an entity)
signal entity_context_received(entity: Dictionary)

# =============================================================================
# Signals - Character State
# =============================================================================

## Emitted when inventory changes
signal inventory_changed

## Emitted when equipment changes
signal equipment_changed

## Emitted when stats change
signal stats_changed

## Emitted when resources (gold, etc.) change
signal resources_changed

## Emitted when nearby players list changes
signal players_changed

# =============================================================================
# Signals - Shop & Container
# =============================================================================

## Emitted when shop opens
signal shop_opened(data: Dictionary)

## Emitted when shop closes
signal shop_closed

## Emitted when container opens
signal container_opened(data: Dictionary)

## Emitted when container contents update
signal container_updated(data: Dictionary)

## Emitted when container closes
signal container_closed

# =============================================================================
# Signals - Ghost (Death)
# =============================================================================

## Emitted when player dies and becomes a ghost
signal ghost_entered(data: Dictionary)

## Emitted when player resurrects from ghost state
signal ghost_exited

# =============================================================================
# Signals - Quests
# =============================================================================

## Emitted when a quest is accepted
signal quest_accepted(data: Dictionary)

## Emitted when a quest is completed
signal quest_completed(data: Dictionary)

## Emitted when quest progress updates
signal quest_progress(data: Dictionary)

# =============================================================================
# Signals - Atmosphere
# =============================================================================

## Emitted when atmosphere changes (for visual effects)
signal atmosphere_changed(atmosphere: String)

# =============================================================================
# Signals - Map Exploration
# =============================================================================

## Emitted when explored rooms change (for map updates)
signal exploration_changed

# =============================================================================
# State Variables - Room & Connection
# =============================================================================

## Current room the player is in
var current_room: MockWorld.Room = null

## Full server game state (when online)
var server_state: Dictionary = {}

## Whether we're connected to the server
var is_online: bool = false

# =============================================================================
# State Variables - Page & UI
# =============================================================================

## Current page being displayed
var current_page: PageType = PageType.ROOM

## Previous page (for returning after dialogue/shop/etc.)
var previous_page: PageType = PageType.ROOM

## Current entity being viewed on ENTITY page
var current_entity: Dictionary = {}

# =============================================================================
# State Variables - Dialogue
# =============================================================================

## Current dialogue node from server
var dialogue_data: Dictionary = {}

## Conversation history for UI display
var dialogue_history: Array = []

# =============================================================================
# State Variables - Shop & Container
# =============================================================================

## Shop data when on SHOP page
var shop_data: Dictionary = {}

## Container data when on CONTAINER page
var container_data: Dictionary = {}

# =============================================================================
# State Variables - Ghost (Death)
# =============================================================================

## Ghost state when player has died
var ghost_data: Dictionary = {}

# =============================================================================
# State Variables - Event Log
# =============================================================================

## Event log for room events (chat, actions, etc.)
var events: Array[Dictionary] = []

## Maximum events to keep in log
const MAX_EVENTS := 10

# =============================================================================
# State Variables - Atmosphere
# =============================================================================

## Current atmosphere (affects visual mood)
var atmosphere: String = "peaceful"

# =============================================================================
# State Variables - Map Exploration
# =============================================================================

## Rooms that have been explored (for fog of war)
var explored_rooms: Array = []

## Reference to PhoenixClient autoload
var _phoenix: Node = null


func _ready() -> void:
	# Get PhoenixClient reference if available
	if has_node("/root/PhoenixClient"):
		_phoenix = get_node("/root/PhoenixClient")
		_connect_phoenix_signals()

	# Start in offline mode with mock data
	_init_offline_mode()


func _connect_phoenix_signals() -> void:
	if _phoenix == null:
		return

	# Connection signals
	_phoenix.connected.connect(_on_server_connected)
	_phoenix.disconnected.connect(_on_server_disconnected)
	_phoenix.connection_error.connect(_on_connection_error)

	# Core game state signals
	_phoenix.game_state_received.connect(_on_server_game_state)
	_phoenix.room_updated.connect(_on_server_room_update)
	_phoenix.event_received.connect(_on_server_event)
	_phoenix.entity_context_received.connect(_on_entity_context)

	# Dialogue signals
	_phoenix.dialogue_started.connect(_on_dialogue_started)
	_phoenix.dialogue_updated.connect(_on_dialogue_updated)
	_phoenix.dialogue_ended.connect(_on_dialogue_ended)

	# Combat signals (just log for now)
	_phoenix.combat_started.connect(_on_combat_started)
	_phoenix.combat_updated.connect(_on_combat_updated)
	_phoenix.combat_ended.connect(_on_combat_ended)

	# Character state signals (will be added to PhoenixClient)
	if _phoenix.has_signal("inventory_updated"):
		_phoenix.inventory_updated.connect(_on_inventory_update)
	if _phoenix.has_signal("equipment_updated"):
		_phoenix.equipment_updated.connect(_on_equipment_update)
	if _phoenix.has_signal("stats_updated"):
		_phoenix.stats_updated.connect(_on_stats_update)
	if _phoenix.has_signal("resources_updated"):
		_phoenix.resources_updated.connect(_on_resources_update)
	if _phoenix.has_signal("players_updated"):
		_phoenix.players_updated.connect(_on_players_update)

	# Shop/Container signals
	if _phoenix.has_signal("shop_opened"):
		_phoenix.shop_opened.connect(_on_shop_opened)
	if _phoenix.has_signal("shop_closed"):
		_phoenix.shop_closed.connect(_on_shop_closed)
	if _phoenix.has_signal("container_opened"):
		_phoenix.container_opened.connect(_on_container_opened)
	if _phoenix.has_signal("container_updated"):
		_phoenix.container_updated.connect(_on_container_updated)
	if _phoenix.has_signal("container_closed"):
		_phoenix.container_closed.connect(_on_container_closed)

	# Ghost (death) signals
	if _phoenix.has_signal("ghost_entered"):
		_phoenix.ghost_entered.connect(_on_ghost_entered)
	if _phoenix.has_signal("ghost_exited"):
		_phoenix.ghost_exited.connect(_on_ghost_exited)

	# Quest signals
	if _phoenix.has_signal("quest_accepted"):
		_phoenix.quest_accepted.connect(_on_quest_accepted)
	if _phoenix.has_signal("quest_completed"):
		_phoenix.quest_completed.connect(_on_quest_completed)
	if _phoenix.has_signal("quest_progress"):
		_phoenix.quest_progress.connect(_on_quest_progress)

	# Atmosphere signals
	if _phoenix.has_signal("atmosphere_updated"):
		_phoenix.atmosphere_updated.connect(_on_atmosphere_update)

	# Timer signals
	if _phoenix.has_signal("timer_completed"):
		_phoenix.timer_completed.connect(_on_timer_completed)

	# Force disconnect signal
	if _phoenix.has_signal("force_disconnected"):
		_phoenix.force_disconnected.connect(_on_force_disconnect)


func _init_offline_mode() -> void:
	is_online = false
	var start_key := MockWorld.start_room
	current_room = MockWorld.get_room(start_key)
	if current_room:
		mark_room_explored(start_key)
		room_changed.emit(current_room)


# =============================================================================
# Connection Management
# =============================================================================

## Connect to the Phoenix server with an optional JWT token
func connect_to_server(token: String = "") -> void:
	if _phoenix == null:
		push_error("[GameState] PhoenixClient not available")
		return

	_phoenix.connect_to_server(token)


## Disconnect from the server and switch to offline mode
func disconnect_from_server() -> void:
	if _phoenix == null:
		return

	_phoenix.disconnect_from_server()
	_init_offline_mode()


# =============================================================================
# Navigation
# =============================================================================

## Navigate in a direction (north, south, east, west)
func navigate(direction: String) -> bool:
	var dir_lower := direction.to_lower()

	if is_online and _phoenix:
		# Send navigation request to server
		_phoenix.navigate(dir_lower)
		return true
	else:
		# Use offline navigation
		return _navigate_offline(dir_lower)


func _navigate_offline(direction: String) -> bool:
	if current_room == null:
		navigation_failed.emit(direction, "No current room")
		return false

	if not current_room.exits.has(direction):
		navigation_failed.emit(direction, "You cannot go that way.")
		return false

	var destination_key: String = current_room.exits[direction]
	var new_room := MockWorld.get_room(destination_key)

	if new_room == null:
		navigation_failed.emit(direction, "Destination room not found")
		return false

	current_room = new_room
	mark_room_explored(destination_key)
	room_changed.emit(current_room)
	return true


## Get available exits from current room
func get_available_exits() -> Array:
	if current_room == null:
		return []
	return current_room.exits.keys()


## Get the room name for a given direction (for compass display)
func get_exit_destination_name(direction: String) -> String:
	if current_room == null:
		return ""

	var dir_lower := direction.to_lower()
	if not current_room.exits.has(dir_lower):
		return ""

	var dest_key: String = current_room.exits[dir_lower]
	var dest_room := MockWorld.get_room(dest_key)
	return dest_room.name if dest_room else ""


## Teleport directly to a room by key (for testing/admin)
func teleport_to(room_key: String) -> bool:
	if is_online:
		# Cannot teleport when online (would need server support)
		push_warning("[GameState] Cannot teleport when connected to server")
		return false

	var room := MockWorld.get_room(room_key)
	if room == null:
		return false

	current_room = room
	mark_room_explored(room_key)
	room_changed.emit(current_room)
	return true


# =============================================================================
# Map Exploration
# =============================================================================

## Mark a room as explored (for fog of war on map)
func mark_room_explored(room_key: String) -> void:
	if room_key not in explored_rooms:
		explored_rooms.append(room_key)
		exploration_changed.emit()


## Check if a room has been explored
func is_room_explored(room_key: String) -> bool:
	return room_key in explored_rooms


## Check if a room is visible (explored OR adjacent to any explored room)
func is_room_visible(room_key: String) -> bool:
	# Always show explored rooms
	if is_room_explored(room_key):
		return true

	# Show rooms adjacent to ANY explored room (fog of war edge)
	for explored_key in explored_rooms:
		var explored_room := MockWorld.get_room(explored_key)
		if explored_room != null:
			for exit_dir in explored_room.exits:
				if explored_room.exits[exit_dir] == room_key:
					return true

	return false


## Get all room keys that should be visible on the map
func get_visible_rooms() -> Array:
	var visible := []
	for room_key in MockWorld.get_all_room_keys():
		if is_room_visible(room_key):
			visible.append(room_key)
	return visible


# =============================================================================
# Entity Interaction (Online only)
# =============================================================================

## Click on an entity (NPC, item, etc.)
func click_entity(entity_id: String) -> void:
	if is_online and _phoenix:
		_phoenix.click_entity(entity_id)


## Perform an action on an entity
func entity_action(action_name: String, entity_id: String) -> void:
	if is_online and _phoenix:
		_phoenix.action(action_name, entity_id)


# =============================================================================
# Server Event Handlers
# =============================================================================

func _on_server_connected() -> void:
	print("[GameState] Connected to server")
	is_online = true
	server_connected.emit()


func _on_server_disconnected() -> void:
	print("[GameState] Disconnected from server")
	is_online = false
	server_disconnected.emit()
	# Fall back to offline mode
	_init_offline_mode()


func _on_connection_error(message: String) -> void:
	push_error("[GameState] Connection error: %s" % message)


func _on_server_game_state(state: Dictionary) -> void:
	print("[GameState] Received full game state")
	server_state = state

	# Convert server room to local format
	var room_data: Dictionary = state.get("room", {})
	current_room = _convert_server_room(room_data)

	if current_room:
		room_changed.emit(current_room)


func _on_server_room_update(data: Dictionary) -> void:
	print("[GameState] Room updated")
	var room_data: Dictionary = data.get("room", {})
	current_room = _convert_server_room(room_data)

	if current_room:
		room_changed.emit(current_room)


func _on_server_event(event: Dictionary) -> void:
	game_event.emit(event)


func _on_entity_context(data: Dictionary) -> void:
	print("[GameState] Received entity context: %s" % data.get("name", "unknown"))
	entity_context_received.emit(data)


# =============================================================================
# Data Conversion
# =============================================================================

## Convert server room data to MockWorld.Room format for display
func _convert_server_room(room_data: Dictionary) -> MockWorld.Room:
	if room_data.is_empty():
		return null

	var key: String = room_data.get("id", room_data.get("key", ""))
	var name: String = room_data.get("title", room_data.get("name", "Unknown"))
	var description: String = room_data.get("description", "")

	# Convert exits - server sends various formats
	var exits_data = room_data.get("exits", {})
	var exits: Dictionary = {}

	if exits_data is Array:
		# Array of exit objects: [{"direction": "north", "destination_id": "room_id"}, ...]
		for exit in exits_data:
			if exit is Dictionary:
				var dir: String = exit.get("direction", exit.get("dir", ""))
				# Server sends "destination_id", fallback to other formats
				var dest: String = exit.get("destination_id", exit.get("destination", exit.get("to", "")))
				if dir != "" and dest != "":
					exits[dir] = dest
	elif exits_data is Dictionary:
		# Dictionary format: {"north": "room_id", ...}
		exits = exits_data

	# Convert NPCs from entities
	var npcs: Array[MockWorld.NPC] = []
	var items: Array[MockWorld.Item] = []

	var entities: Array = room_data.get("entities", [])
	for entity in entities:
		if entity is Dictionary:
			var entity_type: String = entity.get("type", "")
			var prototype: Dictionary = entity.get("prototype", {})
			if prototype.has("type"):
				entity_type = prototype["type"]

			if entity_type == "npc":
				var npc := MockWorld.NPC.new(
					entity.get("id", ""),               # Entity UUID for server lookups
					entity.get("key", ""),              # Prototype key
					entity.get("short_name", entity.get("name", "Someone")),
					entity.get("primary_keyword", ""),  # keyword for underlining
					entity.get("long_desc", ""),        # one-liner for room display
					entity.get("description", "")       # detailed for entity page
				)
				npcs.append(npc)
			elif entity_type == "item":
				var item := MockWorld.Item.new(
					entity.get("id", ""),               # Entity UUID for server lookups
					entity.get("key", ""),              # Prototype key
					entity.get("short_name", entity.get("name", "Something")),
					entity.get("primary_keyword", ""),  # keyword for underlining
					entity.get("long_desc", ""),        # one-liner for room display
					entity.get("description", "")       # detailed for entity page
				)
				items.append(item)

	# Also check top-level items array
	var items_data: Array = room_data.get("items", [])
	for item_data in items_data:
		if item_data is Dictionary:
			var item := MockWorld.Item.new(
				item_data.get("id", ""),               # Entity UUID for server lookups
				item_data.get("key", ""),              # Prototype key
				item_data.get("short_name", item_data.get("name", "Something")),
				item_data.get("primary_keyword", ""),
				item_data.get("long_desc", ""),
				item_data.get("description", "")
			)
			items.append(item)

	return MockWorld.Room.new(key, name, description, exits, npcs, items)


# =============================================================================
# Page Management
# =============================================================================

## Set the current page and emit signal
func set_page(new_page: PageType) -> void:
	if new_page == current_page:
		return
	previous_page = current_page
	current_page = new_page
	page_changed.emit(new_page)


## Return to the previous page
func return_to_previous_page() -> void:
	set_page(previous_page)


# =============================================================================
# Event Log Management
# =============================================================================

## Add an event to the log
func add_event(text: String) -> void:
	if text.strip_edges().is_empty():
		return

	events.append({
		"text": text,
		"timestamp": Time.get_unix_time_from_system()
	})

	# Trim to max events
	while events.size() > MAX_EVENTS:
		events.pop_front()

	events_changed.emit()


## Clear all events
func clear_events() -> void:
	events.clear()
	events_changed.emit()


## Get recent events as text array
func get_recent_events() -> Array[String]:
	var result: Array[String] = []
	for event in events:
		result.append(event.get("text", ""))
	return result


# =============================================================================
# Dialogue Management
# =============================================================================

## Start a dialogue
func start_dialogue(data: Dictionary) -> void:
	dialogue_data = data
	dialogue_history.clear()

	# Add initial dialogue to history
	_add_dialogue_entry(data)

	previous_page = current_page
	set_page(PageType.DIALOGUE)
	dialogue_changed.emit(data)


## Update dialogue with new data
func update_dialogue(data: Dictionary) -> void:
	dialogue_data = data
	_add_dialogue_entry(data)
	dialogue_changed.emit(data)


## End the current dialogue
func end_dialogue() -> void:
	dialogue_data = {}
	dialogue_history.clear()
	dialogue_ended.emit()
	return_to_previous_page()


## Add a dialogue entry to history
func _add_dialogue_entry(data: Dictionary) -> void:
	var entry := {
		"speaker": data.get("speaker", ""),
		"text": data.get("text", ""),
		"is_player": data.get("is_player", false),
		"event": data.get("event", ""),
	}
	if not entry.text.is_empty():
		dialogue_history.append(entry)


## Select a dialogue choice
func select_dialogue_choice(index: int) -> void:
	if is_online and _phoenix:
		_phoenix.dialogue_select(index)


# =============================================================================
# Entity Management
# =============================================================================

## View an entity (opens ENTITY page)
func view_entity(entity: Dictionary) -> void:
	current_entity = entity
	previous_page = current_page
	set_page(PageType.ENTITY)
	entity_changed.emit(entity)


## Request entity context from server
func request_entity_context(entity_id: String) -> void:
	if is_online and _phoenix:
		_phoenix.click_entity(entity_id)


# =============================================================================
# Shop Management
# =============================================================================

## Open shop interface
func open_shop(data: Dictionary) -> void:
	shop_data = data
	previous_page = current_page
	set_page(PageType.SHOP)
	shop_opened.emit(data)


## Close shop interface
func close_shop() -> void:
	shop_data = {}
	shop_closed.emit()
	return_to_previous_page()


# =============================================================================
# Container Management
# =============================================================================

## Open container interface
func open_container(data: Dictionary) -> void:
	container_data = data
	previous_page = current_page
	set_page(PageType.CONTAINER)
	container_opened.emit(data)


## Update container contents
func update_container(data: Dictionary) -> void:
	container_data = data
	container_updated.emit(data)


## Close container interface
func close_container() -> void:
	container_data = {}
	container_closed.emit()
	return_to_previous_page()


# =============================================================================
# Event Handlers - Dialogue
# =============================================================================

func _on_dialogue_started(data: Dictionary) -> void:
	print("[GameState] Dialogue started with: %s" % data.get("speaker", "unknown"))
	start_dialogue(data)


func _on_dialogue_updated(data: Dictionary) -> void:
	print("[GameState] Dialogue updated")
	update_dialogue(data)


func _on_dialogue_ended() -> void:
	print("[GameState] Dialogue ended")
	end_dialogue()


# =============================================================================
# Event Handlers - Combat (Log to events)
# =============================================================================

func _on_combat_started(data: Dictionary) -> void:
	var enemy: String = data.get("enemy", "enemy")
	add_event("Combat begins with %s!" % enemy)


func _on_combat_updated(data: Dictionary) -> void:
	var desc: String = data.get("description", "")
	if not desc.is_empty():
		add_event(desc)


func _on_combat_ended(data: Dictionary) -> void:
	var result: String = data.get("result", "ended")
	add_event("Combat %s." % result)


# =============================================================================
# Event Handlers - Character State
# =============================================================================

func _on_inventory_update(data: Dictionary) -> void:
	server_state["inventory"] = data.get("inventory", [])
	inventory_changed.emit()


func _on_equipment_update(data: Dictionary) -> void:
	server_state["equipment"] = data.get("equipment", {})
	equipment_changed.emit()


func _on_stats_update(data: Dictionary) -> void:
	server_state["stats"] = data.get("stats", {})
	stats_changed.emit()


func _on_resources_update(data: Dictionary) -> void:
	server_state["resources"] = data.get("resources", {})
	resources_changed.emit()


func _on_players_update(data: Dictionary) -> void:
	server_state["other_players"] = data.get("players", [])
	players_changed.emit()
	# Refresh room display to show updated player list
	if current_room:
		room_changed.emit(current_room)


# =============================================================================
# Event Handlers - Shop & Container
# =============================================================================

func _on_shop_opened(data: Dictionary) -> void:
	print("[GameState] Shop opened: %s" % data.get("npc_name", "Shop"))
	open_shop(data)


func _on_shop_closed() -> void:
	print("[GameState] Shop closed")
	close_shop()


func _on_container_opened(data: Dictionary) -> void:
	print("[GameState] Container opened: %s" % data.get("entity_name", "Container"))
	open_container(data)


func _on_container_updated(data: Dictionary) -> void:
	update_container(data)


func _on_container_closed() -> void:
	print("[GameState] Container closed")
	close_container()


# =============================================================================
# Event Handlers - Ghost (Death)
# =============================================================================

func _on_ghost_entered(data: Dictionary) -> void:
	print("[GameState] Died, became ghost")
	ghost_data = data
	ghost_entered.emit(data)


func _on_ghost_exited() -> void:
	print("[GameState] Resurrected from ghost")
	ghost_data = {}
	ghost_exited.emit()


# =============================================================================
# Event Handlers - Quests
# =============================================================================

func _on_quest_accepted(data: Dictionary) -> void:
	var quest_name: String = data.get("name", "Unknown Quest")
	add_event("Quest accepted - %s" % quest_name)

	# Store in quests array
	if not server_state.has("quests"):
		server_state["quests"] = []
	server_state["quests"].append(data.get("quest", {}))

	quest_accepted.emit(data)


func _on_quest_completed(data: Dictionary) -> void:
	var title: String = data.get("title", "Quest")
	var rewards: Dictionary = data.get("rewards", {})

	var reward_text := ""
	if rewards.has("gold"):
		reward_text = " - %d gold" % rewards.get("gold")
	if rewards.has("exp"):
		reward_text += " - %d exp" % rewards.get("exp")

	add_event("Quest completed - %s!%s" % [title, reward_text])
	quest_completed.emit(data)


func _on_quest_progress(data: Dictionary) -> void:
	var quest_name: String = data.get("quest_name", "")
	var objective: String = data.get("objective", "")
	var current: int = data.get("current", 0)
	var total: int = data.get("total", 0)

	if total > 0:
		add_event("%s: %s (%d/%d)" % [quest_name, objective, current, total])
	quest_progress.emit(data)


# =============================================================================
# Event Handlers - Atmosphere
# =============================================================================

func _on_atmosphere_update(data: Dictionary) -> void:
	atmosphere = data.get("atmosphere", "peaceful")
	atmosphere_changed.emit(atmosphere)


# =============================================================================
# Event Handlers - Timers
# =============================================================================

func _on_timer_completed(data: Dictionary) -> void:
	var timer_type: String = data.get("timer_type", "timer")
	add_event("Completed - %s" % timer_type.capitalize())


# =============================================================================
# Event Handlers - Force Disconnect
# =============================================================================

func _on_force_disconnect(data: Dictionary) -> void:
	var reason: String = data.get("reason", "Disconnected by server")
	print("[GameState] Force disconnected: %s" % reason)
	force_disconnect.emit(reason)
	disconnect_from_server()
