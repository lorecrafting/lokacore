## Main 2D scene controller.
## Handles input routing, chat, login flow, and book/bottom bar wiring.
## Replaces the 3D main.gd with a 2D scene structure using PageFlip.
extends Node2D

## References to key nodes (set via scene or _ready)
var loka_book: LokaBook
var bottom_bar: BottomBar

## Chat modal references (overlay)
@onready var chat_modal: Panel = $CanvasLayer/ChatModal
@onready var chat_input: LineEdit = $CanvasLayer/ChatModal/VBox/ChatInput
@onready var say_mode_btn: Button = $CanvasLayer/ChatModal/VBox/ModeRow/SayMode
@onready var shout_mode_btn: Button = $CanvasLayer/ChatModal/VBox/ModeRow/ShoutMode
@onready var send_button: Button = $CanvasLayer/ChatModal/VBox/ButtonRow/SendButton
@onready var cancel_button: Button = $CanvasLayer/ChatModal/VBox/ButtonRow/CancelButton

## Login UI references (overlay)
@onready var login_panel: Panel = $CanvasLayer/LoginPanel
@onready var name_input: LineEdit = $CanvasLayer/LoginPanel/VBox/NameInput
@onready var login_button: Button = $CanvasLayer/LoginPanel/VBox/LoginButton
@onready var error_label: Label = $CanvasLayer/LoginPanel/VBox/ErrorLabel
@onready var status_label: Label = $CanvasLayer/LoginPanel/VBox/StatusLabel

## Ghost (death) overlay
var ghost_overlay: Panel = null
var ghost_message: Label = null
var resurrect_btn: Button = null

## Character creation panel
var character_creation: CharacterCreation = null

## Swipe detection
var swipe_start_pos: Vector2 = Vector2.ZERO
var is_swiping: bool = false
const SWIPE_THRESHOLD := 50.0

## Login state
var is_logging_in: bool = false

## Chat state
var chat_mode: String = "say"

## Cover animation state
var _is_first_login: bool = true


func _ready() -> void:
	# Find LokaBook child
	loka_book = $LokaBook as LokaBook

	# Create and add BottomBar
	bottom_bar = BottomBar.new()
	$UILayer.add_child(bottom_bar)

	_setup_book()
	_setup_bottom_bar()
	_setup_chat_modal()
	_setup_login_ui()
	_setup_auth_signals()
	_setup_game_state_signals()

	# Check saved auth
	if AuthClient.has_saved_auth():
		_try_auto_login()
	else:
		_show_login_screen()


func _setup_book() -> void:
	pass


func _setup_bottom_bar() -> void:
	bottom_bar.bar_pressed.connect(_on_bottom_bar_pressed)
	# Connect room changes to update compass and minimap
	GameState.room_changed.connect(_on_room_changed_update_bar)
	# Catch up with current room (GameState._ready fires before this connection)
	if GameState.current_room:
		_on_room_changed_update_bar(GameState.current_room)


func _on_room_changed_update_bar(room: MockWorld.Room) -> void:
	if room:
		var exits: Array = room.exits.keys() if room.exits else []
		bottom_bar.update_exits(exits)
		bottom_bar.update_minimap(room, GameState.visited_rooms)


func _setup_chat_modal() -> void:
	say_mode_btn.pressed.connect(_on_chat_mode_say)
	shout_mode_btn.pressed.connect(_on_chat_mode_shout)
	send_button.pressed.connect(_on_chat_send)
	cancel_button.pressed.connect(_on_chat_cancel)
	chat_input.text_submitted.connect(_on_chat_submitted)
	_update_chat_mode_buttons()


func _setup_login_ui() -> void:
	login_button.pressed.connect(_on_login_pressed)
	name_input.text_submitted.connect(_on_name_submitted)
	name_input.text_changed.connect(func(_text: String): error_label.text = "")


func _setup_auth_signals() -> void:
	AuthClient.login_success.connect(_on_login_success)
	AuthClient.login_error.connect(_on_login_error)


func _setup_game_state_signals() -> void:
	GameState.server_connected.connect(_on_server_connected)
	GameState.server_disconnected.connect(_on_server_disconnected)
	GameState.game_event.connect(_on_game_event)
	GameState.force_disconnect.connect(_on_force_disconnect)
	GameState.ghost_entered.connect(_on_ghost_entered)
	GameState.ghost_exited.connect(_on_ghost_exited)


# =============================================================================
# Bottom Bar
# =============================================================================

func _on_bottom_bar_pressed(button: String) -> void:
	match button:
		"menu":
			_toggle_menu()
		"say":
			_open_chat_modal()
		"north", "south", "east", "west", "up", "down":
			_navigate(button)


func _toggle_menu() -> void:
	if loka_book.current_page == LokaBook.PageType.ROOM:
		loka_book.switch_to_page(LokaBook.PageType.MENU, "right")
	else:
		loka_book.switch_to_page(LokaBook.PageType.ROOM, "left")


