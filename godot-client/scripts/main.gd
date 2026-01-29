## Main scene controller.
## Handles camera setup, input routing, chat, and login flow.
## Bottom bar and menu are now rendered inside the book page.
extends Node3D

## References to key nodes
@onready var camera: Camera3D = $Camera3D
@onready var book_page: BookPage = $BookPage

## Chat modal references (overlay - stays as overlay for text input)
@onready var chat_modal: Panel = $CanvasLayer/ChatModal
@onready var chat_input: LineEdit = $CanvasLayer/ChatModal/VBox/ChatInput
@onready var say_mode_btn: Button = $CanvasLayer/ChatModal/VBox/ModeRow/SayMode
@onready var shout_mode_btn: Button = $CanvasLayer/ChatModal/VBox/ModeRow/ShoutMode
@onready var send_button: Button = $CanvasLayer/ChatModal/VBox/ButtonRow/SendButton
@onready var cancel_button: Button = $CanvasLayer/ChatModal/VBox/ButtonRow/CancelButton

## Login UI references (overlay - stays as overlay for text input)
@onready var login_panel: Panel = $CanvasLayer/LoginPanel
@onready var name_input: LineEdit = $CanvasLayer/LoginPanel/VBox/NameInput
@onready var login_button: Button = $CanvasLayer/LoginPanel/VBox/LoginButton
@onready var error_label: Label = $CanvasLayer/LoginPanel/VBox/ErrorLabel
@onready var status_label: Label = $CanvasLayer/LoginPanel/VBox/StatusLabel

## Swipe detection
var swipe_start_pos: Vector2 = Vector2.ZERO
var is_swiping: bool = false
const SWIPE_THRESHOLD := 50.0

## Login state
var is_logging_in: bool = false

## Chat state
var chat_mode: String = "say"


func _ready() -> void:
	_setup_camera()
	_setup_book_page()
	_setup_chat_modal()
	_setup_login_ui()
	_setup_auth_signals()
	_setup_game_state_signals()

	# Check if we have saved auth
	if AuthClient.has_saved_auth():
		_try_auto_login()
	else:
		_show_login_screen()


func _setup_camera() -> void:
	# Very subtle overhead angle to show 3D page curl depth
	camera.position = Vector3(0, 0.15, 3)
	camera.look_at(Vector3.ZERO)


func _setup_book_page() -> void:
	# Connect bottom bar signals from book page
	book_page.bottom_bar_pressed.connect(_on_bottom_bar_pressed)


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


# =============================================================================
# Bottom Bar (inside book page)
# =============================================================================

func _on_bottom_bar_pressed(button: String) -> void:
	match button:
		"menu":
			_toggle_menu()
		"say":
			_open_chat_modal()
		"north", "south", "east", "west":
			_navigate(button)


func _toggle_menu() -> void:
	if book_page.current_page == BookPage.PageType.ROOM:
		# Turn to menu page
		book_page.switch_to_page(BookPage.PageType.MENU, "right")
	else:
		# Return to room page
		book_page.switch_to_page(BookPage.PageType.ROOM, "left")


func _navigate(direction: String) -> void:
	# Only allow navigation when on room page
	if book_page.current_page != BookPage.PageType.ROOM:
		return

	# Determine turn direction for animation
	var turn_dir := "right" if direction in ["north", "east"] else "left"
	book_page.turn_page(turn_dir)

	# Navigate after brief delay
	await get_tree().create_timer(0.2).timeout
	GameState.navigate(direction)


# =============================================================================
# Login Flow
# =============================================================================

func _show_login_screen() -> void:
	login_panel.visible = true
	chat_modal.visible = false
	book_page.visible = false
	error_label.text = ""
	status_label.text = ""

	# In debug mode, pre-fill with a unique name for quick dev login
	if OS.is_debug_build() and name_input.text.is_empty():
		var suffix := str(Time.get_unix_time_from_system()).right(4)
		name_input.text = "dev" + suffix

	name_input.grab_focus()


