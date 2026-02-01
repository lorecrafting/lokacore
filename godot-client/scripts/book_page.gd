## 3D book page with text rendering via SubViewport.
## Handles page curl animation, room content display, menu, and bottom bar.
## Uses dual-page system: top page curls to reveal bottom page underneath.
## All UI is rendered inside the book page texture.
extends Node3D
class_name BookPage

## Emitted when page turn animation starts
signal page_turn_started(direction: String)

## Emitted when page turn animation completes
signal page_turn_completed(direction: String)

## Emitted when a bottom bar button is tapped
signal bottom_bar_pressed(button: String)

## Page types
enum PageType { ROOM, MENU, ENTITY, DIALOGUE, SHOP, CONTAINER }

## Menu tabs (7 tabs)
enum MenuTab { INVENTORY, EQUIPMENT, CHARACTER, QUESTS, MAP, SOCIAL, SETTINGS }

## Text effects (matching shader uniforms)
enum TextEffect { NONE = 0, BURN = 1, ICE = 2, GLOW = 3, FADE = 4 }

## Animation settings
const TURN_DURATION := 0.6
const CURL_STRENGTH := 0.8  # More dramatic curl
const EFFECT_DURATION := 2.0  # Duration for text effects

## Event feed settings
const MAX_EVENTS := 5
const EVENT_FADE_TIME := 10.0  # Seconds before events start fading

# =============================================================================
# Main BookPage Variables
# =============================================================================

## Dual page system - top curls to reveal bottom
var top_page: PageMeshFactory.PageMesh
var bottom_page: PageMeshFactory.PageMesh

## Current text effect
var current_effect: TextEffect = TextEffect.NONE

## Text effect progress (0 = none, 1 = full effect)
var effect_progress: float = 0.0:
	set(value):
		effect_progress = clampf(value, 0.0, 1.0)
		_update_effect_shader()

## Current page state
var current_page: PageType = PageType.ROOM
var current_menu_tab: MenuTab = MenuTab.INVENTORY
var pending_page: PageType = PageType.ROOM  # Page to show after turn completes
var current_entity: Variant = null  # NPC or Item being viewed on entity page
var current_entity_actions: Array = []  # Available actions for current entity from server

## Dialogue state
var dialogue_data: Dictionary = {}  # Current dialogue node data from server
var dialogue_history: Array = []  # Previous dialogue entries for conversation log
var pre_dialogue_page: PageType = PageType.ROOM  # Page to return to after dialogue ends

## Animation tweens
var turn_tween: Tween
var effect_tween: Tween

## Event feed - stores recent events as {text: String, timestamp: float}
var events: Array[Dictionary] = []

## Available exits (for compass)
var available_exits: Array = []

## Debug mode for showing keyboard shortcuts
var debug_mode: bool = true

## JavaScript callbacks (must be stored to prevent garbage collection)
var _js_effect_callback: JavaScriptObject
var _js_curl_callback: JavaScriptObject
var _js_flip_callback: JavaScriptObject

## Entity action click zones (calculated after layout)
var _entity_actions_start_y: float = 0.0  # Y position where action links begin

## Mock dialogue state (managed by DialogueController)
var _mock_dialogue_node: int = 0
var _is_mock_dialogue: bool = false

## Extracted component instances
var _menu_renderer: MenuTabRenderer
var _dialogue_controller: DialogueController
var _page_factory: PageMeshFactory
var _shop_container_handler: ShopContainerHandler
var _content_renderer: PageContentRenderer


func _ready() -> void:
	# Initialize extracted components
	_menu_renderer = MenuTabRenderer.new()
	_dialogue_controller = DialogueController.new()
	_page_factory = PageMeshFactory.new()
	_page_factory.set_bottom_bar_signal(self, "bottom_bar_pressed")
	_shop_container_handler = ShopContainerHandler.new()
	_shop_container_handler.set_event_callback(add_event)
	_content_renderer = PageContentRenderer.new()

	# Create dual page system - pages stacked like real book
	# Larger z-offset so pages don't intersect during curl
	top_page = _page_factory.create_page_mesh(0.05, _on_label_meta_clicked)
	bottom_page = _page_factory.create_page_mesh(0.0, _on_label_meta_clicked)

	# Add viewports as children (required for rendering)
	add_child(top_page.page_viewport)
	add_child(top_page.text_viewport)
	add_child(top_page.mesh_instance)
	add_child(bottom_page.page_viewport)
	add_child(bottom_page.text_viewport)
	add_child(bottom_page.mesh_instance)

	_connect_signals()
	_setup_javascript_callbacks()

	# Show keyboard shortcuts in debug mode
	if debug_mode:
		print("=== Book Page Keyboard Shortcuts ===")
		print("  Space: Flip page right")
		print("  Shift+Space: Flip page left")
		print("  C: Test curl animation")
		print("  D: Test dialogue (offline)")
		print("====================================")

	# Wait for viewports to be ready, then apply textures
	await get_tree().process_frame
	await _page_factory.apply_page_textures(top_page, get_tree())
	await _page_factory.apply_page_textures(bottom_page, get_tree())
	top_page.mesh_instance.visible = true
	bottom_page.mesh_instance.visible = true

	# Display initial room if available
	if GameState.current_room:
		_render_room_to_page(top_page, GameState.current_room)




