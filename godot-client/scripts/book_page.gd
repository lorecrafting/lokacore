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
enum PageType { ROOM, MENU, ENTITY, DIALOGUE }

## Menu tabs
enum MenuTab { INVENTORY, CHARACTER, SETTINGS }

## Text effects (matching shader uniforms)
enum TextEffect { NONE = 0, BURN = 1, ICE = 2, GLOW = 3, FADE = 4 }

## Page mesh dimensions (iPhone Pro aspect ratio ~9:19.5)
const PAGE_WIDTH := 1.8
const PAGE_HEIGHT := 3.9

## SubViewport resolution for text rendering (iPhone 17 Pro scale)
const VIEWPORT_WIDTH := 430
const VIEWPORT_HEIGHT := 932

## Bottom bar dimensions (inside viewport)
const BOTTOM_BAR_HEIGHT := 120
const BUTTON_SIZE := 70

## Animation settings
const TURN_DURATION := 0.6
const CURL_STRENGTH := 0.8  # More dramatic curl
const EFFECT_DURATION := 2.0  # Duration for text effects

## Event feed settings
const MAX_EVENTS := 5
const EVENT_FADE_TIME := 10.0  # Seconds before events start fading

## Universal page padding
const PAGE_PADDING_LEFT := 20
const PAGE_PADDING_RIGHT := 20
const PAGE_PADDING_TOP := 24
const PAGE_PADDING_BOTTOM := 10

# =============================================================================
# PageMesh Inner Class - Encapsulates a single page with its viewports
# =============================================================================

class PageMesh extends RefCounted:
	var mesh_instance: MeshInstance3D
	var page_viewport: SubViewport      # Background (parchment) layer
	var text_viewport: SubViewport      # Text-only layer (transparent bg)
	var page_bg_container: Control      # Background visuals
	var text_container: Control         # Text content
	var label: RichTextLabel            # Main text label
	var bottom_bar: Control             # Bottom bar
	var shader_material: ShaderMaterial
	var curl_progress: float = 0.0

	func set_curl(value: float) -> void:
		curl_progress = clampf(value, 0.0, 1.0)
		if shader_material and shader_material.shader:
			# Full curl amount for maximum effect
			shader_material.set_shader_parameter("curl_amount", curl_progress)
			# Larger radius = wider, more visible curl arc
			var dynamic_radius := lerpf(0.8, 0.5, curl_progress)
			shader_material.set_shader_parameter("curl_radius", dynamic_radius)
			# Curl angle in radians (PI = 180 degrees)
			var dynamic_angle := lerpf(2.5, 3.5, curl_progress)
			shader_material.set_shader_parameter("curl_angle", dynamic_angle)

# =============================================================================
# Main BookPage Variables
# =============================================================================

## Dual page system - top curls to reveal bottom
var top_page: PageMesh
var bottom_page: PageMesh

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

## Mock dialogue state
var _mock_dialogue_node: int = 0
var _is_mock_dialogue: bool = false


func _ready() -> void:
	# Create dual page system - pages stacked like real book
	# Larger z-offset so pages don't intersect during curl
	top_page = _create_page_mesh(0.05)     # Top page in front
	bottom_page = _create_page_mesh(0.0)   # Bottom page at base

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
	await _apply_page_textures(top_page)
	await _apply_page_textures(bottom_page)
	top_page.mesh_instance.visible = true
	bottom_page.mesh_instance.visible = true

	# Display initial room if available
	if GameState.current_room:
		_render_room_to_page(top_page, GameState.current_room)


# =============================================================================
# Page Mesh Factory
# =============================================================================

