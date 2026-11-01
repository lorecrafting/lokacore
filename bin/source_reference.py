#!/usr/bin/env python3
"""docs/reference/source-kinds.gen.md and vocabulary.gen.md from schemas/source/; a meaning is a
description in protocol/*.schema.json. Scenes only link the guide. Usage: [--check] [schema_dir out_dir]"""
import json, os, re, sys

GUIDE = "[Writing the game](../guides/writing-the-game.md)"
VOCAB = {"Step": "steps", "Policy": "policy-leaves", "DialogueChoice": "choice-fields"}  # shared types whose section is on the vocabulary page
SCENE = ("source.scenes", "source.SceneDefinition", "SceneStep")
PREFIX = "#/$defs/"

def link(name):
    if name in VOCAB: return f"[{name}](vocabulary.gen.md#{VOCAB[name]})"
    name = name.removeprefix("source.")
    return f"[{name}](source-kinds.gen.md#{name.lower()})"

def literal(v):
    return v if isinstance(v, str) else json.dumps(v)

def grouped(s):
    """Fields required only by a branch, at any depth of allOf/anyOf/oneOf."""
    return [r for k in ("allOf", "anyOf", "oneOf") for g in s.get(k, []) for r in g.get("required", []) + grouped(g)]

def type_of(v):
    if "$ref" in v: return link(v["$ref"].removeprefix(PREFIX))
    if "const" in v: return f"`{literal(v['const'])}`"
    if "enum" in v: return " or ".join(f"`{literal(e)}`" for e in v["enum"])
    if "anyOf" in v: return " or ".join(dict.fromkeys(type_of(b) for b in v["anyOf"]))
    if "items" in v: return "list of " + type_of(v["items"])
    if isinstance(v.get("additionalProperties"), dict): return "map of " + type_of(v["additionalProperties"])
    t = v.get("type", "any")
    return " or ".join(t) if isinstance(t, list) else t

def meaning(v, defs):
    if "description" in v: return v["description"]
    inner = v.get("items") or v.get("additionalProperties")
    if isinstance(inner, dict): return meaning(inner, defs)
    # An object or tagged type's own section says what it is; a scalar's says nothing of this field.
    name = v.get("$ref", "").removeprefix(PREFIX)
    target = defs.get(name, {})
    return "See the type." if name in VOCAB or ("description" in target and "properties" in target) else ""

def tag(branch):
    """The (key, value) a tagged-union branch is known by, or None."""
    for k, v in branch.get("properties", {}).items():
        if "const" in v:
            return k, v["const"]

def untagged(b, key):
    return {**b, "properties": {k: v for k, v in b["properties"].items() if k != key}}

def rows(s, defs, prefix=""):
    required = s.get("required", [])
    branch = grouped(s)
    out = {}
    for k, v in sorted(s.get("properties", {}).items()):
        req = "yes" if k in required else "one of a group" if k in branch else ""
        if k == "on" and "anyOf" in v:  # a reaction's event: the vocabulary page holds each
            out[prefix + k] = ["[event](vocabulary.gen.md#events)", req, "See the type."]
            continue
        out[prefix + k] = [type_of(v), req, meaning(v, defs)]
        out |= nested(v, defs, prefix + k)
    return out

def nested(v, defs, path):
    if "properties" in v:
        return rows(v, defs, path + ".")
    if "items" in v:
        return nested(v["items"], defs, path + "[]")
    if isinstance(v.get("additionalProperties"), dict):
        return nested(v["additionalProperties"], defs, path + ".*")
    out = {}
    for b in v.get("anyOf", []):
        if t := tag(b):
            p = f"{path}{{{t[0]}={literal(t[1])}}}"
            out[p] = ["variant", "", b.get("description", "")]
            out |= rows(untagged(b, t[0]), defs, p + ".")
        else:
            out |= nested(b, defs, path)
    return out

def section(heading, s, label, defs, gaps):
    table = rows(s, defs)
    gaps += [f"{label}: {path}" for path, r in table.items() if not r[2]]
    cell = lambda c: c.replace("|", "\\|")
    body = f"{s['description']}\n\n" if "description" in s else ""
    if table:
        lines = [f"| {cell(p)} | {cell(r[0])} | {r[1]} | {cell(r[2])} |" for p, r in table.items()]
        body += "\n".join(["| Field | Type | Required | Meaning |", "|---|---|---|---|", *lines]) + "\n\n"
    else:
        body += f"Type: {type_of(s)}.\n\n"
    return f"{heading}\n\n{body}"

