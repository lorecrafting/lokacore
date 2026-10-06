"""One-at-a-time D7 schema mutation against the literal deer wire tests.

Run from the repository root with: mise exec -- python3 docs/evidence/2026-10-06-d7-deer-provisional/schema-sweep.py
Always restores source schemas and generated TypeScript, including on failure.
"""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
paths = {name: root / f"protocol/{name}.schema.json" for name in ("cartridge", "delta", "relation")}
generated = root / "kernel/ts/src/contracts.gen.ts"
original = {name: path.read_bytes() for name, path in paths.items()}
old_generated = generated.read_bytes()


def branch(document, op):
    return next(row for row in document["$defs"]["DeltaOp"]["oneOf"]
                if row["properties"]["op"]["const"] == op)


def plan(d):
    return d["cartridge"]["$defs"]["PopulationPlan"]["properties"]["sight"]


def sight(d):
    return branch(d["delta"], "job.schedule")["properties"]["sight"]


def drop_required(row, field):
    row["required"].remove(field)


mutants = []
def add(label, edit):
    mutants.append((label, edit))

for field in ("delay", "narration"):
    add(f"plan.sight required {field}", lambda d, f=field: drop_required(plan(d), f))
add("plan.sight delay minimum", lambda d: plan(d)["properties"]["delay"].pop("minimum"))
add("plan.sight narration direction pattern", lambda d: plan(d)["properties"]["narration"].pop("propertyNames"))
add("plan.sight narration TextKey", lambda d: plan(d)["properties"]["narration"].update({"additionalProperties": {"type": "string"}}))
add("plan.sight closed shape", lambda d: plan(d).pop("additionalProperties"))
add("plan.sight declaration", lambda d: d["cartridge"]["$defs"]["PopulationPlan"]["properties"].pop("sight"))
for role, value in (("member_role", "deer"), ("loot_role", "hide")):
    add(f"bundle {role} {value}", lambda d, r=role, v=value:
        d["cartridge"]["$defs"]["PopulationBundle"]["properties"][r]["enum"].remove(v))
for field in ("member_id", "player_id", "slot", "generation", "seen_at", "cause_kind",
              "cause_id", "source_id", "destination_id"):
    add(f"job.schedule sight required {field}", lambda d, f=field: drop_required(sight(d), f))
for field, bound in (("slot", "minimum"), ("slot", "maximum"),
                     ("generation", "minimum"), ("seen_at", "minimum")):
    add(f"job.schedule sight {field} {bound}",
        lambda d, f=field, b=bound: sight(d)["properties"][f].pop(b))
add("job.schedule sight cause enum", lambda d: sight(d)["properties"].update({"cause_kind": {"type": "string"}}))
add("job.schedule sight closed shape", lambda d: sight(d).pop("additionalProperties"))
add("job.schedule sight declaration", lambda d: branch(d["delta"], "job.schedule")["properties"].pop("sight"))
add("job.cancel sight alternative", lambda d: branch(d["delta"], "job.cancel").pop("requiredUnless"))
add("job.cancel sight member property", lambda d: branch(d["delta"], "job.cancel")["properties"].update({"sight_member_id": {"type": "string"}}))
for role in ("deer", "hide"):
    add(f"origin role {role}", lambda d, r=role: d["relation"]["$defs"]["EntityOrigin"]["oneOf"][1]["properties"]["role"]["enum"].remove(r))
add("slot sight binding property", lambda d: d["relation"]["$defs"]["PopulationSlot"]["properties"].pop("sight_job_id"))
add("slot sight binding JobId", lambda d: d["relation"]["$defs"]["PopulationSlot"]["properties"]["sight_job_id"].update({"anyOf": [{"type": "string"}, {"type": "null"}]}))

survivors = []
schema_rejected = []
try:
    for label, edit in mutants:
        docs = {name: json.loads(value) for name, value in original.items()}
        edit(docs)
        for name, path in paths.items():
            path.write_text(json.dumps(docs[name], ensure_ascii=False, separators=(",", ":")) + "\n")
        generated_result = subprocess.run(["mise", "exec", "--", "elixir", "bin/contracts.exs"],
                                          cwd=root, capture_output=True)
        if generated_result.returncode:
            print(f"SCHEMA REJECTED: {label}")
            schema_rejected.append(label)
        else:
            run = subprocess.run(["mise", "exec", "--", "node", "--test",
                                  "kernel/ts/test/deer_contracts.test.ts"],
                                 cwd=root, capture_output=True)
            if run.returncode:
                print(f"RED: {label}")
            else:
                print(f"SURVIVED: {label}")
                survivors.append(label)
        for name, path in paths.items():
            path.write_bytes(original[name])
        generated.write_bytes(old_generated)
finally:
    for name, path in paths.items():
        path.write_bytes(original[name])
    generated.write_bytes(old_generated)
print(f"Mutants: {len(mutants)}; fixture red: {len(mutants) - len(survivors) - len(schema_rejected)}; schema rejected: {len(schema_rejected)}; survived: {len(survivors)}")
raise SystemExit(bool(survivors))
