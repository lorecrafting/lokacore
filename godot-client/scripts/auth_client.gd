## HTTP client for authentication with the Loka server.
## Handles guest login and token management.
## Used as autoload, so no class_name to avoid conflicts.
extends Node

## Emitted when login succeeds
signal login_success(player: Dictionary)

## Emitted when login fails
signal login_error(message: String)

## Emitted when auth state changes
signal auth_state_changed(is_authenticated: bool)

## Current JWT token (empty if not authenticated)
var token: String = ""

## Current player data
var player: Dictionary = {}

## Whether we're authenticated
var is_authenticated: bool = false

## Device ID (persisted for guest login)
var device_id: String = ""

## Storage keys
const DEVICE_ID_KEY := "loka_device_id"
const TOKEN_KEY := "loka_token"
const PLAYER_KEY := "loka_player"

## HTTP request node
var _http_request: HTTPRequest = null

## HTTP timeout in seconds (10s for mobile networks)
const HTTP_TIMEOUT_SECONDS := 10.0


func _ready() -> void:
	# Create HTTP request node
	_http_request = HTTPRequest.new()
	_http_request.timeout = HTTP_TIMEOUT_SECONDS
	add_child(_http_request)

	# Load or generate device ID
	_load_device_id()

	# Try to load saved auth
	_load_saved_auth()


## Perform guest login with a name
func guest_login(name: String) -> void:
	if name.strip_edges().is_empty():
		login_error.emit("Name cannot be empty")
		return

	var api_url := _get_api_url()
	var url := api_url + "/auth/guest"

	var body := JSON.stringify({
		"device_id": device_id,
		"name": name.strip_edges()
	})

	var headers := ["Content-Type: application/json"]

	print("[Auth] Logging in as guest: %s" % name)
	print("[Auth] URL: %s" % url)

	# Connect the request_completed signal
	if _http_request.request_completed.is_connected(_on_login_response):
		_http_request.request_completed.disconnect(_on_login_response)
	_http_request.request_completed.connect(_on_login_response)

	var error := _http_request.request(url, headers, HTTPClient.METHOD_POST, body)
	if error != OK:
		push_error("[Auth] Failed to send login request: %s" % error)
		login_error.emit("Failed to connect to server")


## Clear authentication and logout
func logout() -> void:
	token = ""
	player = {}
	is_authenticated = false

	# Clear saved data (but keep device_id)
	_save_config("token", "")
	_save_config("player", "")

	auth_state_changed.emit(false)
	print("[Auth] Logged out")


## Check if we have a saved valid token
func has_saved_auth() -> bool:
	return is_authenticated and token != ""


# =============================================================================
# Private: HTTP Response Handling
# =============================================================================