def shapes(s, defs):
    """What a kind's file holds: the if/then/else dispatch's non-partial branches, or the def itself."""
    if "$ref" in s:
        ref = s["$ref"].removeprefix(PREFIX)
        return [] if ref.startswith("partial.") else shapes(defs[ref], defs)
    if "if" not in s or "properties" in s:
        return [s]
    return [sh for b in (s["then"], s["else"]) if "$ref" in b or "if" in b for sh in shapes(b, defs)]

def closure(roots, defs):
    """Every shared def the pages link to; the scene format's stay with the guide."""
    seen, stack = set(), list(roots)
    while stack:
        n = stack.pop()
        if n not in seen and n not in SCENE and not n.startswith("partial."):
            seen.add(n)
            stack += [r.removeprefix(PREFIX) for r in re.findall(r'"\$ref": "([^"]+)"', json.dumps(defs[n]))]
    return sorted(n for n in seen if not n.startswith("source.") and n not in VOCAB)

def variants(title, label, union, defs, gaps):
    out = f"## {title}\n\n"
    for b in union["anyOf"]:
        k, c = tag(b)
        out += section(f"### `{c}`", untagged(b, k), f"{label} {c}", defs, gaps)
    return out

def render(schemas):
    load = lambda f: json.load(open(os.path.join(schemas, f), encoding="utf-8"))
    defs = load("defs.schema.json")["$defs"]
    kinds = {f.removesuffix(".schema.json"): load(f)["$ref"].removeprefix("defs.schema.json#/$defs/")
             for f in sorted(os.listdir(schemas)) if f.endswith(".schema.json") and f != "defs.schema.json"}
    gaps, page = [], ""
    for kind, ref in kinds.items():
        if ref in SCENE:
            page += f"## {kind.removeprefix('source.')}\n\nThe format is in {GUIDE}.\n\n"
        else:
            page += "".join(section(f"## {kind}" + (f" shape {i + 1}" if i else ""), sh, kind, defs, gaps) for i, sh in enumerate(shapes(defs[ref], defs)))
    vocab = variants("Steps", "steps", defs["Step"], defs, gaps)
    vocab += variants("Policy leaves", "policy", defs["Policy"], defs, gaps)
    vocab += variants("Events", "events", defs["source.ReactionRule"]["properties"]["on"], defs, gaps)
    vocab += f"## Step types\n\nThe scene format is in {GUIDE}.\n\n"
    vocab += section("## Choice fields", defs["DialogueChoice"], "choice", defs, gaps)
    page += "## Shared types\n\n"
    for n in closure([*kinds.values(), *VOCAB], defs):
        page += section(f"### {n}", defs[n], n, defs, gaps)
    page += f"## Fields without a meaning\n\n{len(gaps)} fields.\n\n" + "".join(f"- `{g}`\n" for g in sorted(gaps))
    head = "Generated by `bin/source_reference.py` from `schemas/source/`; do not edit. A meaning is its `description` in `protocol/*.schema.json`. Required covers a full entry: conditional requirements are not shown, and `abstract` and `extends` entries are in the [builder's guide](../BUILDERS-GUIDE.md).\n\n"
    return {"source-kinds.gen.md": f"# Source kinds\n\n{head}{page}".rstrip() + "\n",
            "vocabulary.gen.md": f"# Vocabulary\n\n{head}{vocab}".rstrip() + "\n"}, len(gaps)

def main(argv):
    check = argv[:1] == ["--check"]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    schemas, out = argv[check:] or (f"{root}/schemas/source", f"{root}/docs/reference")
    files, blank = render(schemas)
    for name, text in files.items():
        path = os.path.join(out, name)
        if not check:
            os.makedirs(out, exist_ok=True)
            open(path, "w", encoding="utf-8").write(text)
        elif not os.path.exists(path) or open(path, encoding="utf-8").read() != text:
            sys.exit(f"{name} is out of date: run python3 bin/source_reference.py")
    if not check:
        print(f"{blank} fields without a meaning")

main(sys.argv[1:])
