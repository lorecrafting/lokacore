## Factory for creating page content viewports with parchment backgrounds.
## Creates SubViewport + parchment bg + RichTextLabel for use with PageFlip slots.
## Replaces PageMeshFactory's viewport creation for the 2D PageFlip system.
class_name PageContentManager
extends RefCounted

## SubViewport resolution (matches PageFlip target_page_size)
const VIEWPORT_WIDTH := 430
const VIEWPORT_HEIGHT := 932

## Universal page padding
const PAGE_PADDING_LEFT := 20
const PAGE_PADDING_RIGHT := 20
const PAGE_PADDING_TOP := 24
const PAGE_PADDING_BOTTOM := 10

## Bottom bar height (reserved space at bottom of content area)
const BOTTOM_BAR_HEIGHT := 120


# =============================================================================
# Page Content Container
# =============================================================================

## Encapsulates a page's viewport + content for injection into PageFlip slots
class PageContent extends RefCounted:
	var viewport: SubViewport
	var bg_container: Control          # Parchment background
	var text_container: Control        # Text content area
	var label: RichTextLabel           # BBCode text
	var bar: BottomBar                 # Navigation bar (compass + buttons)
	var meta_callback: Callable        # Link click handler


## Create a complete page content viewport with parchment background
func create_page_content(meta_click_callback: Callable, include_bottom_space: bool = true) -> PageContent:
	var page := PageContent.new()
	page.meta_callback = meta_click_callback

	# === VIEWPORT ===
	page.viewport = SubViewport.new()
	page.viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	page.viewport.transparent_bg = false
	page.viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

	# === PARCHMENT BACKGROUND ===
	page.bg_container = Control.new()
	page.bg_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.viewport.add_child(page.bg_container)

	# Base parchment color - warm aged tan
	var bg := ColorRect.new()
	bg.color = Color(0.878, 0.816, 0.706)  # Aged parchment tan #E0D0B4
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.bg_container.add_child(bg)

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
	page.bg_container.add_child(vignette)

	# === TEXT CONTENT ===
	var bottom_offset := BOTTOM_BAR_HEIGHT if include_bottom_space else 0
	page.text_container = Control.new()
	page.text_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.text_container.offset_bottom = -bottom_offset
	page.viewport.add_child(page.text_container)

	# RichTextLabel for BBCode text
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

	# Hide scrollbar but keep scroll functionality
	var scrollbar := page.label.get_v_scroll_bar()
	scrollbar.modulate = Color(1, 1, 1, 0)

	# Bottom bar (compass + menu/say buttons)
	if include_bottom_space:
		page.bar = BottomBar.new()
		page.viewport.add_child(page.bar)

	return page


## Create a static decorative parchment page (left page - no interactive content)
func create_decorative_page() -> SubViewport:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
	viewport.transparent_bg = false
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

	var bg := ColorRect.new()
	bg.color = Color(0.878, 0.816, 0.706)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	viewport.add_child(bg)

	# Vignette
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
	viewport.add_child(vignette)

	# Decorative text
	var title := RichTextLabel.new()
	title.bbcode_enabled = true
	title.fit_content = false
	title.scroll_active = false
	title.set_anchors_preset(Control.PRESET_FULL_RECT)
	title.offset_left = 40
	title.offset_right = -40
	title.offset_top = 60
	title.add_theme_font_size_override("normal_font_size", 18)
	title.add_theme_color_override("default_color", Color(0.4, 0.35, 0.28, 0.3))
	title.text = "[center][font_size=24][b]Loka[/b][/font_size]\n\n[i]A world of wonder awaits...[/i][/center]"
	viewport.add_child(title)

	return viewport
