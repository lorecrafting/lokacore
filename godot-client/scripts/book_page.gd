## 3D book page with text rendering via SubViewport.
## Handles page curl animation, room content display, menu, and bottom bar.
## Uses dual-layer rendering (parchment background + text overlay).
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

## Page curl progress (0 = flat, 1 = fully curled)
var curl_progress: float = 0.0:
	set(value):
		curl_progress = clampf(value, 0.0, 1.0)
		_update_curl_shader()

## Text effect progress (0 = none, 1 = full effect)
var effect_progress: float = 0.0:
	set(value):
		effect_progress = clampf(value, 0.0, 1.0)
		_update_effect_shader()

## Current text effect
var current_effect: TextEffect = TextEffect.NONE

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

## Child nodes - Dual viewport system
var mesh_instance: MeshInstance3D
var page_viewport: SubViewport      # Background (parchment) layer
var text_viewport: SubViewport      # Text-only layer (transparent bg)
var page_bg_container: Control      # Background visuals
var text_container: Control         # Text content
var label: RichTextLabel            # Main text label (in text_viewport)
var bottom_bar: Control             # Bottom bar (in page_viewport)
var shader_material: ShaderMaterial

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


func _ready() -> void:
	_setup_viewports()
	_setup_mesh()
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

	# Display initial room if available
	if GameState.current_room:
		display_room(GameState.current_room)


## Register JavaScript callbacks for web debug toolbar
func _setup_javascript_callbacks() -> void:
	if not OS.has_feature("web"):
		return

	# Create callbacks and store in member variables to prevent garbage collection
	_js_effect_callback = JavaScriptBridge.create_callback(_on_js_trigger_effect)
	_js_curl_callback = JavaScriptBridge.create_callback(_on_js_trigger_curl)
	_js_flip_callback = JavaScriptBridge.create_callback(_on_js_trigger_flip)

	# Register them on the window object
	var window := JavaScriptBridge.get_interface("window")
	window.godotTriggerEffect = _js_effect_callback
	window.godotTriggerCurl = _js_curl_callback
	window.godotTriggerFlip = _js_flip_callback

	print("[BookPage] JavaScript callbacks registered for web debug toolbar")


## JavaScript callback: trigger effect
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


## JavaScript callback: trigger curl
func _on_js_trigger_curl(_args: Array) -> void:
	print("[JS] Trigger curl")
	_test_curl_animation()


## JavaScript callback: trigger flip
func _on_js_trigger_flip(args: Array) -> void:
	if args.size() < 1:
		return
	var direction: String = str(args[0])
	print("[JS] Trigger flip: ", direction)
	turn_page(direction)


## Handle input for SubViewport interaction and keyboard shortcuts
func _input(event: InputEvent) -> void:
	if not visible:
		return

	# Handle mouse/touch clicks on the 3D page
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_page_click(event.position)
	elif event is InputEventScreenTouch and event.pressed:
		_handle_page_click(event.position)

	# Keyboard shortcuts for testing effects
	if event is InputEventKey and event.pressed:
		_handle_keyboard_shortcut(event)


## Handle keyboard shortcuts for testing effects
func _handle_keyboard_shortcut(event: InputEventKey) -> void:
	match event.keycode:
		KEY_SPACE:
			# Flip page
			if event.shift_pressed:
				turn_page("left")
			else:
				turn_page("right")
		KEY_1:
			# Burn effect
			start_text_effect(TextEffect.BURN)
		KEY_2:
			# Ice effect
			start_text_effect(TextEffect.ICE)
		KEY_3:
			# Glow effect
			start_text_effect(TextEffect.GLOW)
		KEY_4:
			# Fade effect
			start_text_effect(TextEffect.FADE)
		KEY_0:
			# Clear effects
			stop_text_effect()
		KEY_C:
			# Test curl - animate curl up and down
			_test_curl_animation()
		KEY_D:
			# Test dialogue (offline)
			_test_dialogue()
		KEY_R:
			# Reset page
			stop_text_effect()
			curl_progress = 0.0


## Test curl animation (for debugging)
func _test_curl_animation() -> void:
	if turn_tween and turn_tween.is_running():
		return

	turn_tween = create_tween()
	turn_tween.set_ease(Tween.EASE_IN_OUT)
	turn_tween.set_trans(Tween.TRANS_SINE)
	turn_tween.tween_property(self, "curl_progress", 0.8, 0.5)
	turn_tween.tween_property(self, "curl_progress", 0.0, 0.5)


## Test dialogue (for debugging)
func _test_dialogue() -> void:
	if turn_tween and turn_tween.is_running():
		return

	# Create a mock entity for testing and store it
	var mock_entity := MockWorld.NPC.new(
		"test_npc",
		"Mysterious Stranger",
		"stranger",
		"A mysterious stranger stands here.",
		"A cloaked figure shrouded in shadow."
	)
	current_entity = mock_entity  # Store for dialogue flow
	_start_mock_dialogue(mock_entity)


## Start a text effect animation
func start_text_effect(effect: TextEffect) -> void:
	# Stop any running effect
	if effect_tween and effect_tween.is_running():
		effect_tween.kill()

	current_effect = effect
	shader_material.set_shader_parameter("text_effect", int(effect))

	# Animate effect progress
	effect_tween = create_tween()
	effect_tween.set_ease(Tween.EASE_IN_OUT)
	effect_tween.set_trans(Tween.TRANS_QUAD)
	effect_tween.tween_property(self, "effect_progress", 1.0, EFFECT_DURATION)

	print("Started effect: ", TextEffect.keys()[effect])


## Stop text effect
func stop_text_effect() -> void:
	if effect_tween and effect_tween.is_running():
		effect_tween.kill()

	# Animate back to zero
	effect_tween = create_tween()
	effect_tween.tween_property(self, "effect_progress", 0.0, 0.3)
	effect_tween.tween_callback(func():
		current_effect = TextEffect.NONE
		shader_material.set_shader_parameter("text_effect", 0)
	)