func _show_game_screen() -> void:
	login_panel.visible = false
	chat_modal.visible = false
	book_page.visible = true


func _try_auto_login() -> void:
	print("[Main] Attempting auto-login with saved token...")
	status_label.text = "Reconnecting..."
	login_panel.visible = true
	book_page.visible = false
	GameState.connect_to_server(AuthClient.token)


func _on_login_pressed() -> void:
	_do_login()


func _on_name_submitted(_name: String) -> void:
	_do_login()


func _do_login() -> void:
	if is_logging_in:
		return

	var char_name := name_input.text.strip_edges()

	# In debug mode, auto-generate a unique name if empty
	if char_name.is_empty():
		if OS.is_debug_build():
			var suffix := str(Time.get_unix_time_from_system()).right(6)
			char_name = "dev" + suffix
			name_input.text = char_name
			print("[Main] Dev mode: auto-generated name '%s'" % char_name)
		else:
			error_label.text = "Please enter your name"
			return

	is_logging_in = true
	login_button.disabled = true
	error_label.text = ""
	status_label.text = "Logging in..."

	AuthClient.guest_login(char_name)


func _on_login_success(player: Dictionary) -> void:
	print("[Main] Login success: %s" % player)
	status_label.text = "Connecting to server..."
	GameState.connect_to_server(AuthClient.token)


func _on_login_error(message: String) -> void:
	print("[Main] Login error: %s" % message)
	is_logging_in = false
	login_button.disabled = false
	error_label.text = message
	status_label.text = ""


func _on_server_connected() -> void:
	print("[Main] Server connected!")
	is_logging_in = false
	login_button.disabled = false
	status_label.text = ""
	_show_game_screen()


func _on_server_disconnected() -> void:
	print("[Main] Server disconnected")
	if not login_panel.visible:
		status_label.text = "Disconnected from server"
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
			book_page.add_event("%s says: \"%s\"" % [player_name, message])
		else:
			book_page.add_event("%s shouts: \"%s\"" % [player_name, message])

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
		book_page.add_event(text)
	else:
		match event_type:
			"chat":
				var speaker: String = event.get("speaker", "Someone")
				var msg: String = event.get("message", "")
				var mode: String = event.get("mode", "say")
				if mode == "shout":
					book_page.add_event("%s shouts: \"%s\"" % [speaker, msg])
				else:
					book_page.add_event("%s says: \"%s\"" % [speaker, msg])
			"combat":
				book_page.add_event(event.get("description", "Combat!"))
			"system":
				book_page.add_event(event.get("message", ""))
			_:
				if event.has("description"):
					book_page.add_event(event["description"])


# =============================================================================
# Input Handling
# =============================================================================

func _input(event: InputEvent) -> void:
	# Don't process input when login panel or chat modal is visible
	if login_panel.visible or chat_modal.visible:
		return

	# Handle touch/swipe input
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

	# Keyboard navigation for testing
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
				book_page.turn_page("right")
			KEY_ENTER:
				_open_chat_modal()
			KEY_M:
				_toggle_menu()
			KEY_TAB:
				# Cycle menu tabs when on menu page
				if book_page.current_page == BookPage.PageType.MENU:
					book_page.next_menu_tab()
			KEY_ESCAPE:
				if book_page.current_page == BookPage.PageType.MENU:
					# Return to room
					book_page.switch_to_page(BookPage.PageType.ROOM, "left")
				else:
					# Logout
					AuthClient.logout()
					GameState.disconnect_from_server()
					_show_login_screen()


func _handle_swipe(delta: Vector2) -> void:
	if abs(delta.x) > abs(delta.y):
		if book_page.current_page == BookPage.PageType.MENU:
			# Swipe on menu cycles tabs or returns to room
			if delta.x > 0:
				book_page.prev_menu_tab()
			else:
				book_page.next_menu_tab()
		else:
			# Swipe on room page turns page
			if delta.x > 0:
				book_page.turn_page("left")
			else:
				book_page.turn_page("right")