func _navigate(direction: String) -> void:
	if loka_book.current_page != LokaBook.PageType.ROOM:
		return
	GameState.navigate(direction)


# =============================================================================
# Login Flow
# =============================================================================

func _show_login_screen() -> void:
	login_panel.visible = true
	chat_modal.visible = false
	loka_book.visible = false
	bottom_bar.visible = false
	error_label.text = ""
	status_label.text = ""
	if OS.is_debug_build() and name_input.text.is_empty():
		var suffix := str(Time.get_unix_time_from_system()).right(4)
		name_input.text = "dev" + suffix
	name_input.grab_focus()


func _show_game_screen() -> void:
	login_panel.visible = false
	chat_modal.visible = false
	loka_book.visible = true
	bottom_bar.visible = true
	_hide_character_creation()

	# Cover open animation on first login
	if _is_first_login and loka_book._page_flip:
		_is_first_login = false
		# Book starts closed, animate open
		if loka_book._page_flip.start_option == PageFlip2D.StartOption.CLOSED_FROM_FRONT:
			loka_book._page_flip.go_to_page(1)


func _try_auto_login() -> void:
	print("[Main2D] Attempting auto-login with saved token...")
	_is_first_login = false  # Skip cover animation on reconnect
	status_label.text = "Reconnecting..."
	login_panel.visible = true
	loka_book.visible = false
	bottom_bar.visible = false
	GameState.connect_to_server(AuthClient.token)


func _on_login_pressed() -> void:
	_do_login()


func _on_name_submitted(_name: String) -> void:
	_do_login()


func _do_login() -> void:
	if is_logging_in:
		return
	var char_name := name_input.text.strip_edges()
	if char_name.is_empty():
		if OS.is_debug_build():
			var suffix := str(Time.get_unix_time_from_system()).right(6)
			char_name = "dev" + suffix
			name_input.text = char_name
		else:
			error_label.text = "Please enter your name"
			return
	is_logging_in = true
	login_button.disabled = true
	error_label.text = ""
	status_label.text = "Logging in..."
	AuthClient.guest_login(char_name)


func _on_login_success(player: Dictionary) -> void:
	print("[Main2D] Login success: %s" % player)
	status_label.text = "Connecting to server..."
	GameState.connect_to_server(AuthClient.token)


func _on_login_error(message: String) -> void:
	is_logging_in = false
	login_button.disabled = false
	error_label.text = message
	status_label.text = ""


func _on_server_connected() -> void:
	print("[Main2D] Server connected!")
	is_logging_in = false
	login_button.disabled = false
	status_label.text = ""
	_show_game_screen()


func _on_server_disconnected() -> void:
	if not login_panel.visible:
		status_label.text = "Disconnected from server"
		_show_login_screen()


# =============================================================================
# Character Creation
# =============================================================================

func show_character_creation() -> void:
	login_panel.visible = false
	loka_book.visible = false
	bottom_bar.visible = false
	if character_creation == null:
		_create_character_creation_panel()
	character_creation.reset()
	character_creation.visible = true


func _hide_character_creation() -> void:
	if character_creation != null:
		character_creation.visible = false


func _create_character_creation_panel() -> void:
	character_creation = CharacterCreation.new()
	var canvas_layer: CanvasLayer = $CanvasLayer
	canvas_layer.add_child(character_creation)
	character_creation.set_anchors_preset(Control.PRESET_CENTER)
	character_creation.position = -character_creation.size / 2
	character_creation.character_created.connect(_on_character_created)
	character_creation.creation_cancelled.connect(_on_character_creation_cancelled)


func _on_character_created(character_data: Dictionary) -> void:
	_hide_character_creation()
	if GameState.is_online:
		var phoenix: Node = get_node_or_null("/root/PhoenixClient")
		if phoenix:
			phoenix.create_character(character_data)
	_show_game_screen()


func _on_character_creation_cancelled() -> void:
	_hide_character_creation()
	_show_login_screen()


# =============================================================================
# Chat Modal
# =============================================================================

func _open_chat_modal() -> void:
	chat_modal.visible = true
	chat_input.text = ""
	chat_input.grab_focus()


func _close_chat_modal() -> void:
	chat_modal.visible = false


func _on_chat_mode_say() -> void:
	chat_mode = "say"
	_update_chat_mode_buttons()
	chat_input.placeholder_text = "Say something..."


func _on_chat_mode_shout() -> void:
	chat_mode = "shout"
	_update_chat_mode_buttons()
	chat_input.placeholder_text = "Shout to adjacent rooms..."


func _update_chat_mode_buttons() -> void:
	say_mode_btn.modulate = Color.WHITE if chat_mode == "say" else Color(0.6, 0.6, 0.6)
	shout_mode_btn.modulate = Color.WHITE if chat_mode == "shout" else Color(0.6, 0.6, 0.6)


func _on_chat_submitted(_text: String) -> void:
	_on_chat_send()