## Update effect shader parameters
func _update_effect_shader() -> void:
	if shader_material and shader_material.shader:
		shader_material.set_shader_parameter("effect_progress", effect_progress)


## Convert screen click to viewport coordinates and handle button presses
func _handle_page_click(screen_pos: Vector2) -> void:
	var camera := get_viewport().get_camera_3d()
	if not camera:
		return

	# Cast ray from camera through click position
	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)

	# Simple plane intersection (page is at z=0, facing camera)
	if abs(dir.z) < 0.001:
		return  # Ray parallel to page

	var t := -from.z / dir.z
	if t < 0:
		return  # Behind camera

	var hit_point := from + dir * t

	# Convert hit point to UV coordinates (page center is at origin)
	var uv_x := (hit_point.x / PAGE_WIDTH) + 0.5
	var uv_y := (hit_point.y / PAGE_HEIGHT) + 0.5

	# Check if within page bounds
	if uv_x < 0 or uv_x > 1 or uv_y < 0 or uv_y > 1:
		return

	# Convert UV to viewport pixel coordinates
	# Y is inverted: high world Y = top of page = low viewport Y
	var vp_x := uv_x * VIEWPORT_WIDTH
	var vp_y := (1.0 - uv_y) * VIEWPORT_HEIGHT

	# Check if click is in bottom bar area (only for room/menu pages)
	var bar_top := VIEWPORT_HEIGHT - BOTTOM_BAR_HEIGHT
	if current_page == PageType.DIALOGUE:
		# Dialogue page - forward click to SubViewport for accurate meta detection
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif current_page == PageType.ENTITY:
		# Entity page - forward click to SubViewport for accurate meta detection
		_forward_click_to_text_viewport(vp_x, vp_y)
	elif vp_y >= bar_top:
		_handle_bottom_bar_click(vp_x, vp_y - bar_top)
	elif current_page == PageType.ROOM:
		# Room page - forward click to SubViewport for NPC/item meta detection
		_forward_click_to_text_viewport(vp_x, vp_y)


## Setup dual viewport system for text effects
## Layer 1: page_viewport - parchment background + bottom bar
## Layer 2: text_viewport - text only with transparent background
func _setup_viewports() -> void:
	# === PAGE VIEWPORT (Background Layer) ===
	page_viewport = SubViewport.new()
	page_viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	page_viewport.transparent_bg = false
	page_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(page_viewport)

	# Background with aged parchment effect
	page_bg_container = Control.new()
	page_bg_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	page_viewport.add_child(page_bg_container)

	# Base parchment color - warm aged tan
	var bg := ColorRect.new()
	bg.color = Color(0.878, 0.816, 0.706)  # Aged parchment tan #E0D0B4
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	page_bg_container.add_child(bg)

	# Subtle vignette for slightly darker edges (very subtle)
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
	page_bg_container.add_child(vignette)

	# Setup bottom bar inside page viewport
	_setup_bottom_bar()

	# === TEXT VIEWPORT (Text Layer - Transparent Background) ===
	text_viewport = SubViewport.new()
	text_viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	text_viewport.transparent_bg = true  # Transparent for compositing
	text_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(text_viewport)

	# Text content container (everything except bottom bar area)
	text_container = Control.new()
	text_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	text_container.offset_bottom = -BOTTOM_BAR_HEIGHT
	text_viewport.add_child(text_container)

	# Create RichTextLabel for formatted text
	label = RichTextLabel.new()
	label.bbcode_enabled = true
	label.fit_content = false
	label.scroll_active = true
	label.scroll_following = true
	label.set_anchors_preset(Control.PRESET_FULL_RECT)
	label.offset_left = PAGE_PADDING_LEFT
	label.offset_right = -PAGE_PADDING_RIGHT
	label.offset_top = PAGE_PADDING_TOP
	label.offset_bottom = -PAGE_PADDING_BOTTOM
	label.add_theme_font_size_override("normal_font_size", 20)
	label.add_theme_font_size_override("bold_font_size", 22)
	label.add_theme_font_size_override("italics_font_size", 19)
	# Dark sepia ink color matching aged manuscript style
	label.add_theme_color_override("default_color", Color(0.09, 0.06, 0.03))  # #181008 - very dark sepia
	# Connect meta_clicked signal for accurate dialogue choice detection
	label.meta_clicked.connect(_on_label_meta_clicked)
	text_container.add_child(label)


## Handle meta clicks from RichTextLabel (dialogue choices, entity actions, room content)
func _on_label_meta_clicked(meta: Variant) -> void:
	var meta_str: String = str(meta)
	print("[Meta Click] Page=%s, meta=%s" % [PageType.keys()[current_page], meta_str])

	if current_page == PageType.DIALOGUE:
		# Dialogue choice - meta is the choice index
		var choice_index: int = int(meta)
		_select_dialogue_choice(choice_index)

	elif current_page == PageType.ENTITY:
		# Entity action - meta format is "action:action_key"
		if meta_str.begins_with("action:"):
			var action_key: String = meta_str.substr(7)  # Remove "action:" prefix
			_execute_entity_action(action_key)

	elif current_page == PageType.ROOM:
		# Room content - meta format is "npc:key" or "item:key"
		if meta_str.begins_with("npc:"):
			var npc_key: String = meta_str.substr(4)
			_select_npc_by_key(npc_key)
		elif meta_str.begins_with("item:"):
			var item_key: String = meta_str.substr(5)
			_select_item_by_key(item_key)