func _on_login_response(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	# Disconnect to avoid duplicate calls
	if _http_request.request_completed.is_connected(_on_login_response):
		_http_request.request_completed.disconnect(_on_login_response)

	if result != HTTPRequest.RESULT_SUCCESS:
		var error_msg := _get_http_error_message(result)
		push_error("[Auth] HTTP request failed: result=%s (%s)" % [result, error_msg])
		login_error.emit(error_msg)
		return

	var response_text := body.get_string_from_utf8()
	print("[Auth] Response code: %s" % response_code)
	print("[Auth] Response body: %s" % response_text)

	if response_code != 200:
		var error_msg := "Login failed (HTTP %s)" % response_code

		# Try to parse error message from response
		var json = JSON.parse_string(response_text)
		if json is Dictionary and json.has("error"):
			error_msg = json["error"]

		login_error.emit(error_msg)
		return

	# Parse success response
	var json = JSON.parse_string(response_text)
	if not json is Dictionary:
		login_error.emit("Invalid server response")
		return

	# Extract token and player data
	token = json.get("token", "")
	player = json.get("player", {})

	if token == "":
		login_error.emit("No token received")
		return

	is_authenticated = true

	# Save auth data
	_save_config("token", token)
	_save_config("player", JSON.stringify(player))

	print("[Auth] Login successful! Player: %s" % player)

	login_success.emit(player)
	auth_state_changed.emit(true)


# =============================================================================
# Private: URL Configuration
# =============================================================================

func _get_api_url() -> String:
	# Check for environment override
	if OS.has_environment("LOKA_API_URL"):
		return OS.get_environment("LOKA_API_URL")

	# Development builds
	if OS.is_debug_build():
		# Mobile devices need Tailscale IP to reach dev server
		if OS.has_feature("mobile") or OS.has_feature("ios") or OS.has_feature("android"):
			return "http://100.69.21.60:4000/api/v1"
		# Desktop/web can use localhost
		return "http://localhost:4000/api/v1"

	# Production
	return "https://loka.fly.dev/api/v1"


# =============================================================================
# Private: Device ID & Config Persistence
# =============================================================================

func _load_device_id() -> void:
	# Try to load existing device ID
	device_id = _load_config("device_id")

	if device_id == "":
		# Generate new UUID v4
		device_id = _generate_uuid()
		_save_config("device_id", device_id)
		print("[Auth] Generated new device ID: %s" % device_id)
	else:
		print("[Auth] Loaded device ID: %s" % device_id)


func _load_saved_auth() -> void:
	token = _load_config("token")
	var player_json := _load_config("player")

	if player_json != "":
		var parsed = JSON.parse_string(player_json)
		if parsed is Dictionary:
			player = parsed

	if token != "":
		is_authenticated = true
		print("[Auth] Loaded saved auth for player: %s" % player.get("name", "Unknown"))


func _generate_uuid() -> String:
	# Generate UUID v4
	var chars := "0123456789abcdef"
	var uuid := ""

	for i in range(36):
		if i == 8 or i == 13 or i == 18 or i == 23:
			uuid += "-"
		elif i == 14:
			uuid += "4"  # Version 4
		elif i == 19:
			uuid += chars[randi() % 4 + 8]  # 8, 9, a, or b
		else:
			uuid += chars[randi() % 16]

	return uuid


func _get_config_path() -> String:
	return "user://auth_config.cfg"


func _load_config(key: String) -> String:
	var config := ConfigFile.new()
	var err := config.load(_get_config_path())
	if err != OK:
		return ""
	return config.get_value("auth", key, "")


func _save_config(key: String, value: String) -> void:
	var config := ConfigFile.new()
	# Load existing config first
	config.load(_get_config_path())
	config.set_value("auth", key, value)
	config.save(_get_config_path())


func _get_http_error_message(result: int) -> String:
	match result:
		HTTPRequest.RESULT_CANT_CONNECT:
			return "Cannot connect to server"
		HTTPRequest.RESULT_CANT_RESOLVE:
			return "Cannot resolve server address"
		HTTPRequest.RESULT_CONNECTION_ERROR:
			return "Connection error"
		HTTPRequest.RESULT_TLS_HANDSHAKE_ERROR:
			return "Secure connection failed"
		HTTPRequest.RESULT_NO_RESPONSE:
			return "No response from server"
		HTTPRequest.RESULT_BODY_SIZE_LIMIT_EXCEEDED:
			return "Response too large"
		HTTPRequest.RESULT_BODY_DECOMPRESS_FAILED:
			return "Failed to decompress response"
		HTTPRequest.RESULT_REQUEST_FAILED:
			return "Request failed"
		HTTPRequest.RESULT_DOWNLOAD_FILE_CANT_OPEN:
			return "Cannot save file"
		HTTPRequest.RESULT_DOWNLOAD_FILE_WRITE_ERROR:
			return "Cannot write file"
		HTTPRequest.RESULT_REDIRECT_LIMIT_REACHED:
			return "Too many redirects"
		HTTPRequest.RESULT_TIMEOUT:
			return "Connection timed out - please check your network"
		_:
			return "Connection failed"
