## Phoenix WebSocket client for connecting to the Loka server.
## Handles the Phoenix channel protocol including join, heartbeat, and message routing.
## Note: Used as autoload, so no class_name to avoid conflicts.
extends Node

# =============================================================================
# Connection State Signals
# =============================================================================
signal connected
signal disconnected
signal connection_error(message: String)

# =============================================================================
# Core Game State Signals
# =============================================================================
signal game_state_received(state: Dictionary)
signal room_updated(room: Dictionary)
signal event_received(event: Dictionary)
signal entity_context_received(data: Dictionary)

# =============================================================================
# Combat Signals
# =============================================================================
signal combat_started(data: Dictionary)
signal combat_updated(data: Dictionary)
signal combat_ended(data: Dictionary)

# =============================================================================
# Dialogue Signals
# =============================================================================
signal dialogue_started(data: Dictionary)
signal dialogue_updated(data: Dictionary)
signal dialogue_ended

# =============================================================================
# Cutscene Signals
# =============================================================================
signal cutscene_started(data: Dictionary)
signal cutscene_line_received(data: Dictionary)
signal cutscene_ended

# =============================================================================
# Character State Signals
# =============================================================================
signal character_created(data: Dictionary)
signal character_creation_error(message: String)
signal inventory_updated(data: Dictionary)
signal equipment_updated(data: Dictionary)
signal stats_updated(data: Dictionary)
signal resources_updated(data: Dictionary)
signal players_updated(data: Dictionary)

# =============================================================================
# Shop & Container Signals
# =============================================================================
signal shop_opened(data: Dictionary)
signal shop_closed
signal container_opened(data: Dictionary)
signal container_updated(data: Dictionary)
signal container_closed

# =============================================================================
# Ghost (Death) Signals
# =============================================================================
signal ghost_entered(data: Dictionary)
signal ghost_exited

# =============================================================================
# Quest Signals
# =============================================================================
signal quest_accepted(data: Dictionary)
signal quest_completed(data: Dictionary)
signal quest_progress(data: Dictionary)

# =============================================================================
# Environment Signals
# =============================================================================
signal atmosphere_updated(data: Dictionary)
signal timer_completed(data: Dictionary)

# =============================================================================
# System Signals
# =============================================================================
signal force_disconnected(data: Dictionary)

# Phoenix protocol constants
const HEARTBEAT_INTERVAL := 30.0
const RECONNECT_DELAYS := [1.0, 2.0, 4.0, 8.0, 16.0, 30.0]
const CLIENT_VERSION := "1.0.0"

# WebSocket connection
var _ws: WebSocketPeer = null
var _server_url: String = ""
var _jwt_token: String = ""

# Connection state
var is_connected: bool = false
var is_connecting: bool = false

# Phoenix protocol state
var _ref_counter: int = 1
var _join_ref: String = ""
var _heartbeat_timer: float = 0.0
var _reconnect_attempt: int = 0
var _pending_replies: Dictionary = {}  # ref -> Callable


func _ready() -> void:
	set_process(true)


var _last_state: int = -1

func _process(delta: float) -> void:
	if _ws == null:
		return

	_ws.poll()

	var state := _ws.get_ready_state()

	# Log state changes
	if state != _last_state:
		print("[Phoenix] WebSocket state changed: %s -> %s" % [_state_name(_last_state), _state_name(state)])
		_last_state = state

	match state:
		WebSocketPeer.STATE_CONNECTING:
			pass  # Still connecting

		WebSocketPeer.STATE_OPEN:
			if not is_connected and not is_connecting:
				# Just connected, join the channel
				is_connecting = true
				_join_channel()

			# Handle incoming messages
			_process_incoming_messages()

			# Handle heartbeat
			_heartbeat_timer += delta
			if _heartbeat_timer >= HEARTBEAT_INTERVAL:
				_send_heartbeat()
				_heartbeat_timer = 0.0

		WebSocketPeer.STATE_CLOSING:
			pass  # Closing

		WebSocketPeer.STATE_CLOSED:
			if is_connected or is_connecting:
				is_connected = false
				is_connecting = false
				disconnected.emit()
				print("[Phoenix] Disconnected from server")
				_attempt_reconnect()


