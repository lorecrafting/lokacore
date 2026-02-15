# Entity System Benchmarks
#
# Run with: mix run test/bench/entity_benchmark.exs
#
# These benchmarks measure the performance of core entity operations
# to ensure they meet performance requirements and to detect regressions.

alias Loka.Engine.Entity
alias Loka.Engine.Entities
alias Loka.Engine.Spawner

# In V2, prototypes are seeded as entities in the database via EntitySeeder

IO.puts("\n=== Entity System Benchmarks ===\n")

# Create some test entities for benchmarking
{:ok, test_item} = Spawner.spawn("healing_salve", [])
{:ok, test_npc} = Spawner.spawn("novice_monk", [])

# Pre-create entity structs for in-memory operations
sample_entity = %Entity{
  id: Ecto.UUID.generate(),
  key: "test_entity",
  type: :item,
  name: "Test Entity",
  description: "A test entity for benchmarking",
  tags: ["item", "consumable", "healing"],
  components: %{
    "healable" => %{"amount" => 10},
    "stackable" => %{"max" => 5},
    "value" => %{"gold" => 25}
  },
  location_id: nil,
  dirty?: false
}

large_entity = %Entity{
  id: Ecto.UUID.generate(),
  key: "large_entity",
  type: :npc,
  name: "Large Entity",
  description: String.duplicate("A very long description. ", 100),
  tags: Enum.map(1..50, &"tag_#{&1}"),
  components:
    Map.new(1..20, fn i ->
      {"component_#{i}", %{"value" => i, "nested" => %{"deep" => i * 2}}}
    end),
  location_id: nil,
  dirty?: false
}

# =============================================================================
# In-Memory Entity Operations
# =============================================================================

IO.puts("--- In-Memory Entity Operations ---\n")

Benchee.run(
  %{
    "Entity.has_tag? (hit)" => fn -> Entity.has_tag?(sample_entity, "healing") end,
    "Entity.has_tag? (miss)" => fn -> Entity.has_tag?(sample_entity, "nonexistent") end,
    "Entity.has_tag? (large entity)" => fn -> Entity.has_tag?(large_entity, "tag_25") end,
    "Entity.get_component (hit)" => fn -> Entity.get_component(sample_entity, "healable") end,
    "Entity.get_component (miss)" => fn -> Entity.get_component(sample_entity, "nonexistent") end,
    "Entity.get_component (large entity)" => fn ->
      Entity.get_component(large_entity, "component_10")
    end,
    "Entity.put_component (new)" => fn -> Entity.put_component(sample_entity, "new", %{a: 1}) end,
    "Entity.put_component (update)" => fn ->
      Entity.put_component(sample_entity, "healable", %{"amount" => 20})
    end,
    "Entity.add_tag (new)" => fn -> Entity.add_tag(sample_entity, "new_tag") end,
    "Entity.add_tag (duplicate)" => fn -> Entity.add_tag(sample_entity, "healing") end,
    "Entity.remove_tag" => fn -> Entity.remove_tag(sample_entity, "healing") end
  },
  warmup: 1,
  time: 3,
  memory_time: 1,
  formatters: [Benchee.Formatters.Console]
)

# =============================================================================
# Database Entity Operations
# =============================================================================

IO.puts("\n--- Database Entity Operations ---\n")

Benchee.run(
  %{
    "Entities.get_entity (existing)" => fn -> Entities.get_entity(test_item.id) end,
    "Entities.get_entity (nonexistent)" => fn ->
      Entities.get_entity(Ecto.UUID.generate())
    end,
    "Entities.get_entities_in_room (empty room)" => fn ->
      Entities.get_entities_in_room(Ecto.UUID.generate())
    end,
    "Entities.update_entity (component change)" => fn ->
      {:ok, entity} = Entities.get_entity(test_item.id)

      Entities.update_entity(entity, %{
        components: Map.put(entity.components, "bench_test", %{"time" => System.system_time()})
      })
    end
  },
  warmup: 1,
  time: 3,
  memory_time: 1,
  formatters: [Benchee.Formatters.Console]
)

# =============================================================================
# Entity Spawning
# =============================================================================

IO.puts("\n--- Entity Spawning ---\n")

Benchee.run(
  %{
    "Spawner.spawn (simple item)" => fn ->
      {:ok, entity} = Spawner.spawn("healing_salve", [])
      # Clean up
      Entities.delete_entity(entity)
    end,
    "Spawner.spawn (complex NPC)" => fn ->
      {:ok, entity} = Spawner.spawn("novice_monk", [])
      # Clean up
      Entities.delete_entity(entity)
    end
  },
  warmup: 1,
  time: 5,
  memory_time: 1,
  formatters: [Benchee.Formatters.Console]
)

# Cleanup test entities
Entities.delete_entity(test_item)
Entities.delete_entity(test_npc)

IO.puts("\n=== Benchmarks Complete ===\n")
