"""Independent D12 answer over frozen D3 v033; selected literals, no compiler/kernel imports."""
import hashlib
import json
from pathlib import Path

here = Path(__file__).parent
version = '0.0.34'
prior = json.loads((here / 'missing_child_v033_hash.json').read_text())['value']
v = json.loads(json.dumps(prior).replace('0.0.33', version))


def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version,
            'kind': kind, 'key': key}


def named(kind, key):
    return f'ashmere_missing_child@{version}:{kind}/{key}'


v['manifest']['requires']['kernel_api']['at_least'] = '1.29'
v['attributes'][named('attribute', 'int')] = {'key': 'int', 'start': 10}
for skill, attribute, teacher in [('herbalism', 'int', 'sedge'), ('haggle', 'dex', 'peg')]:
    v['skills'][named('skill', skill)] = {
        'key': skill, 'label': f'skill.{skill}.label',
        'requirement': f'skill.{skill}.requirement',
        'qualification': {'policy_version': 1, 'root': {'op': 'all', 'items': [
            {'op': 'stat_compare', 'attribute': ref('attribute', attribute), 'at_least': 10},
            {'op': 'resource_compare', 'resource': ref('resource', 'mv'), 'at_least': 5},
        ]}},
    }
    v['facts'][named('fact', f'skill_{skill}')] = {
        'key': f'skill_{skill}', 'meaning': f"Skill {skill}'s acquisition (skills@1): only skills@1 writes it.",
        'scopes': ['player'], 'value_type': {'type': 'bool', 'default': False}, 'version': 1,
    }
    v['dialogues'][named('dialogue', f'{teacher}_{skill}')] = {
        'key': f'{teacher}_{skill}', 'npc': ref('npc', teacher),
        'label': f'{teacher}.{skill}.choice', 'prompt': f'{teacher}.{skill}.prompt',
        'policy': {'policy_version': 1, 'root': {'op': 'fact_compare',
                   'fact': ref('fact', f'skill_{skill}'), 'equals': False}},
        'roles': {'teacher': {'role': 'npc', 'npc': ref('npc', teacher)}},
        'choices': {'learn': {'label': f'{teacher}.{skill}.choice',
                    'narration': f'{teacher}.{skill}.learned',
                    'sequence': [{'op': 'skill.acquire', 'skill': ref('skill', skill)}],
                    'lesson_payment': {'resource': ref('resource', 'pennies'),
                                       'amount': 2, 'to': 'teacher'}}},
    }
v['actions'][named('action', 'gather_carefully')] = {
    'key': 'gather_carefully', 'command': 'harvest', 'input': ['method'],
    'label': 'action.gather_carefully', 'accessibility': 'action.gather_carefully',
    'priority': 0, 'target': {'kind': 'entity', 'scopes': ['inspectable_details']},
    'policy': {'policy_version': 1, 'root': {'op': 'all', 'items': []}},
}
v['rooms'][named('room', 'willow_shade')]['details']['fenwort_patch']['harvest']['careful'] = {
    'action': 'gather_carefully', 'count': 2, 'skill': ref('skill', 'herbalism'),
    'narration': 'narration.gather_carefully',
}
v['npcs'][named('npc', 'peg')]['shop']['buy_discount'] = {
    'numerator': 9, 'denominator': 10, 'minimum': 1, 'skill': ref('skill', 'haggle'),
}
# Literal selected copy. These values are independently pinned here rather than read from the source text file.
v['text'].update({
    'skill.herbalism.label': 'Herbalism',
    'skill.herbalism.requirement': 'INT 10 and MV 5 required to use.',
    'sedge.herbalism.prompt': 'For 2 pennies I can teach you herbalism. You may learn now; using it requires INT 10 and MV 5. With usable herbalism, careful gathering takes two existing sprigs of fenwort together.',
    'sedge.herbalism.choice': 'Learn herbalism (2p)',
    'sedge.herbalism.learned': 'You pay 2 pennies and learn herbalism.',
    'skill.haggle.label': 'Haggle',
    'skill.haggle.requirement': 'DEX 10 and MV 5 required to use.',
    'peg.haggle.prompt': 'For 2 pennies I can teach you haggle. You may learn now; using it requires DEX 10 and MV 5. With usable haggle, Buy prices are rounded down to nine tenths, with a minimum of 1 penny; Sell prices stay the same.',
    'peg.haggle.choice': 'Learn haggle (2p)',
    'peg.haggle.learned': 'You pay 2 pennies and learn haggle.',
    'action.gather_carefully': 'Gather carefully (2 herbs)',
    'narration.gather_carefully': 'You carefully gather two sprigs of fenwort.',
})
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v034_hash.json').write_text(json.dumps({
    'description': 'D12 practical herbalism and haggle over published D3 v033.',
    'value': v, 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')
# D12 adds no starting entity, item, job, slot or population identity. The ordered labels
# and their fixed ordinal domains are therefore identical to independently pinned v033.
ids = json.loads((here / 'missing_child_v033_ids.json').read_text())
assert len(ids) == 184
(here / 'missing_child_v034_ids.json').write_text(json.dumps(ids, indent=2) + '\n')
print(f'Independent D12 successor {version}/API1.29: {digest}, {len(ids)} initial IDs.')