## Forward a click event to the text viewport for accurate RichTextLabel hit detection
func _forward_click_to_text_viewport(vp_x: float, vp_y: float) -> void:
	# Create synthetic mouse button press event
	var press_event := InputEventMouseButton.new()
	press_event.button_index = MOUSE_BUTTON_LEFT
	press_event.pressed = true
	press_event.position = Vector2(vp_x, vp_y)
	press_event.global_position = Vector2(vp_x, vp_y)

	# Push to text_viewport - this will trigger meta_clicked on RichTextLabel
	text_viewport.push_input(press_event)

	# Also send release event
	var release_event := InputEventMouseButton.new()
	release_event.button_index = MOUSE_BUTTON_LEFT
	release_event.pressed = false
	release_event.position = Vector2(vp_x, vp_y)
	release_event.global_position = Vector2(vp_x, vp_y)
	text_viewport.push_input(release_event)


func _setup_mesh() -> void:
	mesh_instance = MeshInstance3D.new()

	# Create a plane mesh for the page
	# No subdivisions needed - curl is handled in shader with unshaded mode
	var plane := PlaneMesh.new()
	plane.size = Vector2(PAGE_WIDTH, PAGE_HEIGHT)
	plane.subdivide_width = 0
	plane.subdivide_depth = 0
	mesh_instance.mesh = plane

	# Rotate so the page faces the camera (plane is horizontal by default)
	mesh_instance.rotation_degrees = Vector3(-90, 0, 0)

	# Create shader material
	shader_material = ShaderMaterial.new()
	var shader := load("res://shaders/page_curl.gdshader")
	if shader:
		shader_material.shader = shader
		# Initialize shader parameters
		shader_material.set_shader_parameter("curl_amount", 0.0)
		shader_material.set_shader_parameter("curl_direction", 1.0)
		shader_material.set_shader_parameter("curl_radius", 0.35)
		shader_material.set_shader_parameter("curl_angle", 2.5)
		shader_material.set_shader_parameter("shadow_intensity", 0.3)
		shader_material.set_shader_parameter("ambient_occlusion", 0.2)
	else:
		# Fallback to standard material if shader not found
		var fallback := StandardMaterial3D.new()
		fallback.albedo_color = Color.WHITE
		mesh_instance.set_surface_override_material(0, fallback)
		push_warning("Page curl shader not found, using fallback material")

	# Hide mesh until textures are ready (prevents white flash)
	mesh_instance.visible = false
	add_child(mesh_instance)

	# Apply viewport textures after mesh is added (must await)
	await _apply_viewport_textures()
	mesh_instance.visible = true


## Apply both viewport textures to the shader (dual-layer compositing)
func _apply_viewport_textures() -> void:
	# Wait for viewports to be ready
	await get_tree().process_frame

	if shader_material.shader:
		# Set both textures for dual-layer effects
		var page_tex := page_viewport.get_texture()
		var text_tex := text_viewport.get_texture()

		shader_material.set_shader_parameter("page_texture", page_tex)
		shader_material.set_shader_parameter("text_texture", text_tex)
		mesh_instance.set_surface_override_material(0, shader_material)
	else:
		# Fallback - just use page texture
		var mat := mesh_instance.get_surface_override_material(0) as StandardMaterial3D
		if mat:
			mat.albedo_texture = page_viewport.get_texture()


## Handle clicks within the bottom bar area
func _handle_bottom_bar_click(local_x: float, local_y: float) -> void:
	# Bottom bar layout: [Menu] [spacer] [Compass] [spacer] [Say]
	# Divide into thirds for simpler detection
	var third := VIEWPORT_WIDTH / 3.0

	if local_x < third:
		# Left third - Menu button
		bottom_bar_pressed.emit("menu")
	elif local_x > (VIEWPORT_WIDTH - third):
		# Right third - Say button
		bottom_bar_pressed.emit("say")
	else:
		# Middle third - Compass area
		var compass_center_x := VIEWPORT_WIDTH / 2.0
		var compass_center_y := BOTTOM_BAR_HEIGHT / 2.0

		var dx := local_x - compass_center_x
		var dy := local_y - compass_center_y

		# Check if in center dot area (no action)
		if abs(dx) < 20 and abs(dy) < 15:
			return

		# Determine direction based on position relative to center
		if abs(dx) > abs(dy):
			# More horizontal than vertical
			if dx > 0:
				bottom_bar_pressed.emit("east")
			else:
				bottom_bar_pressed.emit("west")
		else:
			# More vertical than horizontal
			if dy < 0:
				bottom_bar_pressed.emit("north")
			else:
				bottom_bar_pressed.emit("south")


func _setup_bottom_bar() -> void:
	# Bottom bar container - added to page_viewport (background layer)
	bottom_bar = Control.new()
	bottom_bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom_bar.offset_top = -BOTTOM_BAR_HEIGHT
	page_viewport.add_child(bottom_bar)

	# Add the actual content
	_setup_bottom_bar_content()


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


func _update_compass_buttons() -> void:
	if not bottom_bar:
		return

	# Find compass buttons and update enabled/disabled state with visual feedback
	var compass := bottom_bar.find_child("NorthBtn", true, false)
	if compass:
		compass = compass.get_parent().get_parent()  # Get VBoxContainer
		var north := compass.find_child("NorthBtn", true, false) as Button
		var south := compass.find_child("SouthBtn", true, false) as Button
		var west := compass.find_child("WestBtn", true, false) as Button
		var east := compass.find_child("EastBtn", true, false) as Button

		_style_compass_button(north, available_exits.has("north"))
		_style_compass_button(south, available_exits.has("south"))
		_style_compass_button(west, available_exits.has("west"))
		_style_compass_button(east, available_exits.has("east"))