# =============================================================================
# JavaScript Callbacks (Web Debug Toolbar)
# =============================================================================

func _setup_javascript_callbacks() -> void:
	if not OS.has_feature("web"):
		return

	_js_effect_callback = JavaScriptBridge.create_callback(_on_js_trigger_effect)
	_js_curl_callback = JavaScriptBridge.create_callback(_on_js_trigger_curl)
	_js_flip_callback = JavaScriptBridge.create_callback(_on_js_trigger_flip)

	var window := JavaScriptBridge.get_interface("window")
	window.godotTriggerEffect = _js_effect_callback
	window.godotTriggerCurl = _js_curl_callback
	window.godotTriggerFlip = _js_flip_callback

	print("[BookPage] JavaScript callbacks registered for web debug toolbar")


func _on_js_trigger_effect(args: Array) -> void:
	if args.size() < 1:
		return
	var effect_name: String = str(args[0])
	print("[JS] Trigger effect: ", effect_name)

	match effect_name:
		"burn":
			start_text_effect(TextEffect.BURN)
		"ice":
			start_text_effect(TextEffect.ICE)
		"glow":
			start_text_effect(TextEffect.GLOW)
		"fade":
			start_text_effect(TextEffect.FADE)
		"clear":
			stop_text_effect()


func _on_js_trigger_curl(_args: Array) -> void:
	print("[JS] Trigger curl")
	_test_curl_animation()


func _on_js_trigger_flip(args: Array) -> void:
	if args.size() < 1:
		return
	var direction: String = str(args[0])
	print("[JS] Trigger flip: ", direction)
	turn_page(direction)


# =============================================================================
# Input Handling
# =============================================================================

## Track drag state for scroll
var _drag_start_pos: Vector2 = Vector2.ZERO
var _is_dragging: bool = false
var _drag_start_scroll: int = 0

func _input(event: InputEvent) -> void:
	if not visible:
		return

	# Handle mouse wheel for scrolling
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_scroll_page(-3)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_scroll_page(3)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_drag_start_pos = event.position
				_drag_start_scroll = top_page.label.get_v_scroll_bar().value
				_is_dragging = true
			else:
				# Only trigger click if we didn't drag much
				if _is_dragging and _drag_start_pos.distance_to(event.position) < 10:
					_handle_page_click(event.position)
				_is_dragging = false

	# Handle mouse drag for scroll
	elif event is InputEventMouseMotion and _is_dragging:
		var delta_y: float = event.position.y - _drag_start_pos.y
		# Invert: drag down = scroll up (content moves down)
		var scroll_delta: float = -delta_y * 1.5
		top_page.label.get_v_scroll_bar().value = _drag_start_scroll + scroll_delta

	# Handle touch
	elif event is InputEventScreenTouch:
		if event.pressed:
			_drag_start_pos = event.position
			_drag_start_scroll = top_page.label.get_v_scroll_bar().value
			_is_dragging = true
		else:
			if _is_dragging and _drag_start_pos.distance_to(event.position) < 10:
				_handle_page_click(event.position)
			_is_dragging = false

	# Handle touch drag for scroll
	elif event is InputEventScreenDrag and _is_dragging:
		var delta_y: float = event.position.y - _drag_start_pos.y
		var scroll_delta: float = -delta_y * 1.5
		top_page.label.get_v_scroll_bar().value = _drag_start_scroll + scroll_delta

	# Keyboard shortcuts for testing effects
	if event is InputEventKey and event.pressed:
		_handle_keyboard_shortcut(event)


func _scroll_page(lines: int) -> void:
	var scrollbar := top_page.label.get_v_scroll_bar()
	scrollbar.value += lines * 20  # ~20 pixels per line


func _handle_keyboard_shortcut(event: InputEventKey) -> void:
	match event.keycode:
		KEY_SPACE:
			if event.shift_pressed:
				turn_page("left")
			else:
				turn_page("right")
		KEY_1:
			start_text_effect(TextEffect.BURN)
		KEY_2:
			start_text_effect(TextEffect.ICE)
		KEY_3:
			start_text_effect(TextEffect.GLOW)
		KEY_4:
			start_text_effect(TextEffect.FADE)
		KEY_0:
			stop_text_effect()
		KEY_C:
			_test_curl_animation()
		KEY_D:
			_test_dialogue()
		KEY_R:
			stop_text_effect()
			top_page.set_curl(0.0)