## Connect to the Phoenix server with an optional JWT token
func connect_to_server(token: String = "") -> void:
	_jwt_token = token
	_server_url = _get_server_url()

	# Build connection URL with token if provided
	var url := _server_url
	if token != "":
		url += "?token=" + token.uri_encode()

	print("[Phoenix] Connecting to %s" % url)

	_ws = WebSocketPeer.new()
	var error := _ws.connect_to_url(url)

	if error != OK:
		push_error("[Phoenix] Failed to connect: %s" % error)
		connection_error.emit("Failed to connect to server")
		return

	_reconnect_attempt = 0


## Disconnect from the server
func disconnect_from_server() -> void:
	if _ws:
		_ws.close()
		_ws = null
	is_connected = false
	is_connecting = false


## Navigate in a direction
func navigate(direction: String) -> void:
	_send_channel_message("navigate", {"direction": direction})


## Click on an entity
func click_entity(entity_id: String) -> void:
	_send_channel_message("click_entity", {"entity_id": entity_id})


## Perform an action on an entity
func action(action_name: String, entity_id: String) -> void:
	_send_channel_message("action", {"action": action_name, "entity_id": entity_id})


## Select a dialogue choice
func dialogue_select(choice_index: int) -> void:
	_send_channel_message("dialogue_select", {"choice_index": choice_index})


## Send a chat message
func chat(mode: String, message: String) -> void:
	_send_channel_message("chat", {"mode": mode, "message": message})


## Perform an emote
func emote(emote_key: String, target_id: String = "") -> void:
	var payload := {"emote_key": emote_key}
	if target_id != "":
		payload["target_id"] = target_id
	_send_channel_message("emote", payload)


## Combat action (e.g., flee)
func combat_action(action_name: String) -> void:
	_send_channel_message("combat_action", {"action": action_name})


## Resurrect from ghost state
func resurrect(method: String = "shrine") -> void:
	_send_channel_message("resurrect", {"method": method})


## Shop action (buy, sell)
func shop_action(action_name: String, item_index: int) -> void:
	_send_channel_message("shop", {"action": action_name, "item_index": item_index})


## Close shop
func shop_close() -> void:
	_send_channel_message("shop_close", {})


## Container action (take, take_all)
func container_action(action_name: String, item_index: int = -1) -> void:
	var payload := {"action": action_name}
	if item_index >= 0:
		payload["item_index"] = item_index
	_send_channel_message("container", payload)


## Close container
func container_close() -> void:
	_send_channel_message("container_close", {})


## Create a character with given data
## character_data should have: name, gender, background, stats
func create_character(character_data: Dictionary) -> void:
	var payload := {
		"name": character_data.get("name", ""),
		"gender": character_data.get("gender", "they/them"),
		"background": character_data.get("background", "pilgrim"),
		"stats": character_data.get("stats", {})
	}
	print("[Phoenix] Creating character: %s" % character_data.get("name", "unknown"))
	_send_channel_message("create_character", payload)


# =============================================================================
# Private: Connection Management
# =============================================================================

func _state_name(state: int) -> String:
	match state:
		-1: return "NONE"
		WebSocketPeer.STATE_CONNECTING: return "CONNECTING"
		WebSocketPeer.STATE_OPEN: return "OPEN"
		WebSocketPeer.STATE_CLOSING: return "CLOSING"
		WebSocketPeer.STATE_CLOSED: return "CLOSED"
		_: return "UNKNOWN(%s)" % state


func _get_server_url() -> String:
	# Check for environment override
	if OS.has_environment("LOKA_SERVER_URL"):
		return OS.get_environment("LOKA_SERVER_URL")

	# Development builds
	if OS.is_debug_build():
		# Mobile devices need Tailscale IP to reach dev server
		if OS.has_feature("mobile") or OS.has_feature("ios") or OS.has_feature("android"):
			return "ws://100.69.21.60:4000/socket/websocket"
		# Desktop/web can use localhost
		return "ws://localhost:4000/socket/websocket"

	# Production
	return "wss://loka.fly.dev/socket/websocket"