## Create a complete page mesh with viewports
func _create_page_mesh(z_offset: float) -> PageMesh:
	var page := PageMesh.new()

	# === PAGE VIEWPORT (Background Layer) ===
	page.page_viewport = SubViewport.new()
	page.page_viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	page.page_viewport.transparent_bg = false
	page.page_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

	# Background with aged parchment effect
	page.page_bg_container = Control.new()
	page.page_bg_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.page_viewport.add_child(page.page_bg_container)

	# Base parchment color - warm aged tan
	var bg := ColorRect.new()
	bg.color = Color(0.878, 0.816, 0.706)  # Aged parchment tan #E0D0B4
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.page_bg_container.add_child(bg)

	# Subtle vignette for slightly darker edges
	var vignette := ColorRect.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	var vignette_shader := Shader.new()
	vignette_shader.code = """
shader_type canvas_item;
void fragment() {
	vec2 uv = UV - 0.5;
	float dist = length(uv * vec2(1.2, 1.0));
	float vignette = smoothstep(0.4, 0.85, dist);
	COLOR = vec4(0.35, 0.28, 0.2, vignette * 0.15);
}
"""
	var vignette_mat := ShaderMaterial.new()
	vignette_mat.shader = vignette_shader
	vignette.material = vignette_mat
	page.page_bg_container.add_child(vignette)

	# Setup bottom bar inside page viewport
	page.bottom_bar = _create_bottom_bar()
	page.page_viewport.add_child(page.bottom_bar)

	# === TEXT VIEWPORT (Text Layer - Transparent Background) ===
	page.text_viewport = SubViewport.new()
	page.text_viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	page.text_viewport.transparent_bg = true
	page.text_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

	# Text content container
	page.text_container = Control.new()
	page.text_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.text_container.offset_bottom = -BOTTOM_BAR_HEIGHT
	page.text_viewport.add_child(page.text_container)

	# Create RichTextLabel for formatted text
	page.label = RichTextLabel.new()
	page.label.bbcode_enabled = true
	page.label.fit_content = false
	page.label.scroll_active = true
	page.label.scroll_following = true
	page.label.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.label.offset_left = PAGE_PADDING_LEFT
	page.label.offset_right = -PAGE_PADDING_RIGHT
	page.label.offset_top = PAGE_PADDING_TOP
	page.label.offset_bottom = -PAGE_PADDING_BOTTOM
	page.label.add_theme_font_size_override("normal_font_size", 20)
	page.label.add_theme_font_size_override("bold_font_size", 22)
	page.label.add_theme_font_size_override("italics_font_size", 19)
	page.label.add_theme_color_override("default_color", Color(0.09, 0.06, 0.03))
	page.label.meta_clicked.connect(_on_label_meta_clicked)
	page.text_container.add_child(page.label)

	# Hide scrollbar but keep scroll functionality (touch/mousewheel)
	var scrollbar := page.label.get_v_scroll_bar()
	scrollbar.modulate = Color(1, 1, 1, 0)  # Invisible but functional

	# === MESH ===
	page.mesh_instance = MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(PAGE_WIDTH, PAGE_HEIGHT)
	# Subdivisions are critical for page curl - more = smoother curl
	# Width subdivisions control horizontal curl detail
	# Depth subdivisions control vertical curl detail
	plane.subdivide_width = 32   # Horizontal segments for curl
	plane.subdivide_depth = 48   # Vertical segments for page height
	page.mesh_instance.mesh = plane
	page.mesh_instance.rotation_degrees = Vector3(-90, 0, 0)
	page.mesh_instance.position.z = z_offset

	# Create shader material
	page.shader_material = ShaderMaterial.new()
	var shader := load("res://shaders/page_curl.gdshader")
	if shader:
		page.shader_material.shader = shader
		page.shader_material.set_shader_parameter("curl_amount", 0.0)
		page.shader_material.set_shader_parameter("curl_direction", 1.0)
		page.shader_material.set_shader_parameter("curl_radius", 0.35)
		page.shader_material.set_shader_parameter("curl_angle", 2.5)
		page.shader_material.set_shader_parameter("shadow_intensity", 0.3)
		page.shader_material.set_shader_parameter("ambient_occlusion", 0.2)

	# Hide mesh until textures are ready
	page.mesh_instance.visible = false

	return page


