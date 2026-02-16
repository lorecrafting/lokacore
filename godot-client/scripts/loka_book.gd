## 2D book interface using PageFlip plugin for page turn animations.
## Replaces the 3D BookPage system with bone-based page deformation.
## Handles page state, content rendering, input, and effects.
##
## Architecture:
##   LokaBook (Node2D)
##     PageFlip2D (addons/PageFlip) - manages bone deformation, volume, spine, sound
##     EffectsController - text effects (burn/ice/glow/fade) + atmosphere
##
## PageFlip slot usage:
##   Slot 1 (left static):  decorative parchment page
##   Slot 2 (right static): active game content (room/menu/entity/dialogue/shop/container)
##   Slot 3 (anim face A):  current content (during page turn)
##   Slot 4 (anim face B):  new content (during page turn)
extends Node2D
class_name LokaBook

## Emitted when page turn animation starts
signal page_turn_started(direction: String)

## Emitted when page turn animation completes
signal page_turn_completed(direction: String)

## Emitted when a bottom bar button is tapped (forwarded from BottomBar)
signal bottom_bar_pressed(button: String)

## Page types
enum PageType { ROOM, MENU, ENTITY, DIALOGUE, SHOP, CONTAINER }

## Menu tabs (7 tabs)
enum MenuTab { INVENTORY, EQUIPMENT, CHARACTER, QUESTS, MAP, SOCIAL, SETTINGS }

## Text effects (forwarded from EffectsController)
enum TextEffect { NONE = 0, BURN = 1, ICE = 2, GLOW = 3, FADE = 4 }

## Event feed settings
const MAX_EVENTS := 5
const EVENT_FADE_TIME := 10.0

# =============================================================================
# State
# =============================================================================

## Current page state
var current_page: PageType = PageType.ROOM
var current_menu_tab: MenuTab = MenuTab.INVENTORY
var pending_page: PageType = PageType.ROOM
var current_entity: Variant = null
var current_entity_actions: Array = []

## Dialogue state
var dialogue_data: Dictionary = {}
var dialogue_history: Array = []
var pre_dialogue_page: PageType = PageType.ROOM

## Event feed
var events: Array[Dictionary] = []

## Available exits (for compass)
var available_exits: Array = []

## Debug mode
var debug_mode: bool = true

## Mock dialogue state
var _mock_dialogue_node: int = 0
var _is_mock_dialogue: bool = false

## JavaScript callbacks (prevent GC)
var _js_effect_callback: JavaScriptObject
var _js_curl_callback: JavaScriptObject
var _js_flip_callback: JavaScriptObject

# =============================================================================
# Component References
# =============================================================================

## PageFlip2D node (set from main scene or created dynamically)
var _page_flip: PageFlip2D

## Page content (right page = active game content)
var _right_page: PageContentManager.PageContent
var _right_page_back: PageContentManager.PageContent  # Back buffer for page turns

## Effects controller
var _effects: EffectsController

## Extracted components (same as BookPage)
var _menu_renderer: MenuTabRenderer
var _dialogue_controller: DialogueController
var _content_manager: PageContentManager
var _shop_container_handler: ShopContainerHandler
var _content_renderer: PageContentRenderer

## Decorative left page viewport
var _left_page_viewport: SubViewport

## Turn animation state
var _is_turning: bool = false
var _pending_turn_direction: String = ""

# =============================================================================
# Drag/scroll state
# =============================================================================
var _drag_start_pos: Vector2 = Vector2.ZERO
var _is_dragging: bool = false
var _drag_start_scroll: int = 0


