# Independent integrated D2 answer: published D5 v026 plus the literal Priory/book/novice additions.
# No compiler or kernel supplies expected values. D5 predecessor remains frozen.
import hashlib
import json
from pathlib import Path

ID, OLD, VERSION = 'ashmere_missing_child', '0.0.26', '0.0.27'
ROOT = Path('cartridges/ashmere_missing_child')
def ref(kind, name):
    return {'cartridge_id': ID, 'cartridge_version': VERSION, 'kind': kind, 'key': name}
def key(kind, name):
    return f'{ID}@{VERSION}:{kind}/{name}'
def repin(value):
    if isinstance(value, dict):
        return {k.replace('@'+OLD+':', '@'+VERSION+':'): repin(v) for k, v in value.items()}
    if isinstance(value, list):
        return [repin(v) for v in value]
    return VERSION if value == OLD else value
v = repin(json.loads(Path('protocol/fixtures/missing_child_d5_hash.json').read_text())['value'])
v['manifest']['requires']['kernel_api']['at_least'] = '1.24'
v['manifest']['requires']['capabilities']['behavior'] = 1
v['lock']['capabilities']['behavior'] = 1
for room, direction, target in [('chapel_nave', 'west', 'prior_study'), ('belfry', 'up', 'spire'), ('cloister', 'west', 'scriptorium')]:
    v['rooms'][key('room', room)]['exits'][direction] = {'to': ref('room', target)}
for room, exits in {'prior_study': {'east': 'chapel_nave'}, 'spire': {'down': 'belfry'}, 'scriptorium': {'east': 'cloister', 'west': 'kitchen_garden'}, 'kitchen_garden': {'east': 'scriptorium'}}.items():
    v['rooms'][key('room', room)] = {'key': room, 'title': f'room.{room}.title', 'description': f'room.{room}.description', 'exits': {d: {'to': ref('room', r)} for d, r in exits.items()}}
for book, topic in [('ward_of_the_fen', 'ward'), ('bell_rites', 'bell')]:
    v['items'][key('item', book)] = {'key': book, 'keywords': [book, 'book'], 'short': f'item.{book}.short', 'room_line': f'item.{book}.room', 'description': f'item.{book}.description', 'location': {'in': 'room', 'room': ref('room', 'scriptorium')}, 'mass_grams': 100, 'readable': {'label': 'actions.read_book', 'text': f'readable.{book}', 'topic': ref('topic', topic)}}
v['topics'][key('topic', 'bell')] = {'key': 'bell', 'label': 'topic.bell', 'fact': ref('fact', 'topic_bell_known')}
v['facts'][key('fact', 'topic_bell_known')] = {'key': 'topic_bell_known', 'version': 1, 'value_type': {'type': 'bool', 'default': False}, 'scopes': ['player'], 'meaning': 'The player deliberately read Bell Rites while lawfully holding its original book.'}
for novice, schedule in [('ash', {'6': 'scriptorium', '12': 'cloister', '20': 'scriptorium'}), ('hale', {'6': 'kitchen_garden', '18': 'cloister'})]:
    v['npcs'][key('npc', novice)] = {'key': novice, 'keywords': [novice, f'novice_{novice}', 'novice'], 'short': f'npc.{novice}.short', 'room_line': f'npc.{novice}.room', 'description': f'npc.{novice}.description', 'room': ref('room', 'cloister'), 'daily_schedule': {h: ref('room', r) for h, r in schedule.items()}}
    v['dialogues'][key('dialogue', novice)] = {'key': novice, 'npc': ref('npc', novice), 'policy': {'policy_version': 1, 'root': {'op': 'all', 'items': []}}, 'prompt': f'dialogue.{novice}.prompt', 'roles': {novice: {'role': 'npc', 'npc': ref('npc', novice)}}, 'choices': {'leave': {'label': f'dialogue.{novice}.leave', 'narration': f'dialogue.{novice}.prompt'}}}
v['text'] = json.loads((ROOT/'text.json').read_text())
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
sha = hashlib.sha256(canonical.encode()).hexdigest()
Path('protocol/fixtures/missing_child_v027_hash.json').write_text(json.dumps({'description': 'Independent integrated D2 answer from published D5 v026 and literal four-room, held-book and separate novice declarations. Catalog copied verbatim.', 'value': v, 'canonical': canonical, 'sha256': sha}, indent=2, ensure_ascii=False)+'\n')
names = ['character', 'body']
for r in sorted(v['rooms']): names.append('room/'+v['rooms'][r]['key'])
for r in sorted(v['rooms']):
    for detail in sorted(v['rooms'][r].get('details', {})): names.append('detail/'+v['rooms'][r]['key']+'/'+detail)
for n in sorted(v['npcs']): names.append('npc/'+v['npcs'][n]['key'])
for i in sorted(v['items']):
    if v['items'][i]['location']['in'] != 'template': names.append('item/'+v['items'][i]['key'])
for n in sorted(v['npcs']):
    if v['npcs'][n].get('daily_schedule'): names.append('job/'+v['npcs'][n]['key'])
for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i}): names.append('slot/'+slot)
ids = {}
for ordinal, name in enumerate(names):
    b = bytearray(hashlib.sha256(json.dumps(['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal], separators=(',', ':')).encode()).digest()[:16])
    b[6] = (b[6]&15)|128; b[8] = (b[8]&63)|128
    s = b.hex(); ids[name] = '-'.join([s[:8], s[8:12], s[12:16], s[16:20], s[20:]])
Path('protocol/fixtures/missing_child_v027_ids.json').write_text(json.dumps(ids, indent=2)+'\n')
print(sha, len(ids))
