# Independent known answer: rename the frozen ferry, then hand-write the two trigger choices
# and three chapter markers. Only the catalog is copied from source. No kernel supplies answers.
import hashlib
import json
from pathlib import Path

ID = 'ashmere_chapters'

def renamed(v):
    if isinstance(v, dict):
        return {k.replace('ashmere_ferry@', ID + '@'): renamed(x) for k, x in v.items()}
    if isinstance(v, list):
        return [renamed(x) for x in v]
    return ID if v == 'ashmere_ferry' else v

def ref(kind, key):
    return {'cartridge_id': ID, 'cartridge_version': '0.0.1', 'kind': kind, 'key': key}

def k(kind, key):
    return f'{ID}@0.0.1:{kind}/{key}'

value = renamed(json.loads(Path('protocol/fixtures/cartridge_ferry_hash.json').read_text())['value'])
choices = value['dialogues'][k('dialogue', 'bram')]['choices']
choices['take_it'] = choices.pop('carry')
choices['leave_it'] = choices.pop('leave')
value['story_points'][k('story_point', 'lantern_resolved')]['outcomes'] = {
    'carry': {'dialogue': ref('dialogue', 'bram'), 'choice': 'take_it'},
    'leave': {'dialogue': ref('dialogue', 'bram'), 'choice': 'leave_it'},
}
value['chapters'] = [
    {'title': 'chapter.landing'},
    {'title': 'chapter.dusk', 'story_point': ref('story_point', 'lantern_resolved')},
    {'title': 'chapter.reeds', 'story_point': ref('story_point', 'lantern_resolved'), 'outcome': 'carry'},
]
value['text'] = json.loads(Path('cartridges/ashmere_chapters/text.json').read_text())
canonical = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
sha = hashlib.sha256(canonical.encode()).hexdigest()
Path('protocol/fixtures/cartridge_chapters_hash.json').write_text(json.dumps({
    'description': 'Independent Python known answer for ashmere_chapters: frozen ferry renamed, take_it/leave_it trigger choices, carry/leave story-point keys and three hand-written chapter markers. Catalog copied verbatim from source. c1-chapters; mechanics.md Chapters. No kernel supplies expected values.',
    'value': value, 'canonical': canonical, 'sha256': sha,
}, indent=2, ensure_ascii=False) + '\n')
print(sha)