func _ready() -> void:
	# Initialize components
	_menu_renderer = MenuTabRenderer.new()
	_dialogue_controller = DialogueController.new()
	_content_manager = PageContentManager.new()
	_shop_container_handler = ShopContainerHandler.new()
	_shop_container_handler.set_event_callback(add_event)
	_content_renderer = PageContentRenderer.new()

	# Find or create PageFlip2D
	_page_flip = _find_or_create_page_flip()

	# Create page content viewports
	_right_page = _content_manager.create_page_content(_on_label_meta_clicked, true)
	_right_page_back = _content_manager.create_page_content(_on_label_meta_clicked, true)
	_left_page_viewport = _content_manager.create_decorative_page()

	# Add viewports as children (required for rendering)
	add_child(_right_page.viewport)
	add_child(_right_page_back.viewport)
	add_child(_left_page_viewport)

	# Setup effects
	_effects = EffectsController.new()
	add_child(_effects)
	_effects.setup(_right_page.viewport)

	# Connect PageFlip signals
	if _page_flip:
		_page_flip.ended_page_flip_animation.connect(_on_page_flip_ended)
		_page_flip.started_page_flip_animation.connect(_on_page_flip_started)

	_connect_game_state_signals()
	_setup_javascript_callbacks()

	if debug_mode:
		print("=== Loka Book (2D PageFlip) ===")
		print("  Space: Flip page right")
		print("  Shift+Space: Flip page left")
		print("  1-4: Text effects  0: Clear")
		print("  D: Test dialogue (offline)")
		print("===============================")

	# Wait for viewports to render, then inject into PageFlip
	await get_tree().process_frame
	await get_tree().process_frame
	_inject_content_into_page_flip()

	# Display initial room if available
	if GameState.current_room:
		_render_room_to_page(_right_page, GameState.current_room)


func _find_or_create_page_flip() -> PageFlip2D:
	# Look for existing PageFlip2D child
	for child in get_children():
		if child is PageFlip2D:
			return child

	# Instance from the addon scene
	var scene := load("res://addons/PageFlip/page_flip.tscn")
	if scene:
		var instance := scene.instantiate() as PageFlip2D
		if instance:
			# Configure for our use case
			instance.target_page_size = Vector2(PageContentManager.VIEWPORT_WIDTH, PageContentManager.VIEWPORT_HEIGHT)
			instance.start_option = PageFlip2D.StartOption.OPEN_AT_PAGE
			instance.start_page = 1
			instance.close_condition = PageFlip2D.CloseCondition.NEVER
			instance.covers_are_rigid = true
			instance.enable_composite_pages = false

			# Use a single spread (left = decorative, right = game content)
			# We provide 2 pages so PageFlip has 1 spread + covers
			instance.pages_paths = []

			# Volume settings for a thick book feel
			instance.min_layers = 3
			instance.max_layers = 10
			instance.spine_width = 12.0
			instance.volume_color = Color(0.75, 0.68, 0.55)

			add_child(instance)
			print("[LokaBook] Created PageFlip2D from scene")
			return instance

	print("[LokaBook] Warning: Could not load PageFlip scene. Page turn animations disabled.")
	return null


## Inject our dynamic viewports into PageFlip's slot system
func _inject_content_into_page_flip() -> void:
	if not _page_flip:
		return

	# We use PageFlip in dynamic mode: manage our own viewport textures
	# Slot 1 (left static) = decorative parchment
	# Slot 2 (right static) = active game content
	if _page_flip._slot_1:
		# Clear existing content and inject our viewport texture
		_clear_slot(_page_flip._slot_1)
		var left_rect := TextureRect.new()
		left_rect.texture = _left_page_viewport.get_texture()
		left_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		left_rect.stretch_mode = TextureRect.STRETCH_SCALE
		left_rect.size = _page_flip._slot_1.size
		_page_flip._slot_1.add_child(left_rect)

	if _page_flip._slot_2:
		_clear_slot(_page_flip._slot_2)
		var right_rect := TextureRect.new()
		right_rect.texture = _right_page.viewport.get_texture()
		right_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		right_rect.stretch_mode = TextureRect.STRETCH_SCALE
		right_rect.size = _page_flip._slot_2.size
		_page_flip._slot_2.add_child(right_rect)

	# Update static visuals
	if _page_flip.static_left:
		_page_flip.static_left.texture = _page_flip._slot_1.get_texture()
		_page_flip.static_left.visible = true
	if _page_flip.static_right:
		_page_flip.static_right.texture = _page_flip._slot_2.get_texture()
		_page_flip.static_right.visible = true


func _clear_slot(slot: SubViewport) -> void:
	for child in slot.get_children():
		child.queue_free()


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

	print("[LokaBook] JavaScript callbacks registered for web debug toolbar")


func _on_js_trigger_effect(args: Array) -> void:
	if args.size() < 1:
		return
	var effect_name: String = str(args[0])
	match effect_name:
		"burn": start_text_effect(TextEffect.BURN)
		"ice": start_text_effect(TextEffect.ICE)
		"glow": start_text_effect(TextEffect.GLOW)
		"fade": start_text_effect(TextEffect.FADE)
		"clear": stop_text_effect()


func _on_js_trigger_curl(_args: Array) -> void:
	turn_page("right")


