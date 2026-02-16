## Unit tests for PhoenixClient signal definitions
## Run with: godot --headless --script res://scripts/tests/test_phoenix_client.gd
extends SceneTree

const PhoenixScript = preload("res://scripts/phoenix_client.gd")


func _init() -> void:
	print("=== PhoenixClient Unit Tests ===\n")

	var passed := 0
	var failed := 0

	var results := [
		test_connection_signals_exist(),
		test_game_state_signals_exist(),
		test_combat_signals_exist(),
		test_dialogue_signals_exist(),
		test_character_state_signals_exist(),
		test_shop_container_signals_exist(),
		test_ghost_signals_exist(),
		test_quest_signals_exist(),
		test_environment_signals_exist(),
	]

	for result in results:
		if result:
			passed += 1
		else:
			failed += 1

	print("\n=== Results ===")
	print("Passed: %d" % passed)
	print("Failed: %d" % failed)
	print("Total: %d" % (passed + failed))

	if failed > 0:
		print("\n[FAIL] Some tests failed!")
		quit(1)
	else:
		print("\n[PASS] All tests passed!")
		quit(0)


func test_connection_signals_exist() -> bool:
	print("[TEST] Connection signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["connected", "disconnected", "connection_error"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All connection signals exist")
	return true


func test_game_state_signals_exist() -> bool:
	print("[TEST] Game state signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["game_state_received", "room_updated", "event_received", "entity_context_received"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All game state signals exist")
	return true


func test_combat_signals_exist() -> bool:
	print("[TEST] Combat signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["combat_started", "combat_updated", "combat_ended"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All combat signals exist")
	return true


func test_dialogue_signals_exist() -> bool:
	print("[TEST] Dialogue signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["dialogue_started", "dialogue_updated", "dialogue_ended"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All dialogue signals exist")
	return true


func test_character_state_signals_exist() -> bool:
	print("[TEST] Character state signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["inventory_updated", "equipment_updated", "stats_updated", "resources_updated", "players_updated"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All character state signals exist")
	return true


func test_shop_container_signals_exist() -> bool:
	print("[TEST] Shop/Container signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["shop_opened", "shop_closed", "container_opened", "container_updated", "container_closed"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All shop/container signals exist")
	return true


func test_ghost_signals_exist() -> bool:
	print("[TEST] Ghost signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["ghost_entered", "ghost_exited"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All ghost signals exist")
	return true


func test_quest_signals_exist() -> bool:
	print("[TEST] Quest signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["quest_accepted", "quest_completed", "quest_progress"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All quest signals exist")
	return true


func test_environment_signals_exist() -> bool:
	print("[TEST] Environment signals exist")

	var phoenix = PhoenixScript.new()
	var signals := ["atmosphere_updated", "timer_completed", "force_disconnected"]

	for sig in signals:
		if not phoenix.has_signal(sig):
			print("  [FAIL] Missing signal: %s" % sig)
			phoenix.free()
			return false

	phoenix.free()
	print("  [PASS] All environment signals exist")
	return true
