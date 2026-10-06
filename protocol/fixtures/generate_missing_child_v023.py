"""Independent B6 answer from prior reviewed payload and authored additions.
Python JSON, SHA-256 and UUID only; no compiler/kernel expected-result helpers.
Re-pin predecessor to the actual B7 v022 answer before publication.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
predecessor = '021'
v = json.loads((here / f'missing_child_v{predecessor}_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace(f'0.0.{int(predecessor)}', '0.0.23'))
v['manifest'] = {k: value for k, value in json.loads((source / 'cartridge.json').read_text()).items()
                 if k not in ['entry', 'calendar', 'world', 'chapters']}
v['manifest']['requires']['capabilities']['resource'] = 1
v['lock']['capabilities'] = v['manifest']['requires']['capabilities']

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': '0.0.23', 'kind': kind, 'key': key}

def expand(value):
    if isinstance(value, list):
        return [expand(x) for x in value]
    if not isinstance(value, dict):
        return value
    result = {key: expand(item) for key, item in value.items()}
    for key in ['npc', 'quest', 'fact', 'attribute', 'topic', 'room', 'accept', 'discovered', 'to']:
        if key in result and isinstance(result[key], str):
            kind = {'accept': 'quest', 'discovered': 'fact', 'to': 'room'}.get(key, key)
            result[key] = ref(kind, result[key])
    return result

for kind, keys in [('room', ['mire_crossing', 'marsh_light', 'old_causeway', 'tide_flats']),
                   ('npc', ['wisp']), ('recipe', ['seek_wisp']), ('quest', ['wisp_ward']),
                   ('dialogue', ['a_wisp_offer', 'b_wisp_riddle', 'c_aldric_ward']), ('topic', ['ward'])]:
    for key in keys:
        value = json.loads((source / f'{kind}s/{key}.json').read_text())
        v.setdefault(f'{kind}s', {})[f'ashmere_missing_child@0.0.23:{kind}/{key}'] = {'key': key, **expand(value)}
for key in ['fen_wisp_discovered', 'fen_wisp_answered', 'topic_ward_known']:
    value = json.loads((source / 'facts.json').read_text())['facts'][key]
    v['facts'][f'ashmere_missing_child@0.0.23:fact/{key}'] = {'key': key, **value}
v['attributes']['ashmere_missing_child@0.0.23:attribute/per'] = {'key': 'per', 'start': 5}
v['text'].update(json.loads((source / 'text.json').read_text()))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v023_hash.json').write_text(json.dumps({'description': 'Independent B6 answer: all-hours marsh route, opted Seek, bounded Wisp riddle and Ward topic.', 'value': v, 'canonical': canonical, 'sha256': digest}, indent=2, ensure_ascii=False) + '\n')
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
(here / 'missing_child_v023_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent v023: {digest}, {len(answers)} initial IDs.')