## Style a compass button based on whether the exit is available
func _style_compass_button(btn: Button, is_available: bool) -> void:
	if btn == null:
		return

	btn.disabled = not is_available

	if is_available:
		# Available exit: normal dark sepia color, full opacity
		btn.modulate = Color(1.0, 1.0, 1.0, 1.0)
		btn.add_theme_color_override("font_color", Color(0.22, 0.16, 0.10))  # Dark sepia
		btn.add_theme_color_override("font_hover_color", Color(0.35, 0.25, 0.15))
		btn.add_theme_color_override("font_pressed_color", Color(0.15, 0.10, 0.05))
	else:
		# Unavailable exit: greyed out, reduced opacity
		btn.modulate = Color(0.6, 0.6, 0.6, 0.5)  # Grey and transparent
		btn.add_theme_color_override("font_color", Color(0.5, 0.45, 0.4))
		btn.add_theme_color_override("font_disabled_color", Color(0.5, 0.45, 0.4))


## Update bottom bar for entity view (Back, Talk, Examine)
func _update_entity_bottom_bar() -> void:
	if not bottom_bar:
		return

	# Clear existing bottom bar content and rebuild for entity view
	for child in bottom_bar.get_children():
		child.queue_free()

	# Background
	var bar_bg := ColorRect.new()
	bar_bg.color = Color(0.82, 0.75, 0.64)
	bar_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bottom_bar.add_child(bar_bg)

	# Separator line
	var separator := ColorRect.new()
	separator.color = Color(0.45, 0.38, 0.30)
	separator.set_anchors_preset(Control.PRESET_TOP_WIDE)
	separator.custom_minimum_size = Vector2(0, 1)
	bottom_bar.add_child(separator)

	# HBox for buttons
	var hbox := HBoxContainer.new()
	hbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	hbox.offset_left = 20
	hbox.offset_right = -20
	hbox.offset_top = 10
	hbox.offset_bottom = -10
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom_bar.add_child(hbox)

	# Back button (left)
	var back_btn := Button.new()
	back_btn.text = "← Back"
	back_btn.custom_minimum_size = Vector2(80, BUTTON_SIZE)
	back_btn.add_theme_font_size_override("font_size", 16)
	back_btn.pressed.connect(go_back_to_room)
	hbox.add_child(back_btn)

	# Spacer
	var spacer1 := Control.new()
	spacer1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer1)

	# Talk button (center)
	var talk_btn := Button.new()
	talk_btn.text = "💬 Talk"
	talk_btn.custom_minimum_size = Vector2(80, BUTTON_SIZE)
	talk_btn.add_theme_font_size_override("font_size", 16)
	talk_btn.pressed.connect(_on_entity_talk_pressed)
	hbox.add_child(talk_btn)

	# Spacer
	var spacer2 := Control.new()
	spacer2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(spacer2)

	# Examine button (right)
	var examine_btn := Button.new()
	examine_btn.text = "👁 Look"
	examine_btn.custom_minimum_size = Vector2(80, BUTTON_SIZE)
	examine_btn.add_theme_font_size_override("font_size", 16)
	examine_btn.pressed.connect(_on_entity_examine_pressed)
	hbox.add_child(examine_btn)


## Restore bottom bar for room view
func _restore_room_bottom_bar() -> void:
	if not bottom_bar:
		return

	# Clear and rebuild
	for child in bottom_bar.get_children():
		child.queue_free()

	# Rebuild the standard room bottom bar
	_setup_bottom_bar_content()


func _setup_bottom_bar_content() -> void:
	# Background - slightly darker aged parchment for bottom bar
	var bar_bg := ColorRect.new()
	bar_bg.color = Color(0.82, 0.75, 0.64)
	bar_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bottom_bar.add_child(bar_bg)

	# Decorative separator line at top
	var separator := ColorRect.new()
	separator.color = Color(0.45, 0.38, 0.30)
	separator.set_anchors_preset(Control.PRESET_TOP_WIDE)
	separator.custom_minimum_size = Vector2(0, 1)
	bottom_bar.add_child(separator)

	# HBox for buttons
	var hbox := HBoxContainer.new()
	hbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	hbox.offset_left = 20
	hbox.offset_right = -20
	hbox.offset_top = 10
	hbox.offset_bottom = -10
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom_bar.add_child(hbox)

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

	# Update compass after setup
	_update_compass_buttons()


## Entity action: Talk
func _on_entity_talk_pressed() -> void:
	if current_entity == null:
		return
	# Send talk action to server (or show mock response offline)
	if GameState.is_online:
		GameState.entity_action("talk", _get_entity_prop(current_entity, "key", ""))
	else:
		# Offline mode - trigger mock dialogue
		_start_mock_dialogue(current_entity)


## Entity action: Examine/Look
func _on_entity_examine_pressed() -> void:
	if current_entity == null:
		return
	# The long description is already shown, but we can add to event feed
	add_event("You examine %s closely." % _get_entity_prop(current_entity, "name", "it"))


func _connect_signals() -> void:
	GameState.room_changed.connect(_on_room_changed)
	GameState.navigation_failed.connect(_on_navigation_failed)
	GameState.entity_context_received.connect(_on_entity_context_received)

	# Connect to PhoenixClient dialogue signals
	if has_node("/root/PhoenixClient"):
		var phoenix := get_node("/root/PhoenixClient")
		phoenix.dialogue_started.connect(_on_dialogue_started)
		phoenix.dialogue_updated.connect(_on_dialogue_updated)
		phoenix.dialogue_ended.connect(_on_dialogue_ended)


func _on_room_changed(room: MockWorld.Room) -> void:
	# Clear events when changing rooms
	events.clear()
	# Only display room if we're on room page
	if current_page == PageType.ROOM:
		display_room(room)


func _on_navigation_failed(direction: String, reason: String) -> void:
	add_event(reason)


## Handle entity context received from server (includes available actions)
func _on_entity_context_received(entity_data: Dictionary) -> void:
	print("[BookPage] Entity context received: %s with %d actions" % [
		entity_data.get("name", "unknown"),
		entity_data.get("actions", []).size()
	])
	# Convert to entity format and show details
	var entity := _convert_server_entity(entity_data)
	show_entity_details(entity)


