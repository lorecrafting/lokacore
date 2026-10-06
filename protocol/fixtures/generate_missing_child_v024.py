"""Independent C2 answer: B6 v023 payload plus exact finite original-Tobin patrol.
Python JSON, SHA-256 and UUID only; no compiler or kernel expected-result helpers.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
v = json.loads((here / 'missing_child_v023_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.23', '0.0.24'))
v['manifest'] = {k: value for k, value in json.loads((source / 'cartridge.json').read_text()).items()
                 if k not in ['entry', 'calendar', 'world', 'chapters']}
v['manifest']['requires']['capabilities']['resource'] = 1
v['lock']['capabilities'] = v['manifest']['requires']['capabilities']

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': '0.0.24', 'kind': kind, 'key': key}

def expand(value):
    if isinstance(value, list):
        return [expand(x) for x in value]
    if not isinstance(value, dict):
        return value
    result = {key: expand(item) for key, item in value.items()}
    for key in ['npc', 'quest', 'fact', 'trust_fact', 'room', 'accept', 'to']:
        if key == 'npc' and 'transition' in value:
            continue  # A bound patrol choice names a role; the route names a definition.
        if key in result and isinstance(result[key], str):
            result[key] = ref({'accept': 'quest', 'trust_fact': 'fact', 'to': 'room'}.get(key, key), result[key])
    for key in ['route', 'checkpoints']:
        if key in result:
            result[key] = [ref('room', item) for item in result[key]]
    return result

for kind, keys in [('room', ['watch_post', 'watch_cell', 'gate_tower', 'east_gate', 'north_gate', 'village_green']),
                   ('npc', ['tobin']), ('quest', ['watch_rounds']), ('dialogue', ['tobin_watch'])]:
    for key in keys:
        definition = json.loads((source / f'{kind}s/{key}.json').read_text())
        v[f'{kind}s'][f'ashmere_missing_child@0.0.24:{kind}/{key}'] = {'key': key, **expand(definition)}
value = json.loads((source / 'facts.json').read_text())['facts']['watch_gate_trusts_player']
v['facts']['ashmere_missing_child@0.0.24:fact/watch_gate_trusts_player'] = {'key': 'watch_gate_trusts_player', **value}
v['text'].update(json.loads((source / 'text.json').read_text()))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v024_hash.json').write_text(json.dumps({'description': 'Independent C2 answer: original-Tobin finite patrol, four public watch rooms, causal checkpoint credit, explicit pause/fatal recovery and trust-only completion.', 'value': v, 'canonical': canonical, 'sha256': digest}, indent=2, ensure_ascii=False) + '\n')
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
(here / 'missing_child_v024_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent C2 v024: {digest}, {len(answers)} initial IDs.')
