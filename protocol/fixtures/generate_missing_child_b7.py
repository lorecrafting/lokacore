"""Independent B7 pin: reviewed predecessor + authored liquid consumer only.

Stdlib JSON/SHA-256/UUID; no compiler or kernel helpers. Predecessor can be
re-pinned explicitly after concurrent content integration.
"""
import hashlib
import json
from pathlib import Path
import uuid
here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
prior = 'missing_child_v021_hash.json'
v = json.loads((here / prior).read_text())['value']
manifest = json.loads((source / 'cartridge.json').read_text())
version = manifest['version']
old_version = v['manifest']['version']
v = json.loads(json.dumps(v).replace(old_version, version))
v['manifest']['requires']['kernel_api'] = manifest['requires']['kernel_api']
v['manifest']['requires']['capabilities'].update(manifest['requires']['capabilities'])
v['lock']['capabilities'] = v['manifest']['requires']['capabilities']
def ref(kind, key):
    return {'cartridge_id': manifest['id'], 'cartridge_version': version, 'kind': kind, 'key': key}
def expand(value):
    if isinstance(value, list):
        return [expand(x) for x in value]
    if not isinstance(value, dict):
        return value
    out = {}
    for key, child in value.items():
        if key in ['resource', 'item', 'npc', 'room'] and isinstance(child, str):
            out[key] = ref(key, child)
        elif key == 'liquid_source' and isinstance(child, str):
            out[key] = ref('liquid', child)
        elif key == 'kind' and isinstance(child, str):
            out[key] = ref('liquid', child)
        elif key == 'to' and isinstance(child, str):
            out[key] = ref('room', child)
        else:
            out[key] = expand(child)
    return out
for kind, names in [('item', ['waterskin', 'spare_waterskin']), ('npc', ['peg']), ('room', ['well_lane']), ('liquid', ['water'])]:
    v.setdefault(kind + 's', {})
    for name in names:
        definition = expand(json.loads((source / f'{kind}s/{name}.json').read_text()))
        definition['key'] = name
        v[kind + 's'][f"{manifest['id']}@{version}:{kind}/{name}"] = definition
v['text'].update(json.loads((source / 'text.json').read_text()))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_b7_hash.json').write_text(json.dumps({'description': f'Independent B7 answer from {prior}: finite two-skin water consumer.', 'value': v, 'canonical': canonical, 'sha256': digest}, indent=2, ensure_ascii=False) + '\n')
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
(here / 'missing_child_b7_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent B7 {version}: {digest}, {len(answers)} initial IDs.')
