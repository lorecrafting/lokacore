## Manages text effects (burn, ice, glow, fade) and atmosphere tinting.
## Controls shader uniforms, tween animations, and particle systems.
## Applied as a ColorRect overlay inside the page SubViewport.
class_name EffectsController
extends Node

## Text effects (matching shader uniforms)
enum TextEffect { NONE = 0, BURN = 1, ICE = 2, GLOW = 3, FADE = 4 }

## Animation settings
const EFFECT_DURATION := 2.0

## Atmosphere mood tint colors
const MOOD_TINTS := {
	"peaceful": Color(1.0, 1.0, 1.0, 1.0),
	"tense": Color(1.0, 0.95, 0.9, 1.0),
	"danger": Color(1.0, 0.9, 0.85, 1.0),
	"night": Color(0.85, 0.88, 1.0, 1.0),
	"storm": Color(0.9, 0.9, 0.95, 1.0),
	"mystical": Color(0.95, 0.9, 1.0, 1.0),
	"holy": Color(1.0, 1.0, 0.95, 1.0),
}

## Current state
var current_effect: TextEffect = TextEffect.NONE
var effect_progress: float = 0.0:
	set(value):
		effect_progress = clampf(value, 0.0, 1.0)
		_update_shader()

var current_atmosphere: String = "peaceful"

## Internal
var _effect_tween: Tween
var _shader_material: ShaderMaterial
var _effect_overlay: ColorRect
var _burn_particles: GPUParticles2D
var _ice_particles: GPUParticles2D


## Initialize the effects system with a target viewport
func setup(viewport: SubViewport) -> void:
	# Create the effect overlay ColorRect inside the viewport
	_effect_overlay = ColorRect.new()
	_effect_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_effect_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Create shader material
	_shader_material = ShaderMaterial.new()
	var shader := load("res://shaders/page_effects.gdshader")
	if shader:
		_shader_material.shader = shader
		_shader_material.set_shader_parameter("effect_type", 0)
		_shader_material.set_shader_parameter("effect_progress", 0.0)
		_shader_material.set_shader_parameter("atmosphere_tint", Color(1.0, 1.0, 1.0, 1.0))
		_effect_overlay.material = _shader_material

	viewport.add_child(_effect_overlay)

	# Create particle systems (children of this node, positioned over the book)
	_setup_burn_particles()
	_setup_ice_particles()


func _setup_burn_particles() -> void:
	_burn_particles = GPUParticles2D.new()
	_burn_particles.emitting = false
	_burn_particles.amount = 30
	_burn_particles.lifetime = 1.5
	_burn_particles.explosiveness = 0.0
	_burn_particles.randomness = 0.8
	_burn_particles.visibility_rect = Rect2(-250, -500, 500, 1000)

	var material := ParticleProcessMaterial.new()
	material.direction = Vector3(0, -1, 0)
	material.spread = 45.0
	material.initial_velocity_min = 20.0
	material.initial_velocity_max = 60.0
	material.gravity = Vector3(0, -30, 0)
	material.scale_min = 1.0
	material.scale_max = 3.0
	material.color = Color(1.0, 0.5, 0.1, 0.8)
	material.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	material.emission_box_extents = Vector3(200, 400, 0)
	_burn_particles.process_material = material

	add_child(_burn_particles)


func _setup_ice_particles() -> void:
	_ice_particles = GPUParticles2D.new()
	_ice_particles.emitting = false
	_ice_particles.amount = 20
	_ice_particles.lifetime = 2.0
	_ice_particles.explosiveness = 0.0
	_ice_particles.randomness = 0.9
	_ice_particles.visibility_rect = Rect2(-250, -500, 500, 1000)

	var material := ParticleProcessMaterial.new()
	material.direction = Vector3(0, 1, 0)
	material.spread = 60.0
	material.initial_velocity_min = 10.0
	material.initial_velocity_max = 30.0
	material.gravity = Vector3(0, 5, 0)
	material.scale_min = 2.0
	material.scale_max = 5.0
	material.color = Color(0.7, 0.85, 1.0, 0.6)
	material.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	material.emission_box_extents = Vector3(200, 400, 0)
	_ice_particles.process_material = material

	add_child(_ice_particles)


## Start a text effect with tween animation
func start_effect(effect: TextEffect) -> void:
	if _effect_tween and _effect_tween.is_running():
		_effect_tween.kill()

	current_effect = effect
	if _shader_material:
		_shader_material.set_shader_parameter("effect_type", int(effect))

	# Start particles
	match effect:
		TextEffect.BURN:
			_burn_particles.emitting = true
			_ice_particles.emitting = false
		TextEffect.ICE:
			_ice_particles.emitting = true
			_burn_particles.emitting = false
		_:
			_burn_particles.emitting = false
			_ice_particles.emitting = false

	_effect_tween = create_tween()
	_effect_tween.set_ease(Tween.EASE_IN_OUT)
	_effect_tween.set_trans(Tween.TRANS_QUAD)
	_effect_tween.tween_property(self, "effect_progress", 1.0, EFFECT_DURATION)

	print("Started effect: ", TextEffect.keys()[effect])


## Stop current effect with fade-out
func stop_effect() -> void:
	if _effect_tween and _effect_tween.is_running():
		_effect_tween.kill()

	_burn_particles.emitting = false
	_ice_particles.emitting = false

	_effect_tween = create_tween()
	_effect_tween.tween_property(self, "effect_progress", 0.0, 0.3)
	_effect_tween.tween_callback(func():
		current_effect = TextEffect.NONE
		if _shader_material:
			_shader_material.set_shader_parameter("effect_type", 0)
	)


## Set atmosphere tint by mood name
func set_atmosphere(mood: String) -> void:
	current_atmosphere = mood
	var tint: Color = MOOD_TINTS.get(mood, Color(1.0, 1.0, 1.0, 1.0))
	if _shader_material:
		_shader_material.set_shader_parameter("atmosphere_tint", tint)
	print("[Effects] Atmosphere changed to: %s" % mood)


func _update_shader() -> void:
	if _shader_material:
		_shader_material.set_shader_parameter("effect_progress", effect_progress)
