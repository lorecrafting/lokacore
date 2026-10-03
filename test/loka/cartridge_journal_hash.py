# Known answer independent of the kernels: extend the frozen ferry answer with hand-written
# journal definitions and an oar. Only the catalog is copied from source, as in the Lantern oracle.
import hashlib
import json
from pathlib import Path

ID, V = 'ashmere_journal', '0.0.1'

def renamed(v):
    if isinstance(v, dict):
        return {k.replace('ashmere_ferry@', ID + '@'): renamed(x) for k, x in v.items()}
    if isinstance(v, list):
        return [renamed(x) for x in v]
    return ID if v == 'ashmere_ferry' else v

def ref(kind, key):
    return {'cartridge_id': ID, 'cartridge_version': V, 'kind': kind, 'key': key}

def k(kind, key):
    return f'{ID}@{V}:{kind}/{key}'

value = renamed(json.loads(Path('protocol/fixtures/cartridge_ferry_hash.json').read_text())['value'])
value['manifest']['title'] = 'Ashmere — Journal'
del value['recipes']
value['quests'][k('quest', 'lantern')]['journal'] = {
    'active': 'quest.lantern.find', 'objectives_met': 'quest.lantern.return',
    'resolved': 'quest.lantern.done', 'failed': 'quest.lantern.failed',
    'abandoned': 'quest.lantern.abandoned', 'outcomes': {'carry': 'quest.lantern.carried'},
}
value['quests'][k('quest', 'oar')] = {
    'key': 'oar', 'title': 'quest.oar.title',
    'offer': {'label': 'quest.oar.accept', 'policy': {'policy_version': 1, 'root': {'op': 'all', 'items': []}}},
    'objective': {'evidence': 'post_activation_event', 'item_acquired': ref('item', 'oar')},
    'journal': {'active': 'quest.oar.find', 'objectives_met': 'quest.oar.found',
                'resolved': 'quest.oar.done', 'failed': 'quest.oar.failed', 'abandoned': 'quest.oar.abandoned'},
}
value['items'][k('item', 'oar')] = {
    'key': 'oar', 'keywords': ['oar'], 'short': 'item.oar.short', 'room_line': 'item.oar.room',
    'description': 'item.oar.description', 'location': {'in': 'room', 'room': ref('room', 'ferry_landing')},
}
value['text'] = json.loads(Path('cartridges/ashmere_journal/text.json').read_text())
canonical = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
sha = hashlib.sha256(canonical.encode()).hexdigest()
Path('protocol/fixtures/cartridge_journal_hash.json').write_text(json.dumps({
    'description': 'Independent Python known answer for ashmere_journal: frozen ferry artifact renamed, recipe removed, hand-written Lantern stage/outcome journal plus event-earned oar quest and landing item. Catalog copied verbatim from source. c1-journal; mechanics.md quest@1; quest.schema.json QuestJournal. No kernel supplies expected values.',
    'value': value, 'canonical': canonical, 'sha256': sha,
}, indent=2, ensure_ascii=False) + '\n')
print(sha)
