"""Independent C5 successor from published v036 and reviewed C5 provisional answer."""
import hashlib
import json
from pathlib import Path

here = Path(__file__).parent
version = '0.0.37'
published = json.loads((here / 'missing_child_v036_hash.json').read_text())['value']
c5 = json.loads((here.parent.parent / 'kernel/ts/test/fixtures/c5-provisional-artifact.json').read_text())['cartridge']
v = json.loads(json.dumps(published).replace('0.0.36', version))
c5 = json.loads(json.dumps(c5).replace('0.0.35', version))
prefix = f'ashmere_missing_child@{version}:'

v['manifest']['requires']['kernel_api']['at_least'] = '1.32'
for section in (v['manifest']['requires']['capabilities'], v['lock']['capabilities']):
    section['bleed'] = 1
v['bleeds'] = c5['bleeds']
for collection, name in [('dialogues', 'dialogue/wick_bandage'),
                         ('facts', 'fact/skill_bandage'), ('skills', 'skill/bandage')]:
    v[collection][prefix + name] = c5[collection][prefix + name]
for ordinal in range(1, 13):
    name = prefix + f'item/bandage_{ordinal:02d}'
    v['items'][name]['bandage'] = c5['items'][name]['bandage']
hound = prefix + 'npc/fen_hound'
v['npcs'][hound]['attack']['on_positive_hit'] = c5['npcs'][hound]['attack']['on_positive_hit']
for name in ('action.bandage', 'condition.bleeding', 'narration.bandaged',
             'narration.bleed.applied', 'narration.bleed.expired',
             'narration.bleed.refreshed', 'narration.bleed.tick',
             'skill.bandage.label', 'skill.bandage.requirement',
             'wick.bandage.choice', 'wick.bandage.learned', 'wick.bandage.prompt'):
    v['text'][name] = c5['text'][name]

canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v037_hash.json').write_text(json.dumps({
    'description': 'C5 hound bleeding and exact bandage cure over published D7 v036.',
    'value': v, 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')
print(f'Independent C5 successor {version}/API1.32: {digest}.')