## Apply viewport textures to a page's shader
func _apply_page_textures(page: PageMesh) -> void:
	await get_tree().process_frame

	if page.shader_material.shader:
		var page_tex := page.page_viewport.get_texture()
		var text_tex := page.text_viewport.get_texture()
		page.shader_material.set_shader_parameter("page_texture", page_tex)
		page.shader_material.set_shader_parameter("text_texture", text_tex)
		page.mesh_instance.set_surface_override_material(0, page.shader_material)


## Create the bottom bar Control
func _create_bottom_bar() -> Control:
	var bar := Control.new()
	bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bar.offset_top = -BOTTOM_BAR_HEIGHT

	# Background - slightly darker aged parchment
	var bar_bg := ColorRect.new()
	bar_bg.color = Color(0.82, 0.75, 0.64)
	bar_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bar.add_child(bar_bg)

	# Decorative separator line at top
	var separator := ColorRect.new()
	separator.color = Color(0.45, 0.38, 0.30)
	separator.set_anchors_preset(Control.PRESET_TOP_WIDE)
	separator.custom_minimum_size = Vector2(0, 1)
	bar.add_child(separator)

	# HBox for buttons
	var hbox := HBoxContainer.new()
	hbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	hbox.offset_left = 20
	hbox.offset_right = -20
	hbox.offset_top = 10
	hbox.offset_bottom = -10
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_child(hbox)

	# Menu button (left)
	var menu_btn := _create_bar_button("☰", "menu")
	hbox.add_child(menu_btn)

	# Spacer
	var spacer1 := Control.new()
	spacer1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer1)

	# Compass (center)
	var compass := _create_compass()
	hbox.add_child(compass)

	# Spacer
	var spacer2 := Control.new()
	spacer2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer2)

	# Say button (right)
	var say_btn := _create_bar_button("💬", "say")
	hbox.add_child(say_btn)

	return bar


func _create_bar_button(icon: String, action: String) -> Button:
	var btn := Button.new()
	btn.text = icon
	btn.custom_minimum_size = Vector2(BUTTON_SIZE, BUTTON_SIZE)
	btn.add_theme_font_size_override("font_size", 24)
	btn.pressed.connect(func(): bottom_bar_pressed.emit(action))
	return btn


func _create_compass() -> VBoxContainer:
	var compass := VBoxContainer.new()
	compass.alignment = BoxContainer.ALIGNMENT_CENTER

	# North
	var north_btn := Button.new()
	north_btn.text = "↑"
	north_btn.name = "NorthBtn"
	north_btn.custom_minimum_size = Vector2(40, 28)
	north_btn.add_theme_font_size_override("font_size", 18)
	north_btn.pressed.connect(func(): bottom_bar_pressed.emit("north"))
	compass.add_child(north_btn)

	# Middle row (West · East)
	var mid_row := HBoxContainer.new()
	mid_row.alignment = BoxContainer.ALIGNMENT_CENTER

	var west_btn := Button.new()
	west_btn.text = "←"
	west_btn.name = "WestBtn"
	west_btn.custom_minimum_size = Vector2(40, 28)
	west_btn.add_theme_font_size_override("font_size", 18)
	west_btn.pressed.connect(func(): bottom_bar_pressed.emit("west"))
	mid_row.add_child(west_btn)

	var dot := Label.new()
	dot.text = "·"
	dot.custom_minimum_size = Vector2(24, 0)
	dot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid_row.add_child(dot)

	var east_btn := Button.new()
	east_btn.text = "→"
	east_btn.name = "EastBtn"
	east_btn.custom_minimum_size = Vector2(40, 28)
	east_btn.add_theme_font_size_override("font_size", 18)
	east_btn.pressed.connect(func(): bottom_bar_pressed.emit("east"))
	mid_row.add_child(east_btn)

	compass.add_child(mid_row)

	# South
	var south_btn := Button.new()
	south_btn.text = "↓"
	south_btn.name = "SouthBtn"
	south_btn.custom_minimum_size = Vector2(40, 28)
	south_btn.add_theme_font_size_override("font_size", 18)
	south_btn.pressed.connect(func(): bottom_bar_pressed.emit("south"))
	compass.add_child(south_btn)

	return compass


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
	var uv_x := (hit_point.x / PAGE_WIDTH) + 0.5
	var uv_y := (hit_point.y / PAGE_HEIGHT) + 0.5

	if uv_x < 0 or uv_x > 1 or uv_y < 0 or uv_y > 1:
		return

	# Convert UV to viewport pixel coordinates
	var vp_x := uv_x * VIEWPORT_WIDTH
	var vp_y := (1.0 - uv_y) * VIEWPORT_HEIGHT

	# Check page type and route click
	var bar_top := VIEWPORT_HEIGHT - BOTTOM_BAR_HEIGHT
	if current_page == PageType.DIALOGUE:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif current_page == PageType.ENTITY:
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif vp_y >= bar_top:
		_handle_bottom_bar_click(vp_x, vp_y - bar_top)
	elif current_page == PageType.ROOM:
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
	var third := VIEWPORT_WIDTH / 3.0

	if local_x < third:
		bottom_bar_pressed.emit("menu")
	elif local_x > (VIEWPORT_WIDTH - third):
		bottom_bar_pressed.emit("say")
	else:
		var compass_center_x := VIEWPORT_WIDTH / 2.0
		var compass_center_y := BOTTOM_BAR_HEIGHT / 2.0

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
func _render_pending_content_to_page(page: PageMesh, page_type: PageType) -> void:
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