func _on_js_trigger_flip(args: Array) -> void:
	if args.size() < 1:
		return
	turn_page(str(args[0]))


# =============================================================================
# Input Handling
# =============================================================================

func _input(event: InputEvent) -> void:
	if not visible:
		return

	# Mouse wheel scrolling
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_scroll_page(-3)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_scroll_page(3)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_drag_start_pos = event.position
				_drag_start_scroll = _right_page.label.get_v_scroll_bar().value
				_is_dragging = true
			else:
				if _is_dragging and _drag_start_pos.distance_to(event.position) < 10:
					_handle_page_click(event.position)
				_is_dragging = false

	# Mouse drag for scroll
	elif event is InputEventMouseMotion and _is_dragging:
		var delta_y: float = event.position.y - _drag_start_pos.y
		var scroll_delta: float = -delta_y * 1.5
		_right_page.label.get_v_scroll_bar().value = _drag_start_scroll + scroll_delta

	# Touch
	elif event is InputEventScreenTouch:
		if event.pressed:
			_drag_start_pos = event.position
			_drag_start_scroll = _right_page.label.get_v_scroll_bar().value
			_is_dragging = true
		else:
			if _is_dragging and _drag_start_pos.distance_to(event.position) < 10:
				_handle_page_click(event.position)
			_is_dragging = false

	# Touch drag
	elif event is InputEventScreenDrag and _is_dragging:
		var delta_y: float = event.position.y - _drag_start_pos.y
		var scroll_delta: float = -delta_y * 1.5
		_right_page.label.get_v_scroll_bar().value = _drag_start_scroll + scroll_delta

	# Keyboard shortcuts
	if event is InputEventKey and event.pressed:
		_handle_keyboard_shortcut(event)


func _scroll_page(lines: int) -> void:
	var scrollbar := _right_page.label.get_v_scroll_bar()
	scrollbar.value += lines * 20


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
		KEY_D:
			_test_dialogue()
		KEY_R:
			stop_text_effect()


func _test_dialogue() -> void:
	if _is_turning:
		return
	var mock_entity := MockWorld.NPC.new(
		"test_npc", "test_npc", "Mysterious Stranger", "stranger",
		"A mysterious stranger stands here.", "A cloaked figure shrouded in shadow."
	)
	current_entity = mock_entity
	_start_mock_dialogue(mock_entity)


# =============================================================================
# Text Effects (delegates to EffectsController)
# =============================================================================

func start_text_effect(effect: TextEffect) -> void:
	_effects.start_effect(effect as EffectsController.TextEffect)


func stop_text_effect() -> void:
	_effects.stop_effect()


# =============================================================================
# Click Handling (2D - direct viewport coordinates)
# =============================================================================

func _handle_page_click(screen_pos: Vector2) -> void:
	# In 2D, we can convert screen position directly to viewport coordinates
	# The right page viewport fills the right half of the book
	var viewport_size := get_viewport().get_visible_rect().size

	# Map screen position to page viewport coordinates
	# PageFlip occupies the screen, right page is the right half
	var page_size := Vector2(PageContentManager.VIEWPORT_WIDTH, PageContentManager.VIEWPORT_HEIGHT)

	# Simple mapping: screen coords -> viewport coords proportionally
	var vp_x := (screen_pos.x / viewport_size.x) * page_size.x
	var vp_y := (screen_pos.y / viewport_size.y) * page_size.y

	# Forward click to text viewport
	_forward_click_to_viewport(vp_x, vp_y)


func _forward_click_to_viewport(vp_x: float, vp_y: float) -> void:
	var press_event := InputEventMouseButton.new()
	press_event.button_index = MOUSE_BUTTON_LEFT
	press_event.pressed = true
	press_event.position = Vector2(vp_x, vp_y)
	press_event.global_position = Vector2(vp_x, vp_y)

	_right_page.viewport.push_input(press_event)

	var release_event := InputEventMouseButton.new()
	release_event.button_index = MOUSE_BUTTON_LEFT
	release_event.pressed = false
	release_event.position = Vector2(vp_x, vp_y)
	release_event.global_position = Vector2(vp_x, vp_y)
	_right_page.viewport.push_input(release_event)


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
			_select_npc_by_key(meta_str.substr(4))
		elif meta_str.begins_with("item:"):
			_select_item_by_key(meta_str.substr(5))

	elif current_page == PageType.MENU:
		if meta_str.begins_with("menu:"):
			_handle_menu_click(meta_str.substr(5))

	elif current_page == PageType.SHOP:
		if meta_str.begins_with("shop:"):
			_handle_shop_click(meta_str.substr(5))

	elif current_page == PageType.CONTAINER:
		if meta_str.begins_with("container:"):
			_handle_container_click(meta_str.substr(10))