func _test_curl_animation() -> void:
	if turn_tween and turn_tween.is_running():
		return

	turn_tween = create_tween()
	turn_tween.set_ease(Tween.EASE_IN_OUT)
	turn_tween.set_trans(Tween.TRANS_SINE)
	turn_tween.tween_method(func(v): top_page.set_curl(v), 0.0, 0.8, 0.5)
	turn_tween.tween_method(func(v): top_page.set_curl(v), 0.8, 0.0, 0.5)


func _test_dialogue() -> void:
	if turn_tween and turn_tween.is_running():
		return

	var mock_entity := MockWorld.NPC.new(
		"test_npc",
		"test_npc",
		"Mysterious Stranger",
		"stranger",
		"A mysterious stranger stands here.",
		"A cloaked figure shrouded in shadow."
	)
	current_entity = mock_entity
	_start_mock_dialogue(mock_entity)


# =============================================================================
# Text Effects
# =============================================================================

func start_text_effect(effect: TextEffect) -> void:
	if effect_tween and effect_tween.is_running():
		effect_tween.kill()

	current_effect = effect
	top_page.shader_material.set_shader_parameter("text_effect", int(effect))

	effect_tween = create_tween()
	effect_tween.set_ease(Tween.EASE_IN_OUT)
	effect_tween.set_trans(Tween.TRANS_QUAD)
	effect_tween.tween_property(self, "effect_progress", 1.0, EFFECT_DURATION)

	print("Started effect: ", TextEffect.keys()[effect])


func stop_text_effect() -> void:
	if effect_tween and effect_tween.is_running():
		effect_tween.kill()

	effect_tween = create_tween()
	effect_tween.tween_property(self, "effect_progress", 0.0, 0.3)
	effect_tween.tween_callback(func():
		current_effect = TextEffect.NONE
		top_page.shader_material.set_shader_parameter("text_effect", 0)
	)


func _update_effect_shader() -> void:
	if top_page and top_page.shader_material and top_page.shader_material.shader:
		top_page.shader_material.set_shader_parameter("effect_progress", effect_progress)


# =============================================================================
# Click Handling
# =============================================================================

func _handle_page_click(screen_pos: Vector2) -> void:
	var camera := get_viewport().get_camera_3d()
	if not camera:
		return

	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)

	if abs(dir.z) < 0.001:
		return

	var t := -from.z / dir.z
	if t < 0:
		return

	var hit_point := from + dir * t

	# Convert hit point to UV coordinates
	var uv_x := (hit_point.x / PageMeshFactory.PAGE_WIDTH) + 0.5
	var uv_y := (hit_point.y / PageMeshFactory.PAGE_HEIGHT) + 0.5

	if uv_x < 0 or uv_x > 1 or uv_y < 0 or uv_y > 1:
		return

	# Convert UV to viewport pixel coordinates
	var vp_x := uv_x * PageMeshFactory.VIEWPORT_WIDTH
	var vp_y := (1.0 - uv_y) * PageMeshFactory.VIEWPORT_HEIGHT

	# Check page type and route click
	var bar_top := PageMeshFactory.VIEWPORT_HEIGHT - PageMeshFactory.BOTTOM_BAR_HEIGHT
	if current_page == PageType.DIALOGUE:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif current_page == PageType.ENTITY:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif current_page == PageType.SHOP:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif current_page == PageType.CONTAINER:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif vp_y >= bar_top:
		_handle_bottom_bar_click(vp_x, vp_y - bar_top)
	elif current_page == PageType.ROOM:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif current_page == PageType.MENU:
		_forward_click_to_text_viewport(vp_x, vp_y)


func _forward_click_to_text_viewport(vp_x: float, vp_y: float) -> void:
	var press_event := InputEventMouseButton.new()
	press_event.button_index = MOUSE_BUTTON_LEFT
	press_event.pressed = true
	press_event.position = Vector2(vp_x, vp_y)
	press_event.global_position = Vector2(vp_x, vp_y)

	top_page.text_viewport.push_input(press_event)

	var release_event := InputEventMouseButton.new()
	release_event.button_index = MOUSE_BUTTON_LEFT
	release_event.pressed = false
	release_event.position = Vector2(vp_x, vp_y)
	release_event.global_position = Vector2(vp_x, vp_y)
	top_page.text_viewport.push_input(release_event)


func _handle_bottom_bar_click(local_x: float, local_y: float) -> void:
	var third := PageMeshFactory.VIEWPORT_WIDTH / 3.0

	if local_x < third:
		bottom_bar_pressed.emit("menu")
	elif local_x > (PageMeshFactory.VIEWPORT_WIDTH - third):
		bottom_bar_pressed.emit("say")
	else:
		var compass_center_x := PageMeshFactory.VIEWPORT_WIDTH / 2.0
		var compass_center_y := PageMeshFactory.BOTTOM_BAR_HEIGHT / 2.0

		var dx := local_x - compass_center_x
		var dy := local_y - compass_center_y

		if abs(dx) < 20 and abs(dy) < 15:
			return

		if abs(dx) > abs(dy):
			if dx > 0:
				bottom_bar_pressed.emit("east")
			else:
				bottom_bar_pressed.emit("west")
		else:
			if dy < 0:
				bottom_bar_pressed.emit("north")
			else:
				bottom_bar_pressed.emit("south")


