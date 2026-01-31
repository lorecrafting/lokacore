## Tests for SpellBook
## Run with: ./run_tests.sh test_spell_book
extends SceneTree


func _init() -> void:
	print("=== SpellBook Tests ===\n")

	test_stratum_constants()
	test_word_type_enum()
	test_stratum_calculation()
	test_mantra_building()

	print("\n=== All SpellBook Tests Passed! ===")
	quit(0)


func test_stratum_constants() -> void:
	print("Testing stratum constants...")

	# Verify stratum INT requirements match server
	assert(SpellBook.STRATUM_INT[1] == 30, "First stratum should require INT 30")
	assert(SpellBook.STRATUM_INT[2] == 50, "Second stratum should require INT 50")
	assert(SpellBook.STRATUM_INT[3] == 70, "Third stratum should require INT 70")

	# Quick slot count
	assert(SpellBook.QUICK_SLOT_COUNT == 5, "Should have 5 quick slots")

	print("  - Stratum constants verified")


func test_word_type_enum() -> void:
	print("Testing word type enum...")

	# Verify enum values exist
	assert(SpellBook.WordType.RUPA == 0, "RUPA should be 0")
	assert(SpellBook.WordType.TATTVA == 1, "TATTVA should be 1")
	assert(SpellBook.WordType.GUNA == 2, "GUNA should be 2")

	# Verify labels exist
	assert(SpellBook.TYPE_LABELS[SpellBook.WordType.RUPA] == "RUPA (Form)", "RUPA label correct")
	assert(SpellBook.TYPE_LABELS[SpellBook.WordType.TATTVA] == "TATTVA (Element)", "TATTVA label correct")
	assert(SpellBook.TYPE_LABELS[SpellBook.WordType.GUNA] == "GUNA (Modifier)", "GUNA label correct")

	print("  - Word type enum verified")


func test_stratum_calculation() -> void:
	print("Testing stratum calculation...")

	# Create a test instance
	var spellbook := SpellBook.new()

	# Test _get_max_stratum at various INT levels
	assert(spellbook._get_max_stratum(10) == 0, "INT 10 should give stratum 0")
	assert(spellbook._get_max_stratum(29) == 0, "INT 29 should give stratum 0")
	assert(spellbook._get_max_stratum(30) == 1, "INT 30 should give stratum 1")
	assert(spellbook._get_max_stratum(49) == 1, "INT 49 should give stratum 1")
	assert(spellbook._get_max_stratum(50) == 2, "INT 50 should give stratum 2")
	assert(spellbook._get_max_stratum(69) == 2, "INT 69 should give stratum 2")
	assert(spellbook._get_max_stratum(70) == 3, "INT 70 should give stratum 3")
	assert(spellbook._get_max_stratum(100) == 3, "INT 100 should give stratum 3")

	spellbook.queue_free()
	print("  - Stratum calculation verified")


func test_mantra_building() -> void:
	print("Testing mantra building logic...")

	# Test word type parsing
	var spellbook := SpellBook.new()

	assert(spellbook._parse_word_type("rupa") == SpellBook.WordType.RUPA, "Should parse rupa")
	assert(spellbook._parse_word_type("RUPA") == SpellBook.WordType.RUPA, "Should parse RUPA")
	assert(spellbook._parse_word_type("tattva") == SpellBook.WordType.TATTVA, "Should parse tattva")
	assert(spellbook._parse_word_type("guna") == SpellBook.WordType.GUNA, "Should parse guna")
	assert(spellbook._parse_word_type("invalid") == -1, "Should return -1 for invalid")

	spellbook.queue_free()
	print("  - Mantra building logic verified")