## Render room content to a page
func _render_room_to_page(page: PageMesh, room: MockWorld.Room) -> void:
	if room == null:
		page.label.text = ""
		return

	# Track exits for compass
	available_exits = room.exits.keys() if room.exits else []
	_update_compass_buttons_on_page(page)

	var text := ""

	var title_color := "#100a04"
	var body_color := "#181008"
	var secondary_color := "#201408"
	var event_color := "#302010"

	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, room.name]
	text += "[color=%s]%s[/color]\n" % [body_color, room.description]

	if room.npcs.size() > 0:
		var npc_texts: Array[String] = []
		for npc in room.npcs:
			var npc_text := npc.long_desc if npc.get("long_desc") and npc.long_desc != "" else "%s is here." % npc.name
			npc_text = npc_text.replace("\n", " ").replace("  ", " ")
			var keyword: String = npc.get("primary_keyword") if npc.get("primary_keyword") else ""
			var npc_key: String = npc.get("key") if npc.get("key") else ""
			if keyword != "" and keyword in npc_text and npc_key != "":
				npc_text = npc_text.replace(keyword, "[url=npc:%s][u]%s[/u][/url]" % [npc_key, keyword])
			npc_texts.append(npc_text)
		text += "[color=%s]%s[/color]\n" % [secondary_color, " ".join(npc_texts)]

	if room.items.size() > 0:
		var item_texts: Array[String] = []
		for item in room.items:
			var item_text := item.long_desc if item.get("long_desc") and item.long_desc != "" else "%s lies here." % item.name
			item_text = item_text.replace("\n", " ").replace("  ", " ")
			var keyword: String = item.get("primary_keyword") if item.get("primary_keyword") else ""
			var item_key: String = item.get("key") if item.get("key") else ""
			if keyword != "" and keyword in item_text and item_key != "":
				item_text = item_text.replace(keyword, "[url=item:%s][u]%s[/u][/url]" % [item_key, keyword])
			item_texts.append(item_text)
		text += "[color=%s]%s[/color]\n" % [secondary_color, " ".join(item_texts)]

	if events.size() > 0:
		text += "\n"
		for event in events:
			text += "[color=%s][i]%s[/i][/color]\n" % [event_color, event["text"]]

	page.label.text = text


