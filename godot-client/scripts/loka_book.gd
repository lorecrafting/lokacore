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
##   Slot 4 (anim face B):  parchment back (during page turn)
extends Node2D
class_name LokaBook

## Emitted when page turn animation starts
signal page_turn_started(direction: String)

## Emitted when page turn animation completes
signal page_turn_completed(direction: String)

## Emitted when menu button is tapped from in-page nav footer
signal menu_pressed

## Emitted when say button is tapped from in-page nav footer
signal say_pressed

## Emitted when a navigation direction is tapped from in-page nav footer
signal nav_direction_pressed(direction: String)

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

## Effects controller
var _effects: EffectsController

## Extracted components (same as BookPage)
var _menu_renderer: MenuTabRenderer
var _dialogue_controller: DialogueController
var _content_manager: PageContentManager
var _shop_container_handler: ShopContainerHandler
var _content_renderer: PageContentRenderer


## Turn animation state
var _is_turning: bool = false
var _pending_turn_direction: String = ""

## Staging viewport for page turn pre-rendering
var _staging_page: PageContentManager.PageContent

## Room page turn queue
var _pending_room: MockWorld.Room = null

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

	# Create page content viewport
	_right_page = _content_manager.create_page_content(_on_label_meta_clicked)

	# Add viewport as child (required for rendering)
	add_child(_right_page.viewport)

	# Create staging viewport for page turn pre-rendering
	_staging_page = _content_manager.create_page_content(_on_label_meta_clicked)
	_staging_page.viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_staging_page.viewport)

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
	_adjust_camera_for_single_page()
	_disable_pageflip_click_navigation()

	# Connect bottom bar signals
	_right_page.bar.bar_pressed.connect(_handle_nav_click)
	_staging_page.bar.bar_pressed.connect(_handle_nav_click)

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

	# Single page mode: only use right page (slot 2)
	# Hide left page entirely
	if _page_flip.static_left:
		_page_flip.static_left.visible = false

	if _page_flip._slot_2:
		_clear_slot(_page_flip._slot_2)
		var right_rect := TextureRect.new()
		right_rect.texture = _right_page.viewport.get_texture()
		right_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		right_rect.stretch_mode = TextureRect.STRETCH_SCALE
		right_rect.size = _page_flip._slot_2.size
		_page_flip._slot_2.add_child(right_rect)

	# Update static right visual
	if _page_flip.static_right:
		_page_flip.static_right.texture = _page_flip._slot_2.get_texture()
		_page_flip.static_right.visible = true


func _clear_slot(slot: SubViewport) -> void:
	for child in slot.get_children():
		child.queue_free()


## Disable PageFlip2D's built-in click-to-flip behavior.
func _disable_pageflip_click_navigation() -> void:
	if _page_flip and "disable_click_navigation" in _page_flip:
		_page_flip.disable_click_navigation = true


## Override camera to frame only the right page (single page view)
func _adjust_camera_for_single_page() -> void:
	if not _page_flip:
		return

	var cam: Camera2D = _page_flip.get_node_or_null("Camera2D")
	if not cam:
		return

	# Zoom to fit single page width instead of two-page spread
	var page_size := _page_flip.target_page_size
	var screen_size := get_viewport_rect().size
	if screen_size == Vector2.ZERO:
		return

	var margin := 1.05
	var zoom_x := screen_size.x / (page_size.x * margin)
	var zoom_y := screen_size.y / (page_size.y * margin)
	var final_zoom: float = min(zoom_x, zoom_y)
	cam.zoom = Vector2(final_zoom, final_zoom)

	# Center camera on the right page using global coordinates.
	var vc_pos := _page_flip.visuals_container.global_position
	cam.global_position = vc_pos + Vector2(page_size.x * 0.5, 0)

	# Hide spine and volume layers (single page doesn't need them)
	_hide_book_chrome()