## Convert server entity data to local format (preserves actions)
func _convert_server_entity(data: Dictionary) -> Dictionary:
	return {
		"key": data.get("key", data.get("id", "")),
		"name": data.get("name", "Unknown"),
		"long_desc": data.get("long_desc", ""),
		"description": data.get("description", ""),
		"type": data.get("type", "npc"),
		"actions": data.get("actions", [])  # Preserve actions from server
	}


## Switch to a different page type with animation
func switch_to_page(page_type: PageType, direction: String = "right") -> void:
	if turn_tween and turn_tween.is_running():
		return

	pending_page = page_type
	turn_page(direction)


## Called when page turn completes - show the pending page content
func _on_turn_completed_show_page(direction: String) -> void:
	print("[Turn Complete] direction=", direction, " pending_page=", pending_page)
	current_page = pending_page
	match current_page:
		PageType.ROOM:
			print("[Turn Complete] Showing ROOM")
			# Show bottom bar for room
			if bottom_bar:
				bottom_bar.visible = true
			_restore_room_bottom_bar()
			if GameState.current_room:
				display_room(GameState.current_room)
			else:
				print("[Turn Complete] ERROR: No current_room!")
		PageType.MENU:
			print("[Turn Complete] Showing MENU")
			if GameState.current_room:
				display_menu()
		PageType.ENTITY:
			print("[Turn Complete] Showing ENTITY")
			if current_entity:
				display_entity(current_entity)
			else:
				print("[Turn Complete] ERROR: No current_entity!")
		PageType.DIALOGUE:
			print("[Turn Complete] Showing DIALOGUE")
			if not dialogue_data.is_empty():
				display_dialogue(dialogue_data)
			else:
				print("[Turn Complete] ERROR: No dialogue_data!")


## Add an event to the feed (displayed below room content)
func add_event(text: String) -> void:
	# Strip HTML tags from server events
	var clean_text := _strip_html_tags(text)
	var event := {
		"text": clean_text,
		"timestamp": Time.get_ticks_msec() / 1000.0
	}
	events.append(event)

	# Trim old events
	while events.size() > MAX_EVENTS:
		events.pop_front()

	# Only refresh room display if we're on the room page
	if current_page == PageType.ROOM and GameState.current_room:
		display_room(GameState.current_room)
		# Scroll to bottom to show new event
		await get_tree().process_frame
		label.scroll_to_line(label.get_line_count())


## Clear all events
func clear_events() -> void:
	events.clear()
	if GameState.current_room:
		display_room(GameState.current_room)


## Display a room's content on the page
## Layout matches the old React Native client format
func display_room(room: MockWorld.Room) -> void:
	if room == null:
		label.text = ""
		return

	# Track exits for compass
	available_exits = room.exits.keys() if room.exits else []
	_update_compass_buttons()

	var text := ""

	# Sepia ink colors - very dark for maximum readability
	var title_color := "#100a04"      # Nearly black sepia for titles
	var body_color := "#181008"       # Very dark brown main body text
	var secondary_color := "#201408"  # Very dark brown for NPCs, items
	var event_color := "#302010"      # Events (slightly lighter)

	# Room title (centered, larger)
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, room.name]

	# Room description
	text += "[color=%s]%s[/color]\n" % [body_color, room.description]

	# Characters section (NPCs) - use meta tags for accurate click detection
	if room.npcs.size() > 0:
		var npc_texts: Array[String] = []
		for npc in room.npcs:
			# Use long_desc for room display (one-liner with keyword)
			var npc_text := npc.long_desc if npc.get("long_desc") and npc.long_desc != "" else "%s is here." % npc.name
			npc_text = npc_text.replace("\n", " ").replace("  ", " ")
			# Wrap the primary keyword with url meta tag for click detection
			var keyword: String = npc.get("primary_keyword") if npc.get("primary_keyword") else ""
			var npc_key: String = npc.get("key") if npc.get("key") else ""
			if keyword != "" and keyword in npc_text and npc_key != "":
				npc_text = npc_text.replace(keyword, "[url=npc:%s][u]%s[/u][/url]" % [npc_key, keyword])
			npc_texts.append(npc_text)
		text += "[color=%s]%s[/color]\n" % [secondary_color, " ".join(npc_texts)]

	# Items section - use meta tags for accurate click detection
	if room.items.size() > 0:
		var item_texts: Array[String] = []
		for item in room.items:
			# Use long_desc for room display (one-liner with keyword)
			var item_text := item.long_desc if item.get("long_desc") and item.long_desc != "" else "%s lies here." % item.name
			item_text = item_text.replace("\n", " ").replace("  ", " ")
			# Wrap the primary keyword with url meta tag for click detection
			var keyword: String = item.get("primary_keyword") if item.get("primary_keyword") else ""
			var item_key: String = item.get("key") if item.get("key") else ""
			if keyword != "" and keyword in item_text and item_key != "":
				item_text = item_text.replace(keyword, "[url=item:%s][u]%s[/u][/url]" % [item_key, keyword])
			item_texts.append(item_text)
		text += "[color=%s]%s[/color]\n" % [secondary_color, " ".join(item_texts)]

	# Event feed section (one blank line above)
	if events.size() > 0:
		text += "\n"
		for event in events:
			text += "[color=%s][i]%s[/i][/color]\n" % [event_color, event["text"]]

	label.text = text


## Handle clicks on entity page (for action options)
func _handle_entity_content_click(vp_x: float, vp_y: float) -> void:
	if current_entity == null:
		return

	# Use dynamically calculated action positions
	const ACTION_HEIGHT := 50.0

	if vp_y < _entity_actions_start_y:
		return  # Clicked on title/description

	# Determine which action was clicked based on position
	var action_index := int((vp_y - _entity_actions_start_y) / ACTION_HEIGHT)

	if action_index < 0 or action_index >= current_entity_actions.size():
		return

	var action_key: String = current_entity_actions[action_index]
	_execute_entity_action(action_key)


