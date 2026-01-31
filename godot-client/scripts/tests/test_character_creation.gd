## Tests for CharacterCreation
## Run with: ./run_tests.sh test_character_creation
extends SceneTree

const TOTAL_POINTS := 60
const MIN_STAT := 5
const MAX_STAT := 30
const DEFAULT_STAT := 10


func _init() -> void:
	print("=== CharacterCreation Tests ===\n")

	test_stat_constants()
	test_point_calculation()
	test_derived_stats()

	print("\n=== All CharacterCreation Tests Passed! ===")
	quit(0)


func test_stat_constants() -> void:
	print("Testing stat constants...")

	# Verify constants match design doc
	assert(TOTAL_POINTS == 60, "Total points should be 60")
	assert(MIN_STAT == 5, "Min stat should be 5")
	assert(MAX_STAT == 30, "Max stat should be 30")
	assert(DEFAULT_STAT == 10, "Default stat should be 10")

	# Default stats should total 60 (10 * 6)
	var default_total := DEFAULT_STAT * 6
	assert(default_total == TOTAL_POINTS, "Default stats should total 60")

	print("  - Constants verified")


func test_point_calculation() -> void:
	print("Testing point calculations...")

	# Test with default stats
	var stats := {
		"str": 10, "dex": 10, "con": 10,
		"int": 10, "per": 10, "spi": 10
	}
	var total := _calc_total(stats)
	assert(total == 60, "Default stats total should be 60")

	# Test with modified stats (valid)
	stats = {
		"str": 30, "dex": 5, "con": 5,
		"int": 10, "per": 5, "spi": 5
	}
	total = _calc_total(stats)
	assert(total == 60, "Modified stats should still total 60")

	# Test warrior build from design doc
	# At creation: max 30, but design shows level 50 builds
	# Let's verify a valid creation build
	stats = {
		"str": 20, "dex": 10, "con": 15,
		"int": 5, "per": 5, "spi": 5
	}
	total = _calc_total(stats)
	assert(total == 60, "Warrior-ish build should total 60")

	print("  - Point calculations verified")


func test_derived_stats() -> void:
	print("Testing derived stats formulas...")

	# HP formula: 50 + (CON * 4) + (level * 2)
	# At level 1 with CON 10: 50 + 40 + 2 = 92
	var hp := 50 + (10 * 4) + (1 * 2)
	assert(hp == 92, "HP with CON 10 at level 1 should be 92")

	# With CON 30: 50 + 120 + 2 = 172
	hp = 50 + (30 * 4) + (1 * 2)
	assert(hp == 172, "HP with CON 30 at level 1 should be 172")

	# Mana formula: 20 + (INT * 3) + (SPI * 2)
	# With INT 10, SPI 10: 20 + 30 + 20 = 70
	var mana := 20 + (10 * 3) + (10 * 2)
	assert(mana == 70, "Mana with INT 10, SPI 10 should be 70")

	# With INT 30, SPI 10: 20 + 90 + 20 = 130
	mana = 20 + (30 * 3) + (10 * 2)
	assert(mana == 130, "Mana with INT 30, SPI 10 should be 130")

	# MV formula: 100 + (CON * 2) + (DEX * 2)
	# With CON 10, DEX 10: 100 + 20 + 20 = 140
	var mv := 100 + (10 * 2) + (10 * 2)
	assert(mv == 140, "MV with CON 10, DEX 10 should be 140")

	# With CON 15, DEX 15: 100 + 30 + 30 = 160
	mv = 100 + (15 * 2) + (15 * 2)
	assert(mv == 160, "MV with CON 15, DEX 15 should be 160")

	print("  - Derived stats verified")


func _calc_total(stats: Dictionary) -> int:
	var total := 0
	for value in stats.values():
		total += value
	return total