# =============================================================================
# Page Turn Animation
# =============================================================================

func turn_page(direction: String = "right") -> void:
	if _is_turning:
		return

	if _page_flip:
		_is_turning = true
		_pending_turn_direction = direction

		# Pre-render new content to back buffer
		_render_pending_content_to_page(_right_page_back, pending_page)

		# Inject back buffer into animation slots
		if _page_flip._slot_3:
			_clear_slot(_page_flip._slot_3)
			var face_a := TextureRect.new()
			face_a.texture = _right_page.viewport.get_texture()
			face_a.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			face_a.stretch_mode = TextureRect.STRETCH_SCALE
			face_a.size = _page_flip._slot_3.size
			_page_flip._slot_3.add_child(face_a)

		if _page_flip._slot_4:
			_clear_slot(_page_flip._slot_4)
			var face_b := TextureRect.new()
			face_b.texture = _right_page_back.viewport.get_texture()
			face_b.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			face_b.stretch_mode = TextureRect.STRETCH_SCALE
			face_b.size = _page_flip._slot_4.size
			_page_flip._slot_4.add_child(face_b)

		page_turn_started.emit(direction)

		if direction == "right":
			_page_flip.next_page()
		else:
			_page_flip.prev_page()
	else:
		# No PageFlip - instant swap
		_render_pending_content_to_page(_right_page, pending_page)
		current_page = pending_page
		page_turn_started.emit(direction)
		page_turn_completed.emit(direction)


func _on_page_flip_started() -> void:
	pass  # Animation started


func _on_page_flip_ended() -> void:
	_is_turning = false

	# Swap buffers: back becomes front
	var temp := _right_page
	_right_page = _right_page_back
	_right_page_back = temp

	# Update the static right slot with new content
	if _page_flip and _page_flip._slot_2:
		_clear_slot(_page_flip._slot_2)
		var right_rect := TextureRect.new()
		right_rect.texture = _right_page.viewport.get_texture()
		right_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		right_rect.stretch_mode = TextureRect.STRETCH_SCALE
		right_rect.size = _page_flip._slot_2.size
		_page_flip._slot_2.add_child(right_rect)

		if _page_flip.static_right:
			_page_flip.static_right.texture = _page_flip._slot_2.get_texture()

	current_page = pending_page
	page_turn_completed.emit(_pending_turn_direction)


func switch_to_page(page_type: PageType, direction: String = "right") -> void:
	if _is_turning:
		return
	pending_page = page_type
	turn_page(direction)


# =============================================================================
# Content Rendering
# =============================================================================

func _render_pending_content_to_page(page: PageContentManager.PageContent, page_type: PageType) -> void:
	match page_type:
		PageType.ROOM:
			if GameState.current_room:
				_render_room_to_page(page, GameState.current_room)
		PageType.MENU:
			_render_menu_to_page(page)
		PageType.ENTITY:
			if current_entity:
				_render_entity_to_page(page, current_entity)
		PageType.DIALOGUE:
			if not dialogue_data.is_empty():
				_render_dialogue_to_page(page, dialogue_data)
		PageType.SHOP:
			_render_shop_to_page(page)
		PageType.CONTAINER:
			_render_container_to_page(page)


func _render_room_to_page(page: PageContentManager.PageContent, room: MockWorld.Room) -> void:
	if room == null:
		page.label.text = ""
		return
	available_exits = room.exits.keys() if room.exits else []
	page.label.text = _content_renderer.render_room(room, events)


func _render_menu_to_page(page: PageContentManager.PageContent) -> void:
	page.label.text = _content_renderer.render_menu(current_menu_tab, _menu_renderer)


func _render_entity_to_page(page: PageContentManager.PageContent, entity: Variant) -> void:
	if entity == null:
		page.label.text = ""
		return
	var result := _content_renderer.render_entity(entity)
	page.label.text = result.text
	current_entity_actions = result.actions


func _render_shop_to_page(page: PageContentManager.PageContent) -> void:
	page.label.text = _shop_container_handler.render_shop()


func _render_container_to_page(page: PageContentManager.PageContent) -> void:
	page.label.text = _shop_container_handler.render_container()