## Render menu content to a page
func _render_menu_to_page(page: PageMesh) -> void:
	var text := ""

	var title_color := "#2a1f14"
	var tab_color := "#4a3828"
	var separator_color := "#8a7a6a"
	var hint_color := "#6a5a4a"

	text += "[center][font_size=28][color=%s][b]Menu[/b][/color][/font_size][/center]\n\n" % title_color

	text += "[color=%s]" % tab_color
	match current_menu_tab:
		MenuTab.INVENTORY:
			text += "[b]▸ Inventory[/b]    Character    Settings\n"
		MenuTab.CHARACTER:
			text += "  Inventory    [b]▸ Character[/b]    Settings\n"
		MenuTab.SETTINGS:
			text += "  Inventory    Character    [b]▸ Settings[/b]\n"
	text += "[/color]\n"
	text += "[color=%s]───────────────────[/color]\n\n" % separator_color

	match current_menu_tab:
		MenuTab.INVENTORY:
			text += _get_inventory_content()
		MenuTab.CHARACTER:
			text += _get_character_content()
		MenuTab.SETTINGS:
			text += _get_settings_content()

	text += "\n\n[center][color=%s][i]Press Menu or swipe to return[/i][/color][/center]" % hint_color

	page.label.text = text


## Render entity details to a page
func _render_entity_to_page(page: PageMesh, entity: Variant) -> void:
	if entity == null:
		page.label.text = ""
		return

	var text := ""

	var title_color := "#2a1f14"
	var body_color := "#362816"
	var action_color := "#4a3828"

	var entity_name: String = _get_entity_prop(entity, "name", "Unknown")
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, entity_name]

	var desc: String = _get_entity_prop(entity, "description", "")
	if desc == "":
		desc = _get_entity_prop(entity, "long_desc", "")
	if desc == "":
		desc = entity_name
	desc = desc.replace("\n", " ").replace("  ", " ")
	text += "[color=%s]%s[/color]\n\n" % [body_color, desc]

	var actions: Array = _get_entity_prop(entity, "actions", [])
	current_entity_actions = []

	text += "\n"
	for action in actions:
		var action_key: String = action.get("key", "") if action is Dictionary else str(action)
		var action_label: String = action.get("label", action_key.capitalize()) if action is Dictionary else action_key.capitalize()
		current_entity_actions.append(action_key)
		text += "[color=%s][url=action:%s][u]%s[/u][/url][/color]\n\n" % [action_color, action_key, action_label]

	if "leave" not in current_entity_actions:
		current_entity_actions.append("leave")
		text += "[color=%s][url=action:leave][u]Leave[/u][/url][/color]\n" % action_color

	page.label.text = text


## Render dialogue content to a page
func _render_dialogue_to_page(page: PageMesh, data: Dictionary) -> void:
	if data.is_empty():
		page.label.text = ""
		return

	var title_color := "#2a1f14"
	var body_color := "#362816"
	var player_color := "#1a3a2a"
	var choice_color := "#4a3828"
	var hint_color := "#6a5a4a"

	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	speaker = speaker.capitalize()
	var dialogue_text: String = data.get("text", "")
	dialogue_text = dialogue_text.replace("\n", " ").replace("  ", " ")

	# Add current NPC line to history if not already there
	var should_add := true
	if not dialogue_history.is_empty():
		var last_entry: Dictionary = dialogue_history[-1]
		if last_entry.get("speaker") == speaker and last_entry.get("text") == dialogue_text and not last_entry.get("is_player", false):
			should_add = false

	if should_add:
		dialogue_history.append({"speaker": speaker, "text": dialogue_text, "is_player": false})

	var text := ""

	text += "[center][font_size=26][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, speaker]

	var event_color := "#5a4a3a"

	for entry in dialogue_history:
		var entry_speaker: String = entry.get("speaker", "").capitalize()
		var entry_text: String = entry.get("text", "")
		var is_player: bool = entry.get("is_player", false)
		var entry_event: String = entry.get("event", "")

		if is_player:
			# Show event (like [Accept Quest]) before the player's line
			if entry_event != "":
				text += "[color=%s][%s][/color]\n" % [event_color, entry_event]
			text += "[color=%s]You say, [i]\"%s\"[/i][/color]\n\n" % [player_color, entry_text]
		else:
			text += "[color=%s]%s says, \"%s\"[/color]\n\n" % [body_color, entry_speaker, entry_text]

	var choices: Array = data.get("choices", [])
	if choices.size() > 0:
		for i in range(choices.size()):
			var choice: Dictionary = choices[i]
			var choice_text: String = choice.get("text", "Continue")
			text += "[color=%s][url=%d][u]%s[/u][/url][/color]\n\n" % [choice_color, i, choice_text]
	else:
		text += "[color=%s][url=-1][u]Continue[/u][/url][/color]\n\n" % choice_color

	page.label.text = text


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