func _on_chat_send() -> void:
	var message := chat_input.text.strip_edges()
	if message.is_empty():
		return
	if GameState.is_online:
		var phoenix: Node = get_node_or_null("/root/PhoenixClient")
		if phoenix and phoenix.has_method("chat"):
			phoenix.call("chat", chat_mode, message)
	else:
		var player_name: String = str(AuthClient.player.get("name", "You"))
		if chat_mode == "say":
			loka_book.add_event("%s says: \"%s\"" % [player_name, message])
		else:
			loka_book.add_event("%s shouts: \"%s\"" % [player_name, message])
	_close_chat_modal()


func _on_chat_cancel() -> void:
	_close_chat_modal()


# =============================================================================
# Game Events
# =============================================================================

func _on_game_event(event: Dictionary) -> void:
	var event_type: String = event.get("type", "")
	var text: String = event.get("text", "")
	if text != "":
		loka_book.add_event(text)
	else:
		match event_type:
			"chat":
				var speaker: String = event.get("speaker", "Someone")
				var msg: String = event.get("message", "")
				var mode: String = event.get("mode", "say")
				if mode == "shout":
					loka_book.add_event("%s shouts: \"%s\"" % [speaker, msg])
				else:
					loka_book.add_event("%s says: \"%s\"" % [speaker, msg])
			"combat":
				loka_book.add_event(event.get("description", "Combat!"))
			"system":
				loka_book.add_event(event.get("message", ""))
			_:
				if event.has("description"):
					loka_book.add_event(event["description"])


# =============================================================================
# Input Handling
# =============================================================================

func _input(event: InputEvent) -> void:
	if login_panel.visible or chat_modal.visible:
		return

	# Touch/swipe
	if event is InputEventScreenTouch:
		if event.pressed:
			swipe_start_pos = event.position
			is_swiping = true
		else:
			is_swiping = false

	elif event is InputEventScreenDrag and is_swiping:
		var drag_event := event as InputEventScreenDrag
		var swipe_delta: Vector2 = drag_event.position - swipe_start_pos
		if swipe_delta.length() > SWIPE_THRESHOLD:
			_handle_swipe(swipe_delta)
			is_swiping = false

	# Keyboard navigation
	elif event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_W, KEY_UP:
				_navigate("north")
			KEY_S, KEY_DOWN:
				_navigate("south")
			KEY_D, KEY_RIGHT:
				_navigate("east")
			KEY_A, KEY_LEFT:
				_navigate("west")
			KEY_SPACE:
				loka_book.turn_page("right")
			KEY_ENTER:
				_open_chat_modal()
			KEY_M:
				_toggle_menu()
			KEY_TAB:
				if loka_book.current_page == LokaBook.PageType.MENU:
					loka_book.next_menu_tab()
			KEY_ESCAPE:
				if loka_book.current_page == LokaBook.PageType.MENU:
					loka_book.switch_to_page(LokaBook.PageType.ROOM, "left")
				else:
					AuthClient.logout()
					GameState.disconnect_from_server()
					_show_login_screen()


func _handle_swipe(delta: Vector2) -> void:
	if abs(delta.x) > abs(delta.y):
		if loka_book.current_page == LokaBook.PageType.MENU:
			if delta.x > 0:
				loka_book.prev_menu_tab()
			else:
				loka_book.next_menu_tab()
		else:
			if delta.x > 0:
				loka_book.turn_page("left")
			else:
				loka_book.turn_page("right")


# =============================================================================
# Force Disconnect
# =============================================================================

func _on_force_disconnect(reason: String) -> void:
	error_label.text = reason
	_show_login_screen()


# =============================================================================
# Bardo (Death) Overlay
# =============================================================================

func _setup_ghost_overlay() -> void:
	if ghost_overlay != null:
		return
	ghost_overlay = Panel.new()
	ghost_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	ghost_overlay.visible = false
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.08, 0.12, 0.85)
	ghost_overlay.add_theme_stylebox_override("panel", style)

	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_CENTER)
	vbox.offset_left = -150
	vbox.offset_right = 150
	vbox.offset_top = -100
	vbox.offset_bottom = 100
	vbox.add_theme_constant_override("separation", 20)
	ghost_overlay.add_child(vbox)

	var title := Label.new()
	title.text = "-- You Are A Ghost --"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", Color(0.7, 0.7, 0.9))
	vbox.add_child(title)

	ghost_message = Label.new()
	ghost_message.text = "Find a resurrection shrine or healer to return to life."
	ghost_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ghost_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ghost_message.add_theme_font_size_override("font_size", 18)
	ghost_message.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
	vbox.add_child(ghost_message)

	$CanvasLayer.add_child(ghost_overlay)


func _on_ghost_entered(data: Dictionary) -> void:
	_setup_ghost_overlay()
	var killer: String = data.get("killer", "")
	if killer != "":
		ghost_message.text = "Slain by %s.\nFind a resurrection shrine or healer to return to life." % killer
	else:
		ghost_message.text = "Find a resurrection shrine or healer to return to life."
	ghost_overlay.visible = true


func _on_ghost_exited() -> void:
	if ghost_overlay:
		ghost_overlay.visible = false