func _attempt_reconnect() -> void:
	if _reconnect_attempt >= RECONNECT_DELAYS.size():
		print("[Phoenix] Max reconnection attempts reached")
		connection_error.emit("Unable to reconnect to server")
		return

	var delay: float = RECONNECT_DELAYS[_reconnect_attempt]
	_reconnect_attempt += 1
	print("[Phoenix] Reconnecting in %s seconds (attempt %s)" % [delay, _reconnect_attempt])

	# Use a timer to reconnect
	await get_tree().create_timer(delay).timeout

	if not is_connected:
		connect_to_server(_jwt_token)


# =============================================================================
# Private: Phoenix Protocol
# =============================================================================

func _join_channel() -> void:
	print("[Phoenix] Joining game:lobby channel")

	_join_ref = str(_ref_counter)

	var message := {
		"join_ref": _join_ref,
		"ref": str(_ref_counter),
		"topic": "game:lobby",
		"event": "phx_join",
		"payload": {"client_version": CLIENT_VERSION}
	}

	_ref_counter += 1
	_send_raw(message)


func _send_heartbeat() -> void:
	var message := {
		"join_ref": null,
		"ref": str(_ref_counter),
		"topic": "phoenix",
		"event": "heartbeat",
		"payload": {}
	}

	_ref_counter += 1
	_send_raw(message)


func _send_channel_message(event: String, payload: Dictionary) -> void:
	if not is_connected:
		push_warning("[Phoenix] Not connected, cannot send: %s" % event)
		return

	var message := {
		"join_ref": _join_ref,
		"ref": str(_ref_counter),
		"topic": "game:lobby",
		"event": event,
		"payload": payload
	}

	_ref_counter += 1
	_send_raw(message)


func _send_raw(message: Dictionary) -> void:
	if _ws == null or _ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		push_warning("[Phoenix] Cannot send, socket not open")
		return

	var json_str := JSON.stringify(message)
	_ws.send_text(json_str)


# =============================================================================
# Private: Message Processing
# =============================================================================

func _process_incoming_messages() -> void:
	while _ws.get_available_packet_count() > 0:
		var packet := _ws.get_packet()
		if packet is PackedByteArray:
			var json_str := packet.get_string_from_utf8()
			var msg = JSON.parse_string(json_str)
			if msg is Dictionary:
				_handle_phoenix_message(msg)


func _handle_phoenix_message(msg: Dictionary) -> void:
	var event: String = msg.get("event", "")
	var topic: String = msg.get("topic", "")
	var payload: Dictionary = msg.get("payload", {})
	var ref = msg.get("ref")

	# Handle Phoenix protocol messages
	if event == "phx_reply":
		_handle_reply(payload, ref)
		return

	if event == "phx_close":
		print("[Phoenix] Server closed channel")
		disconnect_from_server()
		return

	# Handle game events
	if topic == "game:lobby":
		_handle_game_event(event, payload)


func _handle_reply(payload: Dictionary, ref) -> void:
	var status: String = payload.get("status", "")
	var response = payload.get("response", {})

	if status == "ok":
		if not is_connected:
			# This is the join reply
			is_connected = true
			is_connecting = false
			_reconnect_attempt = 0
			print("[Phoenix] Connected to game server")
			connected.emit()

			# The join response may contain game state
			if response is Dictionary and response.has("room"):
				game_state_received.emit(response)

	elif status == "error":
		var reason: String = ""
		if response is Dictionary:
			reason = response.get("reason", "unknown")
		else:
			reason = str(response)

		push_error("[Phoenix] Error: %s" % reason)
		connection_error.emit(reason)

		if reason == "update_required":
			# Client version too old
			print("[Phoenix] Client update required")


