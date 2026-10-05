# Independent A3 release answer from pinned v016 plus hand-declared finale definitions.
# The compiler and TypeScript loader are never used to derive this value.
import hashlib
import json
from pathlib import Path

ID, OLD, VERSION = 'ashmere_missing_child', '0.0.16', '0.0.17'
ROOT = Path('cartridges/ashmere_missing_child')
def ref(kind, name):
    return {'cartridge_id': ID, 'cartridge_version': VERSION, 'kind': kind, 'key': name}
def key(kind, name):
    return f'{ID}@{VERSION}:{kind}/{name}'
def recurse(value):
    if isinstance(value, dict):
        return {k.replace('@'+OLD+':', '@'+VERSION+':'): recurse(v) for k,v in value.items()}
    if isinstance(value, list):
        return [recurse(v) for v in value]
    return VERSION if value == OLD else value

v = recurse(json.loads(Path('protocol/fixtures/missing_child_v016_hash.json').read_text())['value'])
v['manifest']['version'] = VERSION
v['manifest']['requires']['kernel_api']['at_least'] = '1.15'
v['chapters'].append({'title':'chapter.prologue_complete','story_point':ref('story_point','prologue_completed')})
v['rooms'][key('room','village_green')]['details'] = {
    'market_cross': json.loads((ROOT/'rooms/village_green.json').read_text())['details']['market_cross']
}
for name, values in [('memory_village_ending',['unreached','rescued','stays','lost']),('memory_fox_fate',['unreached','stilled','free']),('memory_chapter_1_guild_tilt',['unreached','prior','fox'])]:
    v['facts'][key('fact',name)] = {'key':name,'version':1,'value_type':{'type':'enum','values':values,'default':'unreached'},'scopes':['player'],'meaning':f'The acknowledged Green epilogue continuity value for {name.replace("_", ".", 1) if name != "memory_chapter_1_guild_tilt" else "memory.chapter_1_guild_tilt"}.'}
for path in sorted((ROOT/'recipes').glob('begin_epilogue_*.json')):
    name=path.stem; r=json.loads(path.read_text())
    r={'key':name,**r}
    r['target']['room']=ref('room','village_green')
    for node in r['policy']['root']['items']:
        if 'quest' in node: node['quest']=ref('quest',node['quest'])
        if 'fact' in node: node['fact']=ref('fact',node['fact'])
    v['recipes'][key('recipe',name)]=r
for path in sorted((ROOT/'scenes').glob('epilogue_*.json')):
    name=path.stem; s=json.loads(path.read_text()); s={'key':name,**s}
    s['on']['action']=ref('recipe',s['on']['action']);s['on']['room']=ref('room',s['on']['room'])
    s['on_end']['story_point']=ref('story_point','prologue_completed')
    for assign in s['on_end']['assign']: assign['fact']=ref('fact',assign['fact'].replace('.','_'))
    v['scenes'][key('scene',name)]=s
    fact='scene_'+name
    v['facts'][key('fact',fact)]={'key':fact,'version':1,'value_type':{'type':'int','minimum':-1,'maximum':3,'default':0},'scopes':['player'],'meaning':f"Scene {name}'s line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it."}
point=json.loads((ROOT/'story_points/prologue_completed.json').read_text())
v.setdefault('story_points',{})[key('story_point','prologue_completed')]={'key':'prologue_completed','outcomes':{name:{'scene':ref('scene',t['scene'])} for name,t in point['outcomes'].items()}}
v['facts'][key('fact','story_point_prologue_completed')]={'key':'story_point_prologue_completed','version':1,'value_type':{'type':'enum','values':['unreached',*sorted(point['outcomes'])],'default':'unreached'},'scopes':['player'],'meaning':"Story point prologue_completed's reached outcome (scene@1): only scene@1 writes it."}
v['text']=json.loads((ROOT/'text.json').read_text())
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
sha=hashlib.sha256(canonical.encode()).hexdigest()
Path('protocol/fixtures/missing_child_v017_hash.json').write_text(json.dumps({'description':'Independent A3 known answer from pinned v016 plus five hand-declared Green rows and source catalog prose.','value':v,'canonical':canonical,'sha256':sha},indent=2,ensure_ascii=False)+'\n')
print(sha)
rooms=sorted(v['rooms'])
details=[f'detail/{name}' for room in rooms for name in sorted(v['rooms'][room].get('details',{}))]
npcs=sorted(v['npcs'])
items=sorted(k for k,item in v['items'].items() if item['location']['in']!='template')
names=['character','body']+[f"room/{v['rooms'][r]['key']}" for r in rooms]+details+[f"npc/{v['npcs'][n]['key']}" for n in npcs]+[f"item/{v['items'][i]['key']}" for i in items]+['slot/cloak']
ids={}
for ordinal,name in enumerate(names):
    b=bytearray(hashlib.sha256(json.dumps(['loka-id-v1','0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f','00000000-0000-0000-0000-000000000000',ordinal],separators=(',',':')).encode()).digest()[:16])
    b[6]=(b[6]&15)|128;b[8]=(b[8]&63)|128
    s=b.hex();ids[name]='-'.join([s[:8],s[8:12],s[12:16],s[16:20],s[20:]])
Path('protocol/fixtures/missing_child_v017_ids.json').write_text(json.dumps(ids,indent=2)+'\n')