## Hide spine, volume layers, and left page (single-page mode).
func _hide_book_chrome() -> void:
	if not _page_flip or not _page_flip.visuals_container:
		return
	for child in _page_flip.visuals_container.get_children():
		if child.name.begins_with("Vol") or child.name == "RuntimeSpine":
			child.visible = false
	if _page_flip.static_left:
		_page_flip.static_left.visible = false


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
			get_viewport().set_input_as_handled()

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
	# Convert click to the page content SubViewport coordinates.
	# Use static_right.to_local() to map directly to the Polygon2D's local space,
	# matching how PageFlip's own _inject_event_to_viewport works.
	if not _page_flip or not _page_flip.static_right:
		return

	var local_pos := _page_flip.static_right.to_local(get_global_mouse_position())
	# Polygon is centered vertically: y from -h/2 to +h/2, so shift to 0..h
	var vp_x := local_pos.x
	var vp_y := local_pos.y + PageContentManager.VIEWPORT_HEIGHT / 2.0

	if vp_x < 0 or vp_x > PageContentManager.VIEWPORT_WIDTH or vp_y < 0 or vp_y > PageContentManager.VIEWPORT_HEIGHT:
		return

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
# Page Turn Animation (manual drive — bypasses PageFlip's spread management)
# =============================================================================

func turn_page(direction: String = "right") -> void:
	if _is_turning:
		return

	if not _page_flip or not _page_flip.anim_player or not _page_flip.dynamic_poly:
		# Fallback: instant content swap (no animation available)
		_render_pending_content_to_page(_right_page, pending_page)
		current_page = pending_page
		page_turn_started.emit(direction)
		page_turn_completed.emit(direction)
		return

	_is_turning = true

	# Pre-render new content into staging viewport
	_staging_page.viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_render_pending_content_to_page(_staging_page, pending_page)

	# Wait 2 frames for viewport to render
	await get_tree().process_frame
	await get_tree().process_frame

	_drive_page_flip_animation()


func _on_page_flip_started() -> void:
	pass  # Animation started


func _on_page_flip_ended() -> void:
	_is_turning = false


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
			var ddata: Dictionary = dialogue_data if not dialogue_data.is_empty() else GameState.dialogue_data
			if not ddata.is_empty():
				_render_dialogue_to_page(page, ddata)
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
	page.bar.update_exits(available_exits)
	page.bar.update_minimap(room, GameState.visited_rooms)
	page.bar.set_bar_visible(true)


func _render_menu_to_page(page: PageContentManager.PageContent) -> void:
	page.label.text = _content_renderer.render_menu(current_menu_tab, _menu_renderer)
	page.bar.set_bar_visible(false)


func _render_entity_to_page(page: PageContentManager.PageContent, entity: Variant) -> void:
	if entity == null:
		page.label.text = ""
		return
	var result := _content_renderer.render_entity(entity)
	page.label.text = result.text
	current_entity_actions = result.actions
	page.bar.set_bar_visible(false)


func _render_shop_to_page(page: PageContentManager.PageContent) -> void:
	page.label.text = _shop_container_handler.render_shop()
	page.bar.set_bar_visible(false)


func _render_container_to_page(page: PageContentManager.PageContent) -> void:
	page.label.text = _shop_container_handler.render_container()
	page.bar.set_bar_visible(false)


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
	page.bar.set_bar_visible(false)


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
	if current_page == PageType.ROOM and _page_flip and _page_flip.anim_player:
		_do_room_page_turn(room)
	elif current_page == PageType.ROOM:
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
	# Update entity ref if needed before page switch
	if new_page == GameState.PageType.ENTITY and not GameState.current_entity.is_empty():
		current_entity = GameState.current_entity

	var page_type: PageType
	match new_page:
		GameState.PageType.ROOM: page_type = PageType.ROOM
		GameState.PageType.MENU: page_type = PageType.MENU
		GameState.PageType.ENTITY: page_type = PageType.ENTITY
		GameState.PageType.DIALOGUE: page_type = PageType.DIALOGUE
		GameState.PageType.SHOP: page_type = PageType.SHOP
		GameState.PageType.CONTAINER: page_type = PageType.CONTAINER
		_: page_type = PageType.ROOM

	switch_to_page(page_type, "right")


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
	switch_to_page(PageType.DIALOGUE, "right")


func _on_dialogue_ended() -> void:
	dialogue_data = {}
	dialogue_history = []
	switch_to_page(pre_dialogue_page, "right")


# =============================================================================
# Entity Interaction
# =============================================================================