## Execute an entity action by key
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
			# TODO: Open shop UI
			add_event("Shop not yet implemented")
		"attack":
			# TODO: Start combat
			add_event("Combat not yet implemented")
		"get":
			# Pick up item
			if GameState.is_online:
				GameState.entity_action("get", entity_key)
			go_back_to_room()
		_:
			# Send unknown action to server
			if GameState.is_online:
				GameState.entity_action(action_key, entity_key)
			else:
				add_event("Action '%s' not available offline" % action_key)


## Handle clicks in the content area (for selecting entities)
func _handle_content_click(vp_x: float, vp_y: float) -> void:
	var room := GameState.current_room
	if room == null:
		return

	# Content layout estimate:
	# - Title: ~48px from top (font_size 26 + margins)
	# - Description: variable height
	# - NPCs section: starts after description
	# - Items section: after NPCs

	# For MVP, use simple vertical zones:
	# Top third = title/description (no action)
	# Middle third = NPCs
	# Bottom third (above bar) = Items

	var content_height := VIEWPORT_HEIGHT - BOTTOM_BAR_HEIGHT
	var zone_height := content_height / 3.0

	if vp_y < zone_height:
		# Title/description zone - no action
		return
	elif vp_y < zone_height * 2:
		# NPC zone - select first NPC if available
		if room.npcs.size() > 0:
			_click_entity(room.npcs[0])
	else:
		# Item zone - select first item if available
		if room.items.size() > 0:
			_click_entity(room.items[0])


## Click on an entity - goes through server when online to get resolved actions
func _click_entity(entity: Variant) -> void:
	var entity_id: String = _get_entity_prop(entity, "id", "")
	if entity_id == "":
		entity_id = _get_entity_prop(entity, "key", "")

	if GameState.is_online and entity_id != "":
		# When online, request entity context from server (includes resolved actions)
		print("[BookPage] Requesting entity context from server: %s" % entity_id)
		GameState.click_entity(entity_id)
	else:
		# Offline mode - show entity details directly with local data
		show_entity_details(entity)


## Select an NPC by key (from meta click)
func _select_npc_by_key(npc_key: String) -> void:
	var room := GameState.current_room
	if room == null:
		return

	for npc in room.npcs:
		var key: String = npc.get("key") if npc.get("key") else ""
		if key == npc_key:
			_click_entity(npc)
			return

	print("[BookPage] NPC not found: %s" % npc_key)


## Select an item by key (from meta click)
func _select_item_by_key(item_key: String) -> void:
	var room := GameState.current_room
	if room == null:
		return

	for item in room.items:
		var key: String = item.get("key") if item.get("key") else ""
		if key == item_key:
			_click_entity(item)
			return

	print("[BookPage] Item not found: %s" % item_key)


## Show entity details page with page flip animation
func show_entity_details(entity: Variant) -> void:
	if turn_tween and turn_tween.is_running():
		return

	current_entity = entity
	pending_page = PageType.ENTITY
	turn_page("right")


## Display entity details on the page
func display_entity(entity: Variant) -> void:
	if entity == null:
		label.text = ""
		return

	var text := ""

	# Sepia ink colors
	var title_color := "#2a1f14"
	var body_color := "#362816"
	var action_color := "#4a3828"

	# Entity name as title
	var entity_name: String = _get_entity_prop(entity, "name", "Unknown")
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, entity_name]

	# Entity description (use 'description' field for detailed view)
	var desc: String = _get_entity_prop(entity, "description", "")
	if desc == "":
		desc = _get_entity_prop(entity, "long_desc", "")
	if desc == "":
		desc = entity_name
	# Normalize newlines to spaces for prose flow
	desc = desc.replace("\n", " ").replace("  ", " ")
	text += "[color=%s]%s[/color]\n\n" % [body_color, desc]

	# Build action list from server data or use defaults
	var actions: Array = _get_entity_prop(entity, "actions", [])
	current_entity_actions = []

	# Add server-provided actions (using url meta tags for accurate click detection)
	text += "\n"
	for action in actions:
		var action_key: String = action.get("key", "") if action is Dictionary else str(action)
		var action_label: String = action.get("label", action_key.capitalize()) if action is Dictionary else action_key.capitalize()
		current_entity_actions.append(action_key)
		text += "[color=%s][url=action:%s][u]%s[/u][/url][/color]\n\n" % [action_color, action_key, action_label]

	# Always add Leave as fallback action (Look removed - description already visible)
	if "leave" not in current_entity_actions:
		current_entity_actions.append("leave")
		text += "[color=%s][url=action:leave][u]Leave[/u][/url][/color]\n" % action_color

	label.text = text

	# Calculate action positions after layout (deferred to next frame)
	call_deferred("_calculate_entity_action_zones", current_entity_actions.size())

	# Hide bottom bar on entity page
	if bottom_bar:
		bottom_bar.visible = false


## Calculate where entity action links are positioned in the viewport
func _calculate_entity_action_zones(action_count: int = 3) -> void:
	if label == null:
		return

	# Get the actual content height after layout
	var content_height := label.get_content_height()

	# Each action ~48px (text + spacing), plus initial \n ~24px
	var action_section_height := 24.0 + (action_count * 48.0)

	# Actions start after the header/description content
	_entity_actions_start_y = max(content_height - action_section_height, 100.0)

	# Add page padding offset since label is positioned with padding
	_entity_actions_start_y += PAGE_PADDING_TOP


## Return to room view from entity details
func go_back_to_room() -> void:
	if turn_tween and turn_tween.is_running():
		return

	current_entity = null
	pending_page = PageType.ROOM
	turn_page("left")


