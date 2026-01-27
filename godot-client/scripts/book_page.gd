## 3D book page with text rendering via SubViewport.
## Handles page curl animation, room content display, menu, and bottom bar.
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
enum PageType { ROOM, MENU, ENTITY }

## Menu tabs
enum MenuTab { INVENTORY, CHARACTER, SETTINGS }

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
const TURN_DURATION := 0.5
const CURL_STRENGTH := 0.3

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

## Current page state
var current_page: PageType = PageType.ROOM
var current_menu_tab: MenuTab = MenuTab.INVENTORY
var pending_page: PageType = PageType.ROOM  # Page to show after turn completes
var current_entity: Variant = null  # NPC or Item being viewed on entity page

## Child nodes
var mesh_instance: MeshInstance3D
var viewport: SubViewport
var content_container: Control
var label: RichTextLabel
var bottom_bar: Control
var shader_material: ShaderMaterial

## Animation tween
var turn_tween: Tween

## Event feed - stores recent events as {text: String, timestamp: float}
var events: Array[Dictionary] = []

## Available exits (for compass)
var available_exits: Array = []


func _ready() -> void:
	_setup_viewport()
	_setup_mesh()
	_connect_signals()

	# Display initial room if available
	if GameState.current_room:
		display_room(GameState.current_room)


## Handle input for SubViewport interaction
func _input(event: InputEvent) -> void:
	if not visible:
		return

	# Handle mouse/touch clicks on the 3D page
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_page_click(event.position)
	elif event is InputEventScreenTouch and event.pressed:
		_handle_page_click(event.position)


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
	var vp_x := uv_x * VIEWPORT_WIDTH
	var vp_y := (1.0 - uv_y) * VIEWPORT_HEIGHT

	# Check if click is in bottom bar area (only for room/menu pages)
	var bar_top := VIEWPORT_HEIGHT - BOTTOM_BAR_HEIGHT
	if current_page == PageType.ENTITY:
		# Entity page has no bottom bar - handle content clicks for actions
		_handle_entity_content_click(vp_x, vp_y)
	elif vp_y >= bar_top:
		_handle_bottom_bar_click(vp_x, vp_y - bar_top)
	elif current_page == PageType.ROOM:
		_handle_content_click(vp_x, vp_y)


func _setup_viewport() -> void:
	# Create SubViewport for rendering text to texture
	viewport = SubViewport.new()
	viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	viewport.transparent_bg = false
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)

	# Background with aged parchment effect
	var bg_container := Control.new()
	bg_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	viewport.add_child(bg_container)

	# Base parchment color - warm aged tan
	var bg := ColorRect.new()
	bg.color = Color(0.878, 0.816, 0.706)  # Aged parchment tan #E0D0B4
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_container.add_child(bg)

	# Vignette overlay for darker edges (aged look)
	var vignette := ColorRect.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	# Create a shader for radial gradient vignette
	var vignette_shader := Shader.new()
	vignette_shader.code = """
shader_type canvas_item;
void fragment() {
	vec2 uv = UV - 0.5;
	float dist = length(uv * vec2(1.2, 1.0));
	float vignette = smoothstep(0.3, 0.75, dist);
	COLOR = vec4(0.35, 0.28, 0.2, vignette * 0.35);
}
"""
	var vignette_mat := ShaderMaterial.new()
	vignette_mat.shader = vignette_shader
	vignette.material = vignette_mat
	bg_container.add_child(vignette)

	# Subtle noise texture overlay for paper grain
	var grain := ColorRect.new()
	grain.set_anchors_preset(Control.PRESET_FULL_RECT)
	var grain_shader := Shader.new()
	grain_shader.code = """
shader_type canvas_item;
float rand(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
void fragment() {
	float noise = rand(UV * 200.0) * 0.04;
	COLOR = vec4(vec3(0.4, 0.35, 0.25), noise);
}
"""
	var grain_mat := ShaderMaterial.new()
	grain_mat.shader = grain_shader
	grain.material = grain_mat
	bg_container.add_child(grain)

	# Content container (everything except bottom bar)
	content_container = Control.new()
	content_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	content_container.offset_bottom = -BOTTOM_BAR_HEIGHT
	viewport.add_child(content_container)

	# Create RichTextLabel for formatted text
	label = RichTextLabel.new()
	label.bbcode_enabled = true
	label.fit_content = false
	label.scroll_active = true
	label.scroll_following = true
	# Use anchors with offsets for padding (theme constants don't work for margins)
	label.set_anchors_preset(Control.PRESET_FULL_RECT)
	label.offset_left = PAGE_PADDING_LEFT
	label.offset_right = -PAGE_PADDING_RIGHT
	label.offset_top = PAGE_PADDING_TOP
	label.offset_bottom = -PAGE_PADDING_BOTTOM
	label.add_theme_font_size_override("normal_font_size", 20)
	label.add_theme_font_size_override("bold_font_size", 22)
	label.add_theme_font_size_override("italics_font_size", 19)
	# Dark sepia ink color matching aged manuscript style
	label.add_theme_color_override("default_color", Color(0.22, 0.16, 0.10))  # #382919
	content_container.add_child(label)

	# Setup bottom bar inside viewport
	_setup_bottom_bar()