func show_entity_details(entity: Variant) -> void:
	current_entity = entity
	switch_to_page(PageType.ENTITY, "right")


func go_back_to_room() -> void:
	current_entity = null
	switch_to_page(PageType.ROOM, "right")


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
# Navigation Click Handling
# =============================================================================

func _handle_nav_click(action: String) -> void:
	if _is_turning:
		return
	match action:
		"menu":
			menu_pressed.emit()
		"say":
			say_pressed.emit()
		"north", "south", "east", "west", "up", "down":
			nav_direction_pressed.emit(action)


# =============================================================================
# Menu Click Handling
# =============================================================================

func _handle_menu_click(tab_key: String) -> void:
	match tab_key:
		"back":
			go_back_to_room()
			return
		"inventory": current_menu_tab = MenuTab.INVENTORY
		"equipment": current_menu_tab = MenuTab.EQUIPMENT
		"character": current_menu_tab = MenuTab.CHARACTER
		"quests": current_menu_tab = MenuTab.QUESTS
		"map": current_menu_tab = MenuTab.MAP
		"social": current_menu_tab = MenuTab.SOCIAL
		"settings": current_menu_tab = MenuTab.SETTINGS
		"quit":
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
	var speaker: String = mock_data.get("speaker", "Someone")
	var text: String = mock_data.get("text", "")
	dialogue_history.append({"speaker": speaker, "text": text, "is_player": false})
	switch_to_page(PageType.DIALOGUE, "right")


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
# Page Turn Animation (shared by all page transitions)
# =============================================================================

func _do_room_page_turn(room: MockWorld.Room) -> void:
	if _is_turning:
		_pending_room = room
		return

	# Use the generic animation path
	pending_page = PageType.ROOM
	_is_turning = true

	# Pre-render new room into staging viewport
	_staging_page.viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_render_room_to_page(_staging_page, room)

	# Wait 2 frames for viewport to render
	await get_tree().process_frame
	await get_tree().process_frame

	_drive_page_flip_animation()


func _drive_page_flip_animation() -> void:
	if not _page_flip or not _page_flip.anim_player or not _page_flip.dynamic_poly:
		_finish_page_turn()
		return

	var anim_player: AnimationPlayer = _page_flip.anim_player
	var dynamic_poly: Polygon2D = _page_flip.dynamic_poly
	var anim_name := "turn_flexible_page"

	if not anim_player.has_animation(anim_name):
		_finish_page_turn()
		return

	# --- 1. Set up slot content ---
	_page_flip._set_flying_slots_active(true)

	var content_tex = _right_page.viewport.get_texture()
	var parchment_tex := _get_parchment_texture()

	# Slot 3 (Face A / front of turning page) = current content
	if _page_flip._slot_3:
		_clear_slot(_page_flip._slot_3)
		var front_rect := TextureRect.new()
		front_rect.texture = content_tex
		front_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		front_rect.stretch_mode = TextureRect.STRETCH_SCALE
		front_rect.size = _page_flip._slot_3.size
		_page_flip._slot_3.add_child(front_rect)

	# Slot 4 (Face B / back of turning page) = blank parchment
	if _page_flip._slot_4:
		_clear_slot(_page_flip._slot_4)
		var back_rect := TextureRect.new()
		back_rect.texture = parchment_tex
		back_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		back_rect.stretch_mode = TextureRect.STRETCH_SCALE
		back_rect.size = _page_flip._slot_4.size
		_page_flip._slot_4.add_child(back_rect)

	# --- 2. Set up static + dynamic textures ---
	# static_right shows the NEW content underneath the turning page
	_page_flip.static_right.texture = _staging_page.viewport.get_texture()
	_page_flip.static_right.visible = true

	var tex_front = _page_flip._slot_3.get_texture()
	var tex_back = _page_flip._slot_4.get_texture()

	# PageFlip sets dynamic_poly.texture to tex_back (used for UV normalization)
	dynamic_poly.texture = tex_back

	if dynamic_poly.material is ShaderMaterial:
		# The shader's UV face detection classifies our visible face as "back"
		# during the first half, applying 1.0-UV.x mirroring. Swap params so
		# content goes through back_texture (shader mirrors it, correcting display).
		dynamic_poly.material.set_shader_parameter("front_texture", tex_back)
		dynamic_poly.material.set_shader_parameter("back_texture", tex_front)
		dynamic_poly.material.set_shader_parameter("shadow_intensity", 0.0)
		dynamic_poly.material.set_shader_parameter("max_shadow_spread", 0.0)

	# --- 3. Disconnect PageFlip's own handlers to prevent state corruption ---
	if anim_player.is_connected("animation_finished", _page_flip._on_animation_finished):
		anim_player.disconnect("animation_finished", _page_flip._on_animation_finished)

	# --- 4. Configure animation ---
	dynamic_poly.visible = true
	dynamic_poly.z_index = 10

	# Play page flip sound
	if _page_flip.sfx_page_flip and _page_flip.audio_player:
		_page_flip.audio_player.stream = _page_flip.sfx_page_flip
		_page_flip.audio_player.pitch_scale = randf_range(0.95, 1.05)
		_page_flip.audio_player.play()

	_hide_book_chrome()
	page_turn_started.emit("right")

	anim_player.current_animation = anim_name
	anim_player.seek(0.0, true)

	# Wait for slot viewports to render with correct content + bone positions
	await RenderingServer.frame_post_draw

	# Use a Timer to stop at the halfway point
	var anim_len: float = anim_player.get_animation(anim_name).length
	var half_duration: float = anim_len * 0.5
	get_tree().create_timer(half_duration).timeout.connect(
		_on_half_animation_midpoint
	)

	# Shadow tween for the first half only
	if dynamic_poly.material is ShaderMaterial:
		var shadow_tween := create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		shadow_tween.tween_property(dynamic_poly.material, "shader_parameter/shadow_intensity", 0.5, half_duration * 0.7)
		shadow_tween.parallel().tween_property(dynamic_poly.material, "shader_parameter/max_shadow_spread", 0.3, half_duration * 0.7)

	# Start the animation
	anim_player.play(anim_name)