func _update_compass_buttons_on_page(page: PageMesh) -> void:
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
	GameState.room_changed.connect(_on_room_changed)
	GameState.navigation_failed.connect(_on_navigation_failed)
	GameState.entity_context_received.connect(_on_entity_context_received)

	if has_node("/root/PhoenixClient"):
		var phoenix := get_node("/root/PhoenixClient")
		phoenix.dialogue_started.connect(_on_dialogue_started)
		phoenix.dialogue_updated.connect(_on_dialogue_updated)
		phoenix.dialogue_ended.connect(_on_dialogue_ended)


func _on_room_changed(room: MockWorld.Room) -> void:
	events.clear()
	if current_page == PageType.ROOM:
		display_room(room)


func _on_navigation_failed(direction: String, reason: String) -> void:
	add_event(reason)


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
		var key: String = npc.get("key") if npc.get("key") else ""
		if key == npc_key:
			_click_entity(npc)
			return


func _select_item_by_key(item_key: String) -> void:
	var room := GameState.current_room
	if room == null:
		return

	for item in room.items:
		var key: String = item.get("key") if item.get("key") else ""
		if key == item_key:
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
# Events
# =============================================================================

func add_event(text: String) -> void:
	var clean_text := _strip_html_tags(text)
	var event := {
		"text": clean_text,
		"timestamp": Time.get_ticks_msec() / 1000.0
	}
	events.append(event)

	while events.size() > MAX_EVENTS:
		events.pop_front()

	if current_page == PageType.ROOM and GameState.current_room:
		display_room(GameState.current_room)
		await get_tree().process_frame
		top_page.label.scroll_to_line(top_page.label.get_line_count())


func clear_events() -> void:
	events.clear()
	if GameState.current_room:
		display_room(GameState.current_room)


# =============================================================================
# Menu Navigation
# =============================================================================

func next_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY:
			current_menu_tab = MenuTab.CHARACTER
		MenuTab.CHARACTER:
			current_menu_tab = MenuTab.SETTINGS
		MenuTab.SETTINGS:
			current_menu_tab = MenuTab.INVENTORY
	display_menu()


func prev_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY:
			current_menu_tab = MenuTab.SETTINGS
		MenuTab.CHARACTER:
			current_menu_tab = MenuTab.INVENTORY
		MenuTab.SETTINGS:
			current_menu_tab = MenuTab.CHARACTER
	display_menu()


func _get_inventory_content() -> String:
	var title_color := "#2a1f14"
	var item_color := "#362816"
	var hint_color := "#6a5a4a"

	var text := "[color=%s][b]Your Pack[/b][/color]\n\n" % title_color

	var items: Array = []
	if GameState.is_online and GameState.server_state.has("player"):
		items = GameState.server_state["player"].get("inventory", [])
	else:
		items = MockWorld.get_player_inventory()

	if items.is_empty():
		text += "[color=%s][i]Your pack is empty.[/i][/color]\n" % hint_color
	else:
		for item in items:
			var iname: String = item.get("name", "Unknown")
			var qty: int = item.get("quantity", 1)
			if qty > 1:
				text += "[color=%s]• %s (×%d)[/color]\n" % [item_color, iname, qty]
			else:
				text += "[color=%s]• %s[/color]\n" % [item_color, iname]

	return text


