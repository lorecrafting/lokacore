"""Independent C1 answer: reviewed B5 literals plus authored Tobin/equipment inputs.

Python JSON/SHA-256 only; no compiler, kernel, or expected-result helpers.
Only C1's declared short-reference fields expand here. The reviewed predecessor
supplies unaffected literal definitions. Fresh IDs follow numeric profile order.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
v = json.loads((here / 'missing_child_v019_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.19', '0.0.20'))
manifest = json.loads((source / 'cartridge.json').read_text())
v['manifest']['requires']['kernel_api'] = manifest['requires']['kernel_api']
v['manifest']['requires']['capabilities'].update(manifest['requires']['capabilities'])
v['lock']['capabilities'] = v['manifest']['requires']['capabilities']
def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': '0.0.20', 'kind': kind, 'key': key}
def expand(value, parent=None):
    if isinstance(value, list):
        return [expand(x, parent) for x in value]
    if not isinstance(value, dict):
        return value
    out = {}
    for key, child in value.items():
        if key in ['skill', 'attribute', 'resource', 'fact', 'npc', 'room'] and isinstance(child, str):
            out[key] = ref(key, child)
        elif key == 'item' and parent not in ['receive', 'hand_over'] and isinstance(child, str):
            out[key] = ref('item', child)
        else:
            out[key] = expand(child, key)
    return out
for kind, names in [('npc', ['tobin', 'peg']), ('item', ['rusty_sword', 'iron_sword', 'wooden_shield']), ('dialogue', ['tobin_swords', 'tobin_dodge']), ('skill', ['swords', 'dodge'])]:
    v.setdefault(kind + 's', {})
    for name in names:
        definition = expand(json.loads((source / f'{kind}s/{name}.json').read_text()))
        definition['key'] = name
        v[kind + 's'][f'ashmere_missing_child@0.0.20:{kind}/{name}'] = definition
for name, spec in json.loads((source / 'attributes.json').read_text())['attributes'].items():
    v.setdefault('attributes', {})[f'ashmere_missing_child@0.0.20:attribute/{name}'] = {**spec, 'key': name}
for name in ['swords', 'dodge']:
    v['facts'][f'ashmere_missing_child@0.0.20:fact/skill_{name}'] = {
        'key': f'skill_{name}', 'version': 1, 'value_type': {'type': 'bool', 'default': False},
        'scopes': ['player'], 'meaning': f"Skill {name}'s acquisition (skills@1): only skills@1 writes it."
    }
v['world']['combat'] = expand(manifest['world']['combat'])
v['text'].update(json.loads((source / 'text.json').read_text()))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v020_hash.json').write_text(json.dumps({'description': 'Independent C1 known answer: reviewed B5 plus Tobin acquisition/payment, STR/DEX, real weapon and shield profiles.', 'value': v, 'canonical': canonical, 'sha256': digest}, indent=2, ensure_ascii=False) + '\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + [f"room/{r['key']}" for _, r in rooms]
labels += [f"detail/{r['key']}/{key}" for _, r in rooms for key in sorted(r.get('details', {}))]
labels += [f"npc/{n['key']}" for _, n in sorted(v['npcs'].items())]
labels += [f"item/{i['key']}" for _, i in sorted(v['items'].items()) if i['location']['in'] != 'template']
labels += [f"job/{n['key']}" for _, n in sorted(v['npcs'].items()) if n.get('daily_schedule')]
labels += [f'slot/{slot}' for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i})]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v020_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent v020: {digest}, {len(answers)} initial IDs.')