func _on_label_meta_clicked(meta: Variant) -> void:
	var meta_str: String = str(meta)
	print("[Meta Click] Page=%s, meta=%s" % [PageType.keys()[current_page], meta_str])

	if current_page == PageType.DIALOGUE:
		var choice_index: int = int(meta)
		_select_dialogue_choice(choice_index)

	elif current_page == PageType.ENTITY:
		if meta_str.begins_with("action:"):
			var action_key: String = meta_str.substr(7)
			_execute_entity_action(action_key)

	elif current_page == PageType.ROOM:
		if meta_str.begins_with("npc:"):
			var npc_key: String = meta_str.substr(4)
			_select_npc_by_key(npc_key)
		elif meta_str.begins_with("item:"):
			var item_key: String = meta_str.substr(5)
			_select_item_by_key(item_key)

	elif current_page == PageType.MENU:
		if meta_str.begins_with("menu:"):
			var tab_key: String = meta_str.substr(5)
			_handle_menu_click(tab_key)

	elif current_page == PageType.SHOP:
		if meta_str.begins_with("shop:"):
			var action: String = meta_str.substr(5)
			_handle_shop_click(action)

	elif current_page == PageType.CONTAINER:
		if meta_str.begins_with("container:"):
			var action: String = meta_str.substr(10)
			_handle_container_click(action)


# =============================================================================
# Page Turn Animation (Dual Page System)
# =============================================================================

## Animate page turn - top page curls away to reveal bottom page
func turn_page(direction: String = "right") -> void:
	if turn_tween and turn_tween.is_running():
		return

	# Pre-render next content to bottom page BEFORE animation
	_render_pending_content_to_page(bottom_page, pending_page)

	# Set curl direction on top page
	var curl_dir := 1.0 if direction == "right" else -1.0
	top_page.shader_material.set_shader_parameter("curl_direction", curl_dir)

	page_turn_started.emit(direction)

	turn_tween = create_tween()

	# Phase 1: Quick lift (curl_progress 0→0.6)
	turn_tween.set_ease(Tween.EASE_OUT)
	turn_tween.set_trans(Tween.TRANS_QUAD)
	turn_tween.tween_method(func(v): top_page.set_curl(v), 0.0, 0.6, TURN_DURATION * 0.3)

	# Phase 2: Full curl (curl_progress 0.6→1.0)
	turn_tween.set_ease(Tween.EASE_IN_OUT)
	turn_tween.set_trans(Tween.TRANS_SINE)
	turn_tween.tween_method(func(v): top_page.set_curl(v), 0.6, 1.0, TURN_DURATION * 0.4)

	# Phase 3: Swap pages and settle
	turn_tween.tween_callback(_swap_pages)

	# Phase 4: New top page settles (was bottom, now at front)
	turn_tween.set_ease(Tween.EASE_OUT)
	turn_tween.set_trans(Tween.TRANS_BACK)
	turn_tween.tween_method(func(v): top_page.set_curl(v), 0.2, 0.0, TURN_DURATION * 0.3)

	turn_tween.finished.connect(func(): page_turn_completed.emit(direction), CONNECT_ONE_SHOT)


## Swap top and bottom pages after curl animation
func _swap_pages() -> void:
	# Swap references
	var temp := top_page
	top_page = bottom_page
	bottom_page = temp

	# Reset z positions - stacked like real book pages
	top_page.mesh_instance.position.z = 0.05
	bottom_page.mesh_instance.position.z = 0.0

	# Reset curl on old top (now bottom) and start new top with slight curl
	bottom_page.set_curl(0.0)
	top_page.set_curl(0.2)  # Will animate down to 0

	# Update current_page state
	current_page = pending_page

	# Update compass buttons on new top page
	_update_compass_buttons_on_page(top_page)


## Switch to a different page type with animation
func switch_to_page(page_type: PageType, direction: String = "right") -> void:
	if turn_tween and turn_tween.is_running():
		return

	pending_page = page_type
	turn_page(direction)


# =============================================================================
# Content Rendering (to specific page)
# =============================================================================

## Render pending content to a page's viewports
func _render_pending_content_to_page(page: PageMeshFactory.PageMesh, page_type: PageType) -> void:
	match page_type:
		PageType.ROOM:
			if GameState.current_room:
				_render_room_to_page(page, GameState.current_room)
			page.bottom_bar.visible = true
		PageType.MENU:
			_render_menu_to_page(page)
			page.bottom_bar.visible = true
		PageType.ENTITY:
			if current_entity:
				_render_entity_to_page(page, current_entity)
			page.bottom_bar.visible = false
		PageType.DIALOGUE:
			if not dialogue_data.is_empty():
				_render_dialogue_to_page(page, dialogue_data)
			page.bottom_bar.visible = false
		PageType.SHOP:
			_render_shop_to_page(page)
			page.bottom_bar.visible = false
		PageType.CONTAINER:
			_render_container_to_page(page)
			page.bottom_bar.visible = false