func _get_character_content() -> String:
	var title_color := "#2a1f14"
	var label_color := "#5a4a3a"
	var value_color := "#362816"

	var text := "[color=%s][b]Character[/b][/color]\n\n" % title_color

	var player_name: String = "Unknown"
	var level: int = 1
	var hp: int = 100
	var max_hp: int = 100

	if GameState.is_online and GameState.server_state.has("player"):
		var p: Dictionary = GameState.server_state["player"]
		player_name = p.get("name", "Unknown")
		level = p.get("level", 1)
		hp = p.get("hp", 100)
		max_hp = p.get("max_hp", 100)
	else:
		player_name = str(AuthClient.player.get("name", MockWorld.get_player_name()))
		var stats: Dictionary = MockWorld.get_player_stats()
		level = stats.get("level", 1)
		hp = stats.get("hp", 100)
		max_hp = stats.get("max_hp", 100)

	text += "[color=%s]Name:[/color] [color=%s]%s[/color]\n\n" % [label_color, value_color, player_name]
	text += "[color=%s]Level:[/color] [color=%s]%d[/color]\n\n" % [label_color, value_color, level]
	text += "[color=%s]Health:[/color] [color=%s]%d / %d[/color]\n" % [label_color, value_color, hp, max_hp]

	return text


func _get_settings_content() -> String:
	var title_color := "#2a1f14"
	var item_color := "#4a3828"
	var hint_color := "#6a5a4a"
	var quit_color := "#6b3a2a"

	var text := "[color=%s][b]Settings[/b][/color]\n\n" % title_color
	text += "[color=%s][i]Settings coming soon...[/i][/color]\n\n" % hint_color
	text += "[color=%s]• Sound: On[/color]\n" % item_color
	text += "[color=%s]• Music: On[/color]\n" % item_color
	text += "\n\n[center][color=%s][b][ Quit Game ][/b][/color][/center]" % quit_color
	return text


# =============================================================================
# Dialogue System
# =============================================================================

func _on_dialogue_started(data: Dictionary) -> void:
	print("[Dialogue] Started: ", data)
	_is_mock_dialogue = false
	dialogue_history = []
	dialogue_data = data
	pre_dialogue_page = current_page
	current_page = PageType.DIALOGUE
	top_page.bottom_bar.visible = false
	_render_dialogue_to_page(top_page, data)


func _on_dialogue_updated(data: Dictionary) -> void:
	print("[Dialogue] Updated: ", data)
	dialogue_data = data
	if current_page == PageType.DIALOGUE:
		display_dialogue(dialogue_data)


func _on_dialogue_ended() -> void:
	print("[Dialogue] Ended")
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


func _select_dialogue_choice(choice_index: int) -> void:
	if choice_index >= 0:
		var choices: Array = dialogue_data.get("choices", [])
		if choice_index < choices.size():
			var choice: Dictionary = choices[choice_index]
			var choice_text: String = choice.get("text", "Continue")
			var choice_event: String = choice.get("event", "")  # e.g., "Accept Quest"
			dialogue_history.append({"speaker": "You", "text": choice_text, "is_player": true, "event": choice_event})

	if _is_mock_dialogue:
		_advance_mock_dialogue(choice_index)
		return

	if has_node("/root/PhoenixClient"):
		var phoenix := get_node("/root/PhoenixClient")
		if choice_index >= 0:
			phoenix.dialogue_select(choice_index)
		else:
			phoenix.dialogue_select(0)
	else:
		_advance_mock_dialogue(choice_index)


func _start_mock_dialogue(entity: Variant) -> void:
	_mock_dialogue_node = 0
	var mock_data := _get_mock_dialogue_node(entity, 0)
	_on_dialogue_started(mock_data)
	_is_mock_dialogue = true


func _advance_mock_dialogue(choice_index: int) -> void:
	_mock_dialogue_node += 1

	if _mock_dialogue_node >= 2:
		_on_dialogue_ended()
		return

	var mock_data := _get_mock_dialogue_node(current_entity, _mock_dialogue_node)
	_on_dialogue_updated(mock_data)


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