func _render_dialogue_to_page(page: PageContentManager.PageContent, data: Dictionary) -> void:
	if data.is_empty():
		page.label.text = ""
		return
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


func _render_dialogue_from_game_state(page: PageContentManager.PageContent) -> void:
	var data: Dictionary = GameState.dialogue_data
	if data.is_empty():
		page.label.text = ""
		return
	page.label.text = _content_renderer.render_dialogue(data, GameState.dialogue_history)


# =============================================================================
# Display Methods (convenience wrappers for current page)
# =============================================================================

func display_room(room: MockWorld.Room) -> void:
	_render_room_to_page(_right_page, room)

func display_menu() -> void:
	_render_menu_to_page(_right_page)

func display_entity(entity: Variant) -> void:
	_render_entity_to_page(_right_page, entity)

func display_dialogue(data: Dictionary) -> void:
	_render_dialogue_to_page(_right_page, data)


# =============================================================================
# Signal Handlers
# =============================================================================

func _connect_game_state_signals() -> void:
	GameState.room_changed.connect(_on_room_changed)
	GameState.navigation_failed.connect(_on_navigation_failed)
	GameState.entity_context_received.connect(_on_entity_context_received)
	GameState.dialogue_changed.connect(_on_dialogue_changed)
	GameState.dialogue_ended.connect(_on_dialogue_ended)
	GameState.events_changed.connect(_on_events_changed)
	GameState.page_changed.connect(_on_game_state_page_changed)
	GameState.atmosphere_changed.connect(_on_atmosphere_changed)


func _on_room_changed(room: MockWorld.Room) -> void:
	events.clear()
	if current_page == PageType.ROOM:
		display_room(room)


func _on_navigation_failed(_direction: String, reason: String) -> void:
	GameState.add_event(reason)


func _on_events_changed() -> void:
	events.clear()
	for evt in GameState.events:
		events.append(evt)
	if current_page == PageType.ROOM and GameState.current_room:
		display_room(GameState.current_room)
		await get_tree().process_frame
		_right_page.label.scroll_to_line(_right_page.label.get_line_count())


func _on_game_state_page_changed(new_page: GameState.PageType) -> void:
	match new_page:
		GameState.PageType.ROOM:
			current_page = PageType.ROOM
			if GameState.current_room:
				_render_room_to_page(_right_page, GameState.current_room)
		GameState.PageType.MENU:
			current_page = PageType.MENU
			_render_menu_to_page(_right_page)
		GameState.PageType.ENTITY:
			current_page = PageType.ENTITY
			if not GameState.current_entity.is_empty():
				current_entity = GameState.current_entity
				_render_entity_to_page(_right_page, current_entity)
		GameState.PageType.DIALOGUE:
			current_page = PageType.DIALOGUE
			_render_dialogue_from_game_state(_right_page)
		GameState.PageType.SHOP:
			current_page = PageType.SHOP
			_render_shop_to_page(_right_page)
		GameState.PageType.CONTAINER:
			current_page = PageType.CONTAINER
			_render_container_to_page(_right_page)


func _on_atmosphere_changed(atmo: String) -> void:
	_effects.set_atmosphere(atmo)


func _on_entity_context_received(entity_data: Dictionary) -> void:
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


func _on_dialogue_changed(data: Dictionary) -> void:
	_is_mock_dialogue = false
	dialogue_data = data
	pre_dialogue_page = current_page
	current_page = PageType.DIALOGUE
	_render_dialogue_from_game_state(_right_page)


func _on_dialogue_ended() -> void:
	dialogue_data = {}
	dialogue_history = []
	current_page = pre_dialogue_page
	match pre_dialogue_page:
		PageType.ENTITY:
			if current_entity:
				_render_entity_to_page(_right_page, current_entity)
		PageType.ROOM, _:
			if GameState.current_room:
				_render_room_to_page(_right_page, GameState.current_room)


# =============================================================================
# Entity Interaction
# =============================================================================

func show_entity_details(entity: Variant) -> void:
	current_entity = entity
	current_page = PageType.ENTITY
	_render_entity_to_page(_right_page, entity)


func go_back_to_room() -> void:
	current_entity = null
	current_page = PageType.ROOM
	if GameState.current_room:
		_render_room_to_page(_right_page, GameState.current_room)


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
		if npc.key == npc_key:
			_click_entity(npc)
			return


