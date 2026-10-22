# Retire Ashmere phase 2, L1 (loka-4hik.5): sampler id and path renames. Run once over a file:
#   sed -E -i '' -f docs/briefs/retire-ashmere-2/rename.sed <files>
# Idempotent (no new name contains ashmere_). ashmere_missing_child is not renamed.
# Titles are not mapped here (three samplers share one); they changed per manifest.
# Directory moves: git mv cartridges/ashmere_<old> cartridges/<new> for each line.
s/ashmere_hello([^A-Za-z0-9_]|$)/hello_sampler\1/g
s/ashmere_rooms([^A-Za-z0-9_]|$)/rooms_sampler\1/g
s/ashmere_details([^A-Za-z0-9_]|$)/details_sampler\1/g
s/ashmere_facts([^A-Za-z0-9_]|$)/facts_sampler\1/g
s/ashmere_bell([^A-Za-z0-9_]|$)/recipe_sampler\1/g
s/ashmere_dusk([^A-Za-z0-9_]|$)/check_sampler\1/g
s/ashmere_road([^A-Za-z0-9_]|$)/resource_sampler\1/g
s/ashmere_rest([^A-Za-z0-9_]|$)/position_sampler\1/g
s/ashmere_gate([^A-Za-z0-9_]|$)/gate_sampler\1/g
s/ashmere_locks([^A-Za-z0-9_]|$)/locks_sampler\1/g
s/ashmere_items([^A-Za-z0-9_]|$)/items_sampler\1/g
s/ashmere_wear([^A-Za-z0-9_]|$)/wear_sampler\1/g
s/ashmere_errand([^A-Za-z0-9_]|$)/errand_sampler\1/g
s/ashmere_journal([^A-Za-z0-9_]|$)/journal_sampler\1/g
s/ashmere_ferry([^A-Za-z0-9_]|$)/ferry_sampler\1/g
s/ashmere_green([^A-Za-z0-9_]|$)/green_sampler\1/g
s/ashmere_scene([^A-Za-z0-9_]|$)/scene_sampler\1/g
s/ashmere_chapters([^A-Za-z0-9_]|$)/chapters_sampler\1/g
s/ashmere_sampler([^A-Za-z0-9_]|$)/cellar_sampler\1/g