## Render room content to a page (delegates to content renderer)
func _render_room_to_page(page: PageMeshFactory.PageMesh, room: MockWorld.Room) -> void:
	if room == null:
		page.label.text = ""
		return

	# Track exits for compass
	available_exits = room.exits.keys() if room.exits else []
	_update_compass_buttons_on_page(page)

	page.label.text = _content_renderer.render_room(room, events)


## Render menu content to a page (delegates to content renderer)
func _render_menu_to_page(page: PageMeshFactory.PageMesh) -> void:
	page.label.text = _content_renderer.render_menu(current_menu_tab, _menu_renderer)


## Render entity details to a page (delegates to content renderer)
func _render_entity_to_page(page: PageMeshFactory.PageMesh, entity: Variant) -> void:
	if entity == null:
		page.label.text = ""
		return

	var result := _content_renderer.render_entity(entity)
	page.label.text = result.text
	current_entity_actions = result.actions


## Render shop content to a page (delegates to handler)
func _render_shop_to_page(page: PageMeshFactory.PageMesh) -> void:
	page.label.text = _shop_container_handler.render_shop()


## Render container content to a page (delegates to handler)
func _render_container_to_page(page: PageMeshFactory.PageMesh) -> void:
	page.label.text = _shop_container_handler.render_container()


## Render dialogue content to a page (delegates to content renderer)
func _render_dialogue_to_page(page: PageMeshFactory.PageMesh, data: Dictionary) -> void:
	if data.is_empty():
		page.label.text = ""
		return

	# Add current NPC line to history if not already there
	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	var dialogue_text: String = data.get("text", "")
	dialogue_text = dialogue_text.replace("\n", " ").replace("  ", " ")

	var should_add := true
	if not dialogue_history.is_empty():
		var last_entry: Dictionary = dialogue_history[-1]
		if last_entry.get("speaker") == speaker and last_entry.get("text") == dialogue_text and not last_entry.get("is_player", false):
			should_add = false

	if should_add:
		dialogue_history.append({"speaker": speaker, "text": dialogue_text, "is_player": false})

	page.label.text = _content_renderer.render_dialogue(data, dialogue_history)


# =============================================================================
# Display Methods (for current page - convenience wrappers)
# =============================================================================

func display_room(room: MockWorld.Room) -> void:
	_render_room_to_page(top_page, room)


func display_menu() -> void:
	_render_menu_to_page(top_page)


func display_entity(entity: Variant) -> void:
	_render_entity_to_page(top_page, entity)


func display_dialogue(data: Dictionary) -> void:
	_render_dialogue_to_page(top_page, data)


# =============================================================================
# Compass and Bottom Bar Updates
# =============================================================================

func _update_compass_buttons_on_page(page: PageMeshFactory.PageMesh) -> void:
	if not page.bottom_bar:
		return

	var compass := page.bottom_bar.find_child("NorthBtn", true, false)
	if compass:
		compass = compass.get_parent().get_parent()
		var north := compass.find_child("NorthBtn", true, false) as Button
		var south := compass.find_child("SouthBtn", true, false) as Button
		var west := compass.find_child("WestBtn", true, false) as Button
		var east := compass.find_child("EastBtn", true, false) as Button

		_style_compass_button(north, available_exits.has("north"))
		_style_compass_button(south, available_exits.has("south"))
		_style_compass_button(west, available_exits.has("west"))
		_style_compass_button(east, available_exits.has("east"))


func _style_compass_button(btn: Button, is_available: bool) -> void:
	if btn == null:
		return

	btn.disabled = not is_available

	if is_available:
		btn.modulate = Color(1.0, 1.0, 1.0, 1.0)
		btn.add_theme_color_override("font_color", Color(0.22, 0.16, 0.10))
		btn.add_theme_color_override("font_hover_color", Color(0.35, 0.25, 0.15))
		btn.add_theme_color_override("font_pressed_color", Color(0.15, 0.10, 0.05))
	else:
		btn.modulate = Color(0.6, 0.6, 0.6, 0.5)
		btn.add_theme_color_override("font_color", Color(0.5, 0.45, 0.4))
		btn.add_theme_color_override("font_disabled_color", Color(0.5, 0.45, 0.4))


# =============================================================================
# Signal Handlers
# =============================================================================