## Called at animation midpoint: page is vertical, stop and snap to new content.
func _on_half_animation_midpoint() -> void:
	if not _page_flip:
		_finish_page_turn()
		return

	var anim_player: AnimationPlayer = _page_flip.anim_player
	var dynamic_poly: Polygon2D = _page_flip.dynamic_poly

	# Hide the dynamic poly BEFORE stopping to avoid bone-reset visual flash
	dynamic_poly.visible = false
	anim_player.stop()

	# Reset shader params
	if dynamic_poly.material is ShaderMaterial:
		dynamic_poly.material.set_shader_parameter("shadow_intensity", 0.0)
		dynamic_poly.material.set_shader_parameter("max_shadow_spread", 0.0)

	# Disable flying slots
	_page_flip._set_flying_slots_active(false)

	# Reconnect PageFlip's animation handler for future use
	if not anim_player.is_connected("animation_finished", _page_flip._on_animation_finished):
		anim_player.animation_finished.connect(_page_flip._on_animation_finished)

	_finish_page_turn()


func _finish_page_turn() -> void:
	# Swap page references: staging already has the new content fully rendered.
	var old_right := _right_page
	_right_page = _staging_page
	_staging_page = old_right
	_staging_page.viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED

	# Update current page type to match what was rendered
	current_page = pending_page

	if _page_flip:
		# Point static_right at the new right page viewport
		_page_flip.static_right.texture = _right_page.viewport.get_texture()
		_page_flip.static_right.visible = true
		_hide_book_chrome()

	_is_turning = false
	page_turn_completed.emit("right")

	# If another room was queued during animation, start next turn
	if _pending_room != null:
		var next_room := _pending_room
		_pending_room = null
		_do_room_page_turn(next_room)


# =============================================================================
# Utility Functions
# =============================================================================

## Cached parchment texture matching our viewport background color
var _parchment_tex: ImageTexture = null

func _get_parchment_texture() -> ImageTexture:
	if _parchment_tex:
		return _parchment_tex
	var img := Image.create(PageContentManager.VIEWPORT_WIDTH, PageContentManager.VIEWPORT_HEIGHT, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.878, 0.816, 0.706))  # Matches page_content_manager.gd parchment bg
	_parchment_tex = ImageTexture.create_from_image(img)
	return _parchment_tex


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