func _handle_game_event(event: String, payload: Dictionary) -> void:
	match event:
		# =====================================================================
		# Phoenix Protocol Events
		# =====================================================================
		"phx_error":
			# Server-side error (channel crashed)
			print("[Phoenix] Server error received: %s" % str(payload))
			push_error("[Phoenix] Channel crashed on server")
			is_connected = false
			is_connecting = false
			connection_error.emit("Server error: channel crashed")
			disconnected.emit()

		# =====================================================================
		# Core Game State Events
		# =====================================================================
		"game_state":
			print("[Phoenix] Received game_state: room=%s" % payload.get("room", {}).get("title", "unknown"))
			game_state_received.emit(payload)

		"room_update":
			print("[Phoenix] Received room_update")
			room_updated.emit(payload)

		"event":
			event_received.emit(payload)

		"entity_context":
			# Server sends {"entity": {...}}, unwrap it
			var entity_data: Dictionary = payload.get("entity", payload)
			print("[Phoenix] Received entity_context: %s" % entity_data.get("name", "unknown"))
			entity_context_received.emit(entity_data)

		# =====================================================================
		# Combat Events
		# =====================================================================
		"combat_start":
			combat_started.emit(payload)

		"combat_update":
			combat_updated.emit(payload)

		"combat_end":
			combat_ended.emit(payload)

		# =====================================================================
		# Dialogue Events
		# =====================================================================
		"dialogue_start":
			dialogue_started.emit(payload)

		"dialogue_update":
			dialogue_updated.emit(payload)

		"dialogue_end":
			dialogue_ended.emit()

		# =====================================================================
		# Cutscene Events
		# =====================================================================
		"cutscene_start":
			print("[Phoenix] Received cutscene_start: %s" % payload.get("name", "unknown"))
			cutscene_started.emit(payload)

		"cutscene_line":
			cutscene_line_received.emit(payload)

		"cutscene_end":
			print("[Phoenix] Received cutscene_end")
			cutscene_ended.emit()

		# =====================================================================
		# Character State Events
		# =====================================================================
		"inventory_update":
			inventory_updated.emit(payload)

		"equipment_update":
			equipment_updated.emit(payload)

		"stats_update":
			stats_updated.emit(payload)

		"resources_update":
			resources_updated.emit(payload)

		"players_update":
			players_updated.emit(payload)

		# =====================================================================
		# Shop Events
		# =====================================================================
		"shop_open":
			print("[Phoenix] Received shop_open")
			shop_opened.emit(payload)

		"shop_close":
			print("[Phoenix] Received shop_close")
			shop_closed.emit()

		# =====================================================================
		# Container Events
		# =====================================================================
		"container_open":
			print("[Phoenix] Received container_open")
			container_opened.emit(payload)

		"container_update":
			container_updated.emit(payload)

		"container_close":
			print("[Phoenix] Received container_close")
			container_closed.emit()

		# =====================================================================
		# Bardo (Death) Events
		# =====================================================================
		"ghost_enter":
			print("[Phoenix] Received ghost_enter")
			ghost_entered.emit(payload)

		"ghost_exit":
			print("[Phoenix] Received ghost_exit")
			ghost_exited.emit()

		# =====================================================================
		# Character Creation Events
		# =====================================================================
		"character_created":
			print("[Phoenix] Received character_created: %s" % payload.get("character_name", "unknown"))
			character_created.emit(payload)

		# =====================================================================
		# Quest Events
		# =====================================================================
		"quest_accepted":
			print("[Phoenix] Received quest_accepted: %s" % payload.get("name", "unknown"))
			quest_accepted.emit(payload)

		"quest_completed":
			print("[Phoenix] Received quest_completed: %s" % payload.get("title", "unknown"))
			quest_completed.emit(payload)

		"quest_progress":
			quest_progress.emit(payload)

		# =====================================================================
		# Environment Events
		# =====================================================================
		"atmosphere_update":
			atmosphere_updated.emit(payload)

		"timer_completed":
			print("[Phoenix] Received timer_completed: %s" % payload.get("timer_type", "unknown"))
			timer_completed.emit(payload)

		# =====================================================================
		# System Events
		# =====================================================================
		"force_disconnect":
			print("[Phoenix] Received force_disconnect: %s" % payload.get("reason", "unknown"))
			force_disconnected.emit(payload)

		# =====================================================================
		# Screenshot (client should capture and upload)
		# =====================================================================
		"capture_screenshot":
			# TODO: Implement screenshot capture
			print("[Phoenix] Screenshot capture requested (not implemented)")

		_:
			# Log unhandled events in debug mode
			if OS.is_debug_build():
				print("[Phoenix] Unhandled event: %s" % event)
