## Global game state singleton.
## Manages current room, navigation, and server communication.
## Supports both online (Phoenix server) and offline (MockWorld) modes.
extends Node

## Emitted when the player moves to a new room
signal room_changed(room: MockWorld.Room)

## Emitted when navigation fails
signal navigation_failed(direction: String, reason: String)

## Emitted when connected to server
signal server_connected

## Emitted when disconnected from server
signal server_disconnected

## Emitted when a game event is received (chat, combat feedback, etc.)
signal game_event(event: Dictionary)

## Emitted when entity context is received (after clicking an entity)
signal entity_context_received(entity: Dictionary)

## Current room the player is in
var current_room: MockWorld.Room = null

## Full server game state (when online)
var server_state: Dictionary = {}

## Whether we're connected to the server
var is_online: bool = false

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

	_phoenix.connected.connect(_on_server_connected)
	_phoenix.disconnected.connect(_on_server_disconnected)
	_phoenix.connection_error.connect(_on_connection_error)
	_phoenix.game_state_received.connect(_on_server_game_state)
	_phoenix.room_updated.connect(_on_server_room_update)
	_phoenix.event_received.connect(_on_server_event)
	_phoenix.entity_context_received.connect(_on_entity_context)


func _init_offline_mode() -> void:
	is_online = false
	var start_key := MockWorld.start_room
	current_room = MockWorld.get_room(start_key)
	if current_room:
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
	room_changed.emit(current_room)
	return true


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