func _setup_mesh() -> void:
	mesh_instance = MeshInstance3D.new()

	# Create a plane mesh for the page
	var plane := PlaneMesh.new()
	plane.size = Vector2(PAGE_WIDTH, PAGE_HEIGHT)
	plane.subdivide_width = 32  # Subdivisions for curl deformation
	plane.subdivide_depth = 32
	mesh_instance.mesh = plane

	# Rotate so the page faces the camera (plane is horizontal by default)
	mesh_instance.rotation_degrees = Vector3(-90, 0, 0)

	# Create shader material
	shader_material = ShaderMaterial.new()
	var shader := load("res://shaders/page_curl.gdshader")
	if shader:
		shader_material.shader = shader
		shader_material.set_shader_parameter("curl_amount", 0.0)
		shader_material.set_shader_parameter("curl_direction", 1.0)
	else:
		# Fallback to standard material if shader not found
		var fallback := StandardMaterial3D.new()
		fallback.albedo_color = Color.WHITE
		mesh_instance.set_surface_override_material(0, fallback)
		push_warning("Page curl shader not found, using fallback material")

	# Apply viewport texture to material
	_apply_viewport_texture()

	add_child(mesh_instance)


func _apply_viewport_texture() -> void:
	# Wait for viewport to be ready
	await get_tree().process_frame

	var viewport_texture := viewport.get_texture()

	if shader_material.shader:
		shader_material.set_shader_parameter("page_texture", viewport_texture)
		mesh_instance.set_surface_override_material(0, shader_material)
	else:
		var mat := mesh_instance.get_surface_override_material(0) as StandardMaterial3D
		if mat:
			mat.albedo_texture = viewport_texture


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
	# Bottom bar container
	bottom_bar = Control.new()
	bottom_bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom_bar.offset_top = -BOTTOM_BAR_HEIGHT
	viewport.add_child(bottom_bar)

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

	# Find compass buttons and update enabled state
	var compass := bottom_bar.find_child("NorthBtn", true, false)
	if compass:
		compass = compass.get_parent().get_parent()  # Get VBoxContainer
		var north := compass.find_child("NorthBtn", true, false) as Button
		var south := compass.find_child("SouthBtn", true, false) as Button
		var west := compass.find_child("WestBtn", true, false) as Button
		var east := compass.find_child("EastBtn", true, false) as Button

		if north:
			north.disabled = not available_exits.has("north")
		if south:
			south.disabled = not available_exits.has("south")
		if west:
			west.disabled = not available_exits.has("west")
		if east:
			east.disabled = not available_exits.has("east")


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
		GameState.entity_action("talk", current_entity.key)
	else:
		add_event("You speak with %s." % current_entity.name)


## Entity action: Examine/Look
func _on_entity_examine_pressed() -> void:
	if current_entity == null:
		return
	# The long description is already shown, but we can add to event feed
	add_event("You examine %s closely." % current_entity.name)


func _connect_signals() -> void:
	GameState.room_changed.connect(_on_room_changed)
	GameState.navigation_failed.connect(_on_navigation_failed)


func _on_room_changed(room: MockWorld.Room) -> void:
	# Clear events when changing rooms
	events.clear()
	# Only display room if we're on room page
	if current_page == PageType.ROOM:
		display_room(room)


func _on_navigation_failed(direction: String, reason: String) -> void:
	add_event(reason)


## Switch to a different page type with animation
func switch_to_page(page_type: PageType, direction: String = "right") -> void:
	if turn_tween and turn_tween.is_running():
		return

	pending_page = page_type
	turn_page(direction)