func _connect_signals() -> void:
	# Room and navigation
	GameState.room_changed.connect(_on_room_changed)
	GameState.navigation_failed.connect(_on_navigation_failed)
	GameState.entity_context_received.connect(_on_entity_context_received)

	# Dialogue - connect to GameState (which routes from PhoenixClient)
	GameState.dialogue_changed.connect(_on_dialogue_changed)
	GameState.dialogue_ended.connect(_on_dialogue_ended)

	# Events - connect to GameState's event changes
	GameState.events_changed.connect(_on_events_changed)

	# Page changes from GameState
	GameState.page_changed.connect(_on_game_state_page_changed)

	# Atmosphere changes
	GameState.atmosphere_changed.connect(_on_atmosphere_changed)


func _on_room_changed(room: MockWorld.Room) -> void:
	events.clear()
	if current_page == PageType.ROOM:
		display_room(room)


func _on_navigation_failed(direction: String, reason: String) -> void:
	GameState.add_event(reason)


## Called when GameState's event log changes
func _on_events_changed() -> void:
	# Sync local events from GameState
	events.clear()
	for evt in GameState.events:
		events.append(evt)

	# Re-render room if we're on room page
	if current_page == PageType.ROOM and GameState.current_room:
		display_room(GameState.current_room)
		await get_tree().process_frame
		top_page.label.scroll_to_line(top_page.label.get_line_count())


## Called when GameState's page changes
func _on_game_state_page_changed(new_page: GameState.PageType) -> void:
	# Map GameState.PageType to our local PageType
	match new_page:
		GameState.PageType.ROOM:
			current_page = PageType.ROOM
			top_page.bottom_bar.visible = true
			if GameState.current_room:
				_render_room_to_page(top_page, GameState.current_room)
		GameState.PageType.MENU:
			current_page = PageType.MENU
			top_page.bottom_bar.visible = true
			_render_menu_to_page(top_page)
		GameState.PageType.ENTITY:
			current_page = PageType.ENTITY
			top_page.bottom_bar.visible = false
			if not GameState.current_entity.is_empty():
				current_entity = GameState.current_entity
				_render_entity_to_page(top_page, current_entity)
		GameState.PageType.DIALOGUE:
			current_page = PageType.DIALOGUE
			top_page.bottom_bar.visible = false
			_render_dialogue_from_game_state(top_page)
		GameState.PageType.SHOP:
			current_page = PageType.SHOP
			top_page.bottom_bar.visible = false
			_render_shop_to_page(top_page)
		GameState.PageType.CONTAINER:
			current_page = PageType.CONTAINER
			top_page.bottom_bar.visible = false
			_render_container_to_page(top_page)


## Called when atmosphere changes (for visual mood)
func _on_atmosphere_changed(atmo: String) -> void:
	var tint := Color(1.0, 1.0, 1.0, 1.0)

	match atmo:
		"peaceful":
			tint = Color(1.0, 1.0, 1.0, 1.0)  # No tint
		"tense":
			tint = Color(1.0, 0.95, 0.9, 1.0)  # Slight warm/red tint
		"danger":
			tint = Color(1.0, 0.9, 0.85, 1.0)  # More red
		"night":
			tint = Color(0.85, 0.88, 1.0, 1.0)  # Blue tint
		"storm":
			tint = Color(0.9, 0.9, 0.95, 1.0)  # Grey tint
		"mystical":
			tint = Color(0.95, 0.9, 1.0, 1.0)  # Purple tint
		"holy":
			tint = Color(1.0, 1.0, 0.95, 1.0)  # Golden tint

	# Apply to both pages
	if top_page and top_page.shader_material:
		top_page.shader_material.set_shader_parameter("atmosphere_tint", tint)
	if bottom_page and bottom_page.shader_material:
		bottom_page.shader_material.set_shader_parameter("atmosphere_tint", tint)

	print("[BookPage] Atmosphere changed to: %s" % atmo)


func _on_entity_context_received(entity_data: Dictionary) -> void:
	print("[BookPage] Entity context received: %s with %d actions" % [
		entity_data.get("name", "unknown"),
		entity_data.get("actions", []).size()
	])
	var entity := _convert_server_entity(entity_data)
	show_entity_details(entity)


func _convert_server_entity(data: Dictionary) -> Dictionary:
	return {
		"key": data.get("key", data.get("id", "")),
		"name": data.get("name", "Unknown"),
		"long_desc": data.get("long_desc", ""),
		"description": data.get("description", ""),
		"type": data.get("type", "npc"),
		"actions": data.get("actions", [])
	}


# =============================================================================
# Entity Interaction
# =============================================================================

func show_entity_details(entity: Variant) -> void:
	current_entity = entity
	current_page = PageType.ENTITY
	top_page.bottom_bar.visible = false
	_render_entity_to_page(top_page, entity)


func go_back_to_room() -> void:
	current_entity = null
	current_page = PageType.ROOM
	top_page.bottom_bar.visible = true
	if GameState.current_room:
		_render_room_to_page(top_page, GameState.current_room)