func _select_item_by_key(item_key: String) -> void:
	var room := GameState.current_room
	if room == null:
		return
	for item in room.items:
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
		"inventory": current_menu_tab = MenuTab.INVENTORY
		"equipment": current_menu_tab = MenuTab.EQUIPMENT
		"character": current_menu_tab = MenuTab.CHARACTER
		"quests": current_menu_tab = MenuTab.QUESTS
		"map": current_menu_tab = MenuTab.MAP
		"social": current_menu_tab = MenuTab.SOCIAL
		"settings": current_menu_tab = MenuTab.SETTINGS
		"quit":
			bottom_bar_pressed.emit("quit")
			return
	_render_menu_to_page(_right_page)


func _handle_shop_click(action: String) -> void:
	_shop_container_handler.handle_shop_click(action)


func _handle_container_click(action: String) -> void:
	_shop_container_handler.handle_container_click(action)


# =============================================================================
# Events
# =============================================================================

func add_event(text: String) -> void:
	var clean_text := _strip_html_tags(text)
	GameState.add_event(clean_text)


func clear_events() -> void:
	GameState.clear_events()


# =============================================================================
# Menu Navigation
# =============================================================================

func next_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY: current_menu_tab = MenuTab.EQUIPMENT
		MenuTab.EQUIPMENT: current_menu_tab = MenuTab.CHARACTER
		MenuTab.CHARACTER: current_menu_tab = MenuTab.QUESTS
		MenuTab.QUESTS: current_menu_tab = MenuTab.MAP
		MenuTab.MAP: current_menu_tab = MenuTab.SOCIAL
		MenuTab.SOCIAL: current_menu_tab = MenuTab.SETTINGS
		MenuTab.SETTINGS: current_menu_tab = MenuTab.INVENTORY
	display_menu()


func prev_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY: current_menu_tab = MenuTab.SETTINGS
		MenuTab.EQUIPMENT: current_menu_tab = MenuTab.INVENTORY
		MenuTab.CHARACTER: current_menu_tab = MenuTab.EQUIPMENT
		MenuTab.QUESTS: current_menu_tab = MenuTab.CHARACTER
		MenuTab.MAP: current_menu_tab = MenuTab.QUESTS
		MenuTab.SOCIAL: current_menu_tab = MenuTab.MAP
		MenuTab.SETTINGS: current_menu_tab = MenuTab.SOCIAL
	display_menu()


# =============================================================================
# Dialogue System
# =============================================================================

func _select_dialogue_choice(choice_index: int) -> void:
	if choice_index >= 0:
		var choices: Array = GameState.dialogue_data.get("choices", [])
		if choice_index < choices.size():
			var choice: Dictionary = choices[choice_index]
			var choice_text: String = choice.get("text", "Continue")
			var choice_event: String = choice.get("event", "")
			dialogue_history.append({"speaker": "You", "text": choice_text, "is_player": true, "event": choice_event})
			GameState.dialogue_history.append({"speaker": "You", "text": choice_text, "is_player": true, "event": choice_event})

	if _is_mock_dialogue:
		_advance_mock_dialogue(choice_index)
		return

	GameState.select_dialogue_choice(choice_index if choice_index >= 0 else 0)


func _start_mock_dialogue(entity: Variant) -> void:
	_mock_dialogue_node = 0
	_is_mock_dialogue = true
	var mock_data := _get_mock_dialogue_node(entity, 0)
	dialogue_data = mock_data
	dialogue_history = []
	pre_dialogue_page = current_page
	current_page = PageType.DIALOGUE
	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})
	_render_dialogue_to_page(_right_page, mock_data)


func _advance_mock_dialogue(choice_index: int) -> void:
	_mock_dialogue_node += 1
	if _mock_dialogue_node >= 2:
		_on_dialogue_ended()
		return
	var mock_data := _get_mock_dialogue_node(current_entity, _mock_dialogue_node)
	dialogue_data = mock_data
	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})
	_render_dialogue_to_page(_right_page, mock_data)


func _get_mock_dialogue_node(entity: Variant, node_index: int) -> Dictionary:
	var entity_name: String = _get_entity_prop(entity, "name", "Someone") if entity else "Someone"
	if node_index == 0:
		return {
			"entity_id": _get_entity_prop(entity, "key", "unknown") if entity else "unknown",
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
			"entity_id": _get_entity_prop(entity, "key", "unknown") if entity else "unknown",
			"node_id": "more_info",
			"speaker": entity_name,
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