## Called when page turn completes - show the pending page content
func _on_turn_completed_show_page(direction: String) -> void:
	current_page = pending_page
	match current_page:
		PageType.ROOM:
			# Show bottom bar for room
			if bottom_bar:
				bottom_bar.visible = true
			_restore_room_bottom_bar()
			if GameState.current_room:
				display_room(GameState.current_room)
		PageType.MENU:
			if GameState.current_room:
				display_menu()
		PageType.ENTITY:
			if current_entity:
				display_entity(current_entity)


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

	# Sepia ink colors matching aged manuscript
	var title_color := "#2a1f14"      # Dark sepia for titles
	var body_color := "#362816"       # Main body text
	var secondary_color := "#4a3828"  # NPCs, items
	var event_color := "#5a4838"      # Events (slightly lighter)
	var separator_color := "#8a7a6a"  # Decorative lines

	# Room title (centered, larger)
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, room.name]

	# Room description
	text += "[color=%s]%s[/color]\n\n" % [body_color, room.description]

	# Characters section (NPCs) - underline primary_keyword for clickability
	if room.npcs.size() > 0:
		var npc_texts: Array[String] = []
		for npc in room.npcs:
			# Use long_desc for room display (one-liner with keyword)
			var npc_text := npc.long_desc if npc.get("long_desc") and npc.long_desc != "" else "%s is here." % npc.name
			npc_text = npc_text.replace("\n", " ").replace("  ", " ")
			# Underline the primary keyword to indicate it's clickable
			var keyword: String = npc.get("primary_keyword") if npc.get("primary_keyword") else ""
			if keyword != "" and keyword in npc_text:
				npc_text = npc_text.replace(keyword, "[u]%s[/u]" % keyword)
			npc_texts.append(npc_text)
		text += "[color=%s]%s[/color]\n\n" % [secondary_color, " ".join(npc_texts)]

	# Items section - underline primary_keyword for clickability
	if room.items.size() > 0:
		var item_texts: Array[String] = []
		for item in room.items:
			# Use long_desc for room display (one-liner with keyword)
			var item_text := item.long_desc if item.get("long_desc") and item.long_desc != "" else "%s lies here." % item.name
			item_text = item_text.replace("\n", " ").replace("  ", " ")
			# Underline the primary keyword to indicate it's clickable
			var keyword: String = item.get("primary_keyword") if item.get("primary_keyword") else ""
			if keyword != "" and keyword in item_text:
				item_text = item_text.replace(keyword, "[u]%s[/u]" % keyword)
			item_texts.append(item_text)
		text += "[color=%s]%s[/color]\n\n" % [secondary_color, " ".join(item_texts)]

	# Event feed section with decorative separator
	if events.size() > 0:
		text += "[color=%s]───────────────────[/color]\n" % separator_color
		for event in events:
			text += "[color=%s][i]%s[/i][/color]\n" % [event_color, event["text"]]

	label.text = text


## Handle clicks on entity page (for action options)
func _handle_entity_content_click(vp_x: float, vp_y: float) -> void:
	if current_entity == null:
		return

	# Entity page layout - use simpler thirds-based detection
	# Top half: title, separator, description - no action
	# Bottom half: action links - divide into thirds for Talk/Look/Leave

	var content_height := float(VIEWPORT_HEIGHT)
	var action_zone_start := content_height * 0.35  # Actions start around 35% from top

	if vp_y < action_zone_start:
		return  # Clicked on title/description, no action

	# Divide remaining area into 4 zones (3 actions + buffer)
	var action_zone_height := (content_height - action_zone_start) / 4.0
	var action_index := int((vp_y - action_zone_start) / action_zone_height)

	match action_index:
		0:  # Talk
			_on_entity_talk_pressed()
		1:  # Look
			_on_entity_examine_pressed()
		2, 3:  # Leave (with tolerance)
			go_back_to_room()


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
			show_entity_details(room.npcs[0])
	else:
		# Item zone - select first item if available
		if room.items.size() > 0:
			show_entity_details(room.items[0])


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
	var separator_color := "#8a7a6a"

	# Entity name as title
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [title_color, entity.name]

	# Decorative separator
	text += "[color=%s][center]─────────────────[/center][/color]\n\n" % separator_color

	# Entity description (use 'description' field for detailed view)
	var desc: String = ""
	if entity.get("description") and entity.description != "":
		desc = entity.description
	elif entity.get("long_desc") and entity.long_desc != "":
		desc = entity.long_desc
	else:
		desc = entity.name
	# Normalize newlines to spaces for prose flow
	desc = desc.replace("\n", " ").replace("  ", " ")
	text += "[color=%s]%s[/color]\n\n" % [body_color, desc]

	# Action options - left aligned, underlined like prose links
	text += "\n"
	text += "[color=%s][u]Talk[/u][/color]\n\n" % action_color
	text += "[color=%s][u]Look[/u][/color]\n\n" % action_color
	text += "[color=%s][u]Leave[/u][/color]\n" % action_color

	label.text = text

	# Hide bottom bar on entity page
	if bottom_bar:
		bottom_bar.visible = false


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
func turn_page(direction: String = "right") -> void:
	if turn_tween and turn_tween.is_running():
		return  # Already animating

	var curl_dir := 1.0 if direction == "right" else -1.0
	shader_material.set_shader_parameter("curl_direction", curl_dir)

	page_turn_started.emit(direction)

	turn_tween = create_tween()
	turn_tween.set_ease(Tween.EASE_IN_OUT)
	turn_tween.set_trans(Tween.TRANS_SINE)

	# Curl up
	turn_tween.tween_property(self, "curl_progress", 1.0, TURN_DURATION * 0.5)
	# At midpoint, switch content
	turn_tween.tween_callback(_on_turn_completed_show_page.bind(direction))
	# Curl back down
	turn_tween.tween_property(self, "curl_progress", 0.0, TURN_DURATION * 0.5)

	turn_tween.finished.connect(func(): page_turn_completed.emit(direction), CONNECT_ONE_SHOT)


func _update_curl_shader() -> void:
	if shader_material and shader_material.shader:
		shader_material.set_shader_parameter("curl_amount", curl_progress * CURL_STRENGTH)


## Strip HTML tags from text
func _strip_html_tags(text: String) -> String:
	var regex := RegEx.new()
	regex.compile("<[^>]*>")
	return regex.sub(text, "", true)