func _execute_entity_action(action_key: String) -> void:
	var entity_key: String = _get_entity_prop(current_entity, "key", "")
	match action_key:
		"talk":
			_on_entity_talk_pressed()
		"look":
			_on_entity_examine_pressed()
		"leave":
			go_back_to_room()
		"shop":
			add_event("Shop not yet implemented")
		"attack":
			add_event("Combat not yet implemented")
		"get":
			if GameState.is_online:
				GameState.entity_action("get", entity_key)
			go_back_to_room()
		_:
			if GameState.is_online:
				GameState.entity_action(action_key, entity_key)
			else:
				add_event("Action '%s' not available offline" % action_key)


func _on_entity_talk_pressed() -> void:
	if current_entity == null:
		return
	if GameState.is_online:
		GameState.entity_action("talk", _get_entity_prop(current_entity, "key", ""))
	else:
		_start_mock_dialogue(current_entity)


func _on_entity_examine_pressed() -> void:
	if current_entity == null:
		return
	add_event("You examine %s closely." % _get_entity_prop(current_entity, "name", "it"))


func _select_npc_by_key(npc_key: String) -> void:
	var room := GameState.current_room
	if room == null:
		return

	for npc in room.npcs:
		# Use direct property access for MockWorld.NPC objects
		if npc.key == npc_key:
			_click_entity(npc)
			return


func _select_item_by_key(item_key: String) -> void:
	var room := GameState.current_room
	if room == null:
		return

	for item in room.items:
		# Use direct property access for MockWorld.Item objects
		if item.key == item_key:
			_click_entity(item)
			return


func _click_entity(entity: Variant) -> void:
	var entity_id: String = _get_entity_prop(entity, "id", "")
	if entity_id == "":
		entity_id = _get_entity_prop(entity, "key", "")

	if GameState.is_online and entity_id != "":
		GameState.click_entity(entity_id)
	else:
		show_entity_details(entity)


# =============================================================================
# Menu Click Handling
# =============================================================================

func _handle_menu_click(tab_key: String) -> void:
	match tab_key:
		"inventory":
			current_menu_tab = MenuTab.INVENTORY
		"equipment":
			current_menu_tab = MenuTab.EQUIPMENT
		"character":
			current_menu_tab = MenuTab.CHARACTER
		"quests":
			current_menu_tab = MenuTab.QUESTS
		"map":
			current_menu_tab = MenuTab.MAP
		"social":
			current_menu_tab = MenuTab.SOCIAL
		"settings":
			current_menu_tab = MenuTab.SETTINGS
		"quit":
			# Emit signal for main to handle logout
			bottom_bar_pressed.emit("quit")
			return

	_render_menu_to_page(top_page)


# =============================================================================
# Shop Click Handling (delegates to handler)
# =============================================================================

func _handle_shop_click(action: String) -> void:
	_shop_container_handler.handle_shop_click(action)


# =============================================================================
# Container Click Handling (delegates to handler)
# =============================================================================

func _handle_container_click(action: String) -> void:
	_shop_container_handler.handle_container_click(action)


# =============================================================================
# Events
# =============================================================================

## Add an event to the log (delegates to GameState)
func add_event(text: String) -> void:
	var clean_text := _strip_html_tags(text)
	GameState.add_event(clean_text)
	# GameState.events_changed signal will trigger _on_events_changed


## Clear all events (delegates to GameState)
func clear_events() -> void:
	GameState.clear_events()
	# GameState.events_changed signal will trigger _on_events_changed


# =============================================================================
# Menu Navigation
# =============================================================================

func next_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY:
			current_menu_tab = MenuTab.EQUIPMENT
		MenuTab.EQUIPMENT:
			current_menu_tab = MenuTab.CHARACTER
		MenuTab.CHARACTER:
			current_menu_tab = MenuTab.QUESTS
		MenuTab.QUESTS:
			current_menu_tab = MenuTab.MAP
		MenuTab.MAP:
			current_menu_tab = MenuTab.SOCIAL
		MenuTab.SOCIAL:
			current_menu_tab = MenuTab.SETTINGS
		MenuTab.SETTINGS:
			current_menu_tab = MenuTab.INVENTORY
	display_menu()


func prev_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY:
			current_menu_tab = MenuTab.SETTINGS
		MenuTab.EQUIPMENT:
			current_menu_tab = MenuTab.INVENTORY
		MenuTab.CHARACTER:
			current_menu_tab = MenuTab.EQUIPMENT
		MenuTab.QUESTS:
			current_menu_tab = MenuTab.CHARACTER
		MenuTab.MAP:
			current_menu_tab = MenuTab.QUESTS
		MenuTab.SOCIAL:
			current_menu_tab = MenuTab.MAP
		MenuTab.SETTINGS:
			current_menu_tab = MenuTab.SOCIAL
	display_menu()


# Menu content functions extracted to MenuTabRenderer


