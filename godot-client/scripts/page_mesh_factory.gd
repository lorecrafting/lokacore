## Factory for creating page mesh objects with viewports, materials, and UI.
## Extracted from book_page.gd for separation of concerns.
class_name PageMeshFactory
extends RefCounted

## Page mesh dimensions (iPhone Pro aspect ratio ~9:19.5)
const PAGE_WIDTH := 1.8
const PAGE_HEIGHT := 3.9

## SubViewport resolution for text rendering (iPhone 17 Pro scale)
const VIEWPORT_WIDTH := 430
const VIEWPORT_HEIGHT := 932

## Bottom bar dimensions (inside viewport)
const BOTTOM_BAR_HEIGHT := 120
const BUTTON_SIZE := 70

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


## Signal emitter reference for bottom bar button callbacks
var _bottom_bar_signal_target: Object = null
var _bottom_bar_signal_name: String = ""


## Set the target for bottom bar button signals
func set_bottom_bar_signal(target: Object, signal_name: String) -> void:
	_bottom_bar_signal_target = target
	_bottom_bar_signal_name = signal_name


## Create a complete page mesh with viewports
func create_page_mesh(z_offset: float, meta_click_callback: Callable) -> PageMesh:
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
	page.label.meta_clicked.connect(meta_click_callback)
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
func apply_page_textures(page: PageMesh, tree: SceneTree) -> void:
	await tree.process_frame

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
	var menu_btn := _create_bar_button("Menu", "menu")
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
	var say_btn := _create_bar_button("Say", "say")
	hbox.add_child(say_btn)

	return bar


func _create_bar_button(icon: String, action: String) -> Button:
	var btn := Button.new()
	btn.text = icon
	btn.custom_minimum_size = Vector2(BUTTON_SIZE, BUTTON_SIZE)
	btn.add_theme_font_size_override("font_size", 24)
	btn.pressed.connect(func(): _emit_bottom_bar_signal(action))
	return btn


func _create_compass() -> VBoxContainer:
	var compass := VBoxContainer.new()
	compass.alignment = BoxContainer.ALIGNMENT_CENTER

	# North
	var north_btn := Button.new()
	north_btn.text = "^"
	north_btn.name = "NorthBtn"
	north_btn.custom_minimum_size = Vector2(40, 28)
	north_btn.add_theme_font_size_override("font_size", 18)
	north_btn.pressed.connect(func(): _emit_bottom_bar_signal("north"))
	compass.add_child(north_btn)

	# Middle row (West . East)
	var mid_row := HBoxContainer.new()
	mid_row.alignment = BoxContainer.ALIGNMENT_CENTER

	var west_btn := Button.new()
	west_btn.text = "<"
	west_btn.name = "WestBtn"
	west_btn.custom_minimum_size = Vector2(40, 28)
	west_btn.add_theme_font_size_override("font_size", 18)
	west_btn.pressed.connect(func(): _emit_bottom_bar_signal("west"))
	mid_row.add_child(west_btn)

	var dot := Label.new()
	dot.text = "."
	dot.custom_minimum_size = Vector2(24, 0)
	dot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid_row.add_child(dot)

	var east_btn := Button.new()
	east_btn.text = ">"
	east_btn.name = "EastBtn"
	east_btn.custom_minimum_size = Vector2(40, 28)
	east_btn.add_theme_font_size_override("font_size", 18)
	east_btn.pressed.connect(func(): _emit_bottom_bar_signal("east"))
	mid_row.add_child(east_btn)

	compass.add_child(mid_row)

	# South
	var south_btn := Button.new()
	south_btn.text = "v"
	south_btn.name = "SouthBtn"
	south_btn.custom_minimum_size = Vector2(40, 28)
	south_btn.add_theme_font_size_override("font_size", 18)
	south_btn.pressed.connect(func(): _emit_bottom_bar_signal("south"))
	compass.add_child(south_btn)

	return compass


func _emit_bottom_bar_signal(action: String) -> void:
	if _bottom_bar_signal_target and _bottom_bar_signal_name != "":
		_bottom_bar_signal_target.emit_signal(_bottom_bar_signal_name, action)