## Display the menu page
func display_menu() -> void:
	var text := ""

	# Sepia ink colors
	var title_color := "#2a1f14"
	var tab_color := "#4a3828"
	var separator_color := "#8a7a6a"
	var hint_color := "#6a5a4a"

	# Menu title
	text += "[center][font_size=28][color=%s][b]Menu[/b][/color][/font_size][/center]\n\n" % title_color

	# Tab buttons (text-based)
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

	# Tab content
	match current_menu_tab:
		MenuTab.INVENTORY:
			text += _get_inventory_content()
		MenuTab.CHARACTER:
			text += _get_character_content()
		MenuTab.SETTINGS:
			text += _get_settings_content()

	# Back instruction
	text += "\n\n[center][color=%s][i]Press Menu or swipe to return[/i][/color][/center]" % hint_color

	label.text = text


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


## Cycle to next menu tab
func next_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY:
			current_menu_tab = MenuTab.CHARACTER
		MenuTab.CHARACTER:
			current_menu_tab = MenuTab.SETTINGS
		MenuTab.SETTINGS:
			current_menu_tab = MenuTab.INVENTORY
	display_menu()


## Cycle to previous menu tab
func prev_menu_tab() -> void:
	match current_menu_tab:
		MenuTab.INVENTORY:
			current_menu_tab = MenuTab.SETTINGS
		MenuTab.CHARACTER:
			current_menu_tab = MenuTab.INVENTORY
		MenuTab.SETTINGS:
			current_menu_tab = MenuTab.CHARACTER
	display_menu()


## Animate page turn (direction: "left" or "right")
## Now with more dramatic, realistic book page curl
func turn_page(direction: String = "right") -> void:
	if turn_tween and turn_tween.is_running():
		return  # Already animating

	var curl_dir := 1.0 if direction == "right" else -1.0
	shader_material.set_shader_parameter("curl_direction", curl_dir)

	page_turn_started.emit(direction)

	turn_tween = create_tween()

	# Phase 1: Quick lift with ease-out (page lifts off)
	turn_tween.set_ease(Tween.EASE_OUT)
	turn_tween.set_trans(Tween.TRANS_QUAD)
	turn_tween.tween_property(self, "curl_progress", 0.6, TURN_DURATION * 0.3)

	# Phase 2: Full curl to midpoint (page curls over)
	turn_tween.set_ease(Tween.EASE_IN_OUT)
	turn_tween.set_trans(Tween.TRANS_SINE)
	turn_tween.tween_property(self, "curl_progress", 1.0, TURN_DURATION * 0.25)

	# At midpoint, switch content
	turn_tween.tween_callback(_on_turn_completed_show_page.bind(direction))

	# Phase 3: Settle back down with slight bounce (page lands)
	turn_tween.set_ease(Tween.EASE_OUT)
	turn_tween.set_trans(Tween.TRANS_BACK)
	turn_tween.tween_property(self, "curl_progress", 0.0, TURN_DURATION * 0.45)

	turn_tween.finished.connect(func(): page_turn_completed.emit(direction), CONNECT_ONE_SHOT)


func _update_curl_shader() -> void:
	if shader_material and shader_material.shader:
		# Apply curl strength - more dramatic curl
		shader_material.set_shader_parameter("curl_amount", curl_progress * CURL_STRENGTH)

		# Dynamic curl radius - tighter when fully curled
		var dynamic_radius := lerpf(0.4, 0.25, curl_progress)
		shader_material.set_shader_parameter("curl_radius", dynamic_radius)

		# More curl angle at peak
		var dynamic_angle := lerpf(2.0, 3.0, curl_progress)
		shader_material.set_shader_parameter("curl_angle", dynamic_angle)


## Strip HTML tags from text
func _strip_html_tags(text: String) -> String:
	var regex := RegEx.new()
	regex.compile("<[^>]*>")
	return regex.sub(text, "", true)


## Get a property from an entity, handling both Dictionary and class objects
func _get_entity_prop(entity: Variant, prop: String, default: Variant = "") -> Variant:
	if entity is Dictionary:
		return entity.get(prop, default)
	else:
		# For class objects (MockWorld.NPC, MockWorld.Item), use Object.get()
		var value = entity.get(prop)
		if value == null:
			return default
		return value


# =============================================================================
# Dialogue System
# =============================================================================

## Handle dialogue_started signal from PhoenixClient
func _on_dialogue_started(data: Dictionary) -> void:
	print("[Dialogue] Started: ", data)
	print("[Dialogue] Clearing history, was size: ", dialogue_history.size())
	_is_mock_dialogue = false  # Default to real dialogue (mock flow will override)
	dialogue_history = []  # Clear history for new conversation
	dialogue_data = data
	pre_dialogue_page = current_page  # Remember where to return
	pending_page = PageType.DIALOGUE
	turn_page("right")


## Handle dialogue_updated signal from PhoenixClient
func _on_dialogue_updated(data: Dictionary) -> void:
	print("[Dialogue] Updated: ", data)
	print("[Dialogue] History size before update: ", dialogue_history.size())
	dialogue_data = data
	# Update display without page turn (same page, new content)
	if current_page == PageType.DIALOGUE:
		display_dialogue(dialogue_data)


## Handle dialogue_ended signal from PhoenixClient
func _on_dialogue_ended() -> void:
	print("[Dialogue] Ended")
	dialogue_data = {}
	dialogue_history = []  # Clear history
	# Return to previous page
	pending_page = pre_dialogue_page
	turn_page("left")