# =============================================================================
# Dialogue System
# =============================================================================

## Called when GameState dialogue changes (replaces direct PhoenixClient connection)
func _on_dialogue_changed(data: Dictionary) -> void:
	print("[BookPage] Dialogue changed: ", data.get("speaker", "unknown"))
	_is_mock_dialogue = false

	# GameState manages dialogue_data and dialogue_history now
	# We just need to update our local display state
	dialogue_data = data
	pre_dialogue_page = current_page
	current_page = PageType.DIALOGUE
	top_page.bottom_bar.visible = false

	# Render using GameState's dialogue_history
	_render_dialogue_from_game_state(top_page)


func _on_dialogue_ended() -> void:
	print("[BookPage] Dialogue ended")
	dialogue_data = {}
	dialogue_history = []
	current_page = pre_dialogue_page

	# Return to the appropriate page
	match pre_dialogue_page:
		PageType.ENTITY:
			top_page.bottom_bar.visible = false
			if current_entity:
				_render_entity_to_page(top_page, current_entity)
		PageType.ROOM, _:
			top_page.bottom_bar.visible = true
			if GameState.current_room:
				_render_room_to_page(top_page, GameState.current_room)


## Render dialogue using GameState as source of truth (delegates to content renderer)
func _render_dialogue_from_game_state(page: PageMeshFactory.PageMesh) -> void:
	var data: Dictionary = GameState.dialogue_data
	if data.is_empty():
		page.label.text = ""
		return

	page.label.text = _content_renderer.render_dialogue(data, GameState.dialogue_history)


func _select_dialogue_choice(choice_index: int) -> void:
	# Add player's choice to history (for display)
	if choice_index >= 0:
		var choices: Array = GameState.dialogue_data.get("choices", [])
		if choice_index < choices.size():
			var choice: Dictionary = choices[choice_index]
			var choice_text: String = choice.get("text", "Continue")
			var choice_event: String = choice.get("event", "")  # e.g., "Accept Quest"
			# Add to local history for immediate display
			dialogue_history.append({"speaker": "You", "text": choice_text, "is_player": true, "event": choice_event})
			# Also add to GameState's history
			GameState.dialogue_history.append({"speaker": "You", "text": choice_text, "is_player": true, "event": choice_event})

	if _is_mock_dialogue:
		_advance_mock_dialogue(choice_index)
		return

	# Use GameState to send the choice to server
	GameState.select_dialogue_choice(choice_index if choice_index >= 0 else 0)


func _start_mock_dialogue(entity: Variant) -> void:
	_mock_dialogue_node = 0
	_is_mock_dialogue = true
	var mock_data := _get_mock_dialogue_node(entity, 0)

	# Set up dialogue state locally for mock dialogue
	dialogue_data = mock_data
	dialogue_history = []
	pre_dialogue_page = current_page
	current_page = PageType.DIALOGUE
	top_page.bottom_bar.visible = false

	# Add initial NPC line to history
	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})

	_render_dialogue_to_page(top_page, mock_data)


func _advance_mock_dialogue(choice_index: int) -> void:
	_mock_dialogue_node += 1

	if _mock_dialogue_node >= 2:
		_on_dialogue_ended()
		return

	var mock_data := _get_mock_dialogue_node(current_entity, _mock_dialogue_node)
	dialogue_data = mock_data

	# Add NPC response to history
	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})

	_render_dialogue_to_page(top_page, mock_data)


func _get_mock_dialogue_node(entity: Variant, node_index: int) -> Dictionary:
	var name: String = _get_entity_prop(entity, "name", "Someone") if entity else "Someone"

	if node_index == 0:
		return {
			"entity_id": _get_entity_prop(entity, "key", "unknown") if entity else "unknown",
			"node_id": "start",
			"speaker": name,
			"text": "Greetings, traveler. The mountain has been expecting you. Strange happenings have befallen our monastery of late.",
			"choices": [
				{"text": "Tell me more about these happenings."},
				{"text": "I'm just passing through."},
				{"text": "Farewell."}
			]
		}
	else:
		return {
			"entity_id": _get_entity_prop(entity, "key", "unknown") if entity else "unknown",
			"node_id": "more_info",
			"speaker": name,
			"text": "The demons have grown restless. Master Tenzin went to investigate the old temple, but has not returned. We fear the worst.",
			"choices": [
				{"text": "I will find him.", "event": "Accept Quest"},
				{"text": "That sounds dangerous."}
			]
		}


# =============================================================================
# Utility Functions
# =============================================================================

func _strip_html_tags(text: String) -> String:
	var regex := RegEx.new()
	regex.compile("<[^>]*>")
	return regex.sub(text, "", true)


func _get_entity_prop(entity: Variant, prop: String, default: Variant = "") -> Variant:
	if entity is Dictionary:
		return entity.get(prop, default)
	else:
		var value = entity.get(prop)
		if value == null:
			return default
		return value
