# Elixir Query Function Signatures with Atom Arguments

## Trigger

Use this skill when:
1. Creating Ecto query functions that can be called standalone OR chained
2. Function arguments can be atoms (like `:room`, `:npc`) that might conflict with module atoms
3. Getting unexpected query behavior where module names appear as values

## Problem

When creating query functions with default arguments like:

```elixir
# BAD: Ambiguous when chaining
def by_entity(query \\ __MODULE__, entity_type, entity_key \\ nil)
```

Calling `AuditLog |> AuditLog.by_entity(:room)` can fail because:
- `AuditLog` (the module) is an atom
- `:room` is also an atom
- Simple `is_atom` guards can't distinguish between them

## Solution

Use explicit lists of allowed atoms in guards:

```elixir
@entity_type_atoms [:room, :npc, :item, :quest, :dialogue, :script]

# 1-arity: standalone with just entity type
def by_entity(entity_type) when entity_type in @entity_type_atoms do
  by_entity(__MODULE__, entity_type, nil)
end

# 2-arity: standalone with entity type and key
def by_entity(entity_type, entity_key)
    when entity_type in @entity_type_atoms and is_binary(entity_key) do
  by_entity(__MODULE__, entity_type, entity_key)
end

# 2-arity: chained with query and entity type
def by_entity(query, entity_type) when entity_type in @entity_type_atoms do
  by_entity(query, entity_type, nil)
end

# 3-arity: full implementation
def by_entity(query, entity_type, entity_key) do
  entity_type_str = to_string(entity_type)
  query = from(a in query, where: a.entity_type == ^entity_type_str)
  if entity_key, do: from(a in query, where: a.entity_key == ^entity_key), else: query
end
```

## Key Insight

The guard `entity_type in @entity_type_atoms` ensures that:
- `:room` matches (it's in the list)
- `AuditLog` (the module) does NOT match (not in the list)

This disambiguates the 2-arity clauses correctly.

## Similar Pattern for Integer Arguments

```elixir
# For functions like `recent(limit)` vs `recent(query, limit)`
def recent do
  recent(__MODULE__, 100)
end

def recent(limit) when is_integer(limit) do
  recent(__MODULE__, limit)
end

def recent(query, limit) when is_integer(limit) do
  from(a in query, order_by: [desc: a.inserted_at], limit: ^limit)
end
```

## Files

- Pattern discovered in: `lib/loka/admin/audit_log.ex`
- Tests demonstrating usage: `test/loka/admin/audit_log_test.exs`