## Display dialogue content on the page (conversation history mode)
func display_dialogue(data: Dictionary) -> void:
	if data.is_empty():
		label.text = ""
		return

	# Sepia ink colors
	var title_color := "#2a1f14"
	var body_color := "#362816"
	var player_color := "#1a3a2a"  # Darker green for player responses
	var choice_color := "#4a3828"
	var separator_color := "#8a7a6a"
	var hint_color := "#6a5a4a"

	# Get current speaker and text (capitalize speaker name)
	var speaker: String = data.get("speaker", "")
	if speaker == "":
		speaker = data.get("entity_id", "Someone")
	speaker = speaker.capitalize()  # Capitalize first letter of each word
	var dialogue_text: String = data.get("text", "")
	dialogue_text = dialogue_text.replace("\n", " ").replace("  ", " ")

	# Add current NPC line to history if not already there
	# (Check to avoid duplicates on re-renders - compare values, not dict references)
	var should_add := true
	if not dialogue_history.is_empty():
		var last_entry: Dictionary = dialogue_history[-1]
		if last_entry.get("speaker") == speaker and last_entry.get("text") == dialogue_text and not last_entry.get("is_player", false):
			should_add = false

	if should_add:
		dialogue_history.append({"speaker": speaker, "text": dialogue_text, "is_player": false})
		print("[Dialogue] Added to history: ", speaker, " - ", dialogue_text.substr(0, 50))

	# Build the full conversation display
	var text := ""

	# Title - show NPC name at top
	text += "[center][font_size=26][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, speaker]

	# Display conversation history (novel-like format)
	for entry in dialogue_history:
		var entry_speaker: String = entry.get("speaker", "").capitalize()
		var entry_text: String = entry.get("text", "")
		var is_player: bool = entry.get("is_player", false)

		if is_player:
			# Player response - novel format
			text += "[color=%s]You say, [i]\"%s\"[/i][/color]\n\n" % [player_color, entry_text]
		else:
			# NPC line - novel format
			text += "[color=%s]%s says, [i]\"%s\"[/i][/color]\n\n" % [body_color, entry_speaker, entry_text]

	# Choices (using url meta tags for accurate click detection)
	var choices: Array = data.get("choices", [])
	if choices.size() > 0:
		for i in range(choices.size()):
			var choice: Dictionary = choices[i]
			var choice_text: String = choice.get("text", "Continue")
			# Use [url=index] for clickable meta - Godot handles hit detection accurately
			text += "[color=%s]%d. [url=%d][u]%s[/u][/url][/color]\n\n" % [choice_color, i + 1, i, choice_text]
	else:
		# No choices = end of conversation (use -1 as continue signal)
		text += "[color=%s][url=-1][u]Continue[/u][/url][/color]\n\n" % choice_color

	# Hint
	text += "\n[center][color=%s][i]Tap a choice to continue[/i][/color][/center]" % hint_color

	label.text = text

	# Hide bottom bar during dialogue
	if bottom_bar:
		bottom_bar.visible = false


## Handle clicks on dialogue page (for selecting choices)
func _handle_dialogue_click(vp_x: float, vp_y: float) -> void:
	var choices: Array = dialogue_data.get("choices", [])

	# Layout estimate for dialogue page (no separators):
	# - Title: ~0-50px
	# - Conversation history: variable (~50px per entry)
	# - Choices start after history
	# - Each choice: ~40px height
	# Calculate based on history size
	var history_height := dialogue_history.size() * 60.0  # ~60px per history entry
	var choices_start_y := 60.0 + history_height  # Title + history
	var choice_height := 40.0

	if vp_y < choices_start_y:
		return  # Clicked above choices

	# Calculate which choice was clicked
	var choice_index := int((vp_y - choices_start_y) / choice_height)

	if choices.size() == 0:
		# No choices = "Continue" ends dialogue
		_select_dialogue_choice(-1)
	elif choice_index >= 0 and choice_index < choices.size():
		_select_dialogue_choice(choice_index)


## Send selected dialogue choice to server
func _select_dialogue_choice(choice_index: int) -> void:
	# Add player's choice to conversation history
	if choice_index >= 0:
		var choices: Array = dialogue_data.get("choices", [])
		if choice_index < choices.size():
			var choice: Dictionary = choices[choice_index]
			var choice_text: String = choice.get("text", "Continue")
			dialogue_history.append({"speaker": "You", "text": choice_text, "is_player": true})

	# If we're in mock dialogue mode, always use mock advancement
	if _is_mock_dialogue:
		_advance_mock_dialogue(choice_index)
		return

	# Otherwise, try to send to server
	if has_node("/root/PhoenixClient"):
		var phoenix := get_node("/root/PhoenixClient")
		if choice_index >= 0:
			phoenix.dialogue_select(choice_index)
		else:
			# -1 means continue/end when no choices
			phoenix.dialogue_select(0)
	else:
		# Fallback to mock if no Phoenix client
		_advance_mock_dialogue(choice_index)


## Mock dialogue node index (for offline testing)
var _mock_dialogue_node: int = 0

## Whether we're in a mock dialogue session (vs real server dialogue)
var _is_mock_dialogue: bool = false

## Start mock dialogue for offline testing
func _start_mock_dialogue(entity: Variant) -> void:
	_mock_dialogue_node = 0
	var mock_data := _get_mock_dialogue_node(entity, 0)
	_on_dialogue_started(mock_data)  # This sets _is_mock_dialogue = false
	_is_mock_dialogue = true  # Override to mark as mock dialogue


## Advance mock dialogue to next node
func _advance_mock_dialogue(choice_index: int) -> void:
	_mock_dialogue_node += 1

	# Simple 2-node dialogue for testing
	if _mock_dialogue_node >= 2:
		_on_dialogue_ended()
		return

	var mock_data := _get_mock_dialogue_node(current_entity, _mock_dialogue_node)
	_on_dialogue_updated(mock_data)


## Get mock dialogue node data for testing
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
				{"text": "I will find him."},
				{"text": "That sounds dangerous."}
			]
		}
