import json,hashlib,subprocess,re,sys
from pathlib import Path
pin=Path('protocol/fixtures/missing_child_d5_hash.json')
original=pin.read_bytes()
summary=[]
def redact(text):
    text = re.sub(r'(?i)\b(?:adb[_ ]serial|udid|ecid|device[_ ]name|team[_ ]id|certificate[_ ]id|provisioning[_ ]id)\s*[:=]\s*\S+', '[redacted-device]', text)
    return re.sub(r'(?:/Users/|/private/var/|/var/folders/|/tmp/)[^\s]+', '[redacted-path]', text)


def run(name,paths):
 r=subprocess.run(['mise','exec','--','node','--test',*paths],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 # Retain concise outcomes only; no local paths or identifiers.
 lines=[redact(x) for x in r.stdout.splitlines() if x.startswith(('✔','✖','ℹ tests','ℹ pass','ℹ fail'))]
 summary.append({'control':name,'command':['mise','exec','--','node','--test',*paths],'exit':r.returncode,'outcomes':lines})
 return r.returncode
old=['kernel/ts/test/readable.test.ts','kernel/ts/test/missing_child_stays.test.ts','kernel/ts/test/escort.test.ts']
for name,mutate in [
 ('omit Pool east Hollow',lambda v: v['rooms']['ashmere_missing_child@0.0.26:room/black_pool']['exits'].pop('east')),
 ('false Pool bottom access',lambda v: v['rooms']['ashmere_missing_child@0.0.26:room/black_pool']['exits'].update({'down':{'to':{'cartridge_id':'ashmere_missing_child','cartridge_version':'0.0.26','kind':'room','key':'fox_den_deep'}}})),
 ('dark den conceals ordinary Wren',lambda v:v['rooms']['ashmere_missing_child@0.0.26:room/fox_den_deep'].update({'dark_description':'room.well_shaft.dark'})),
 ('original message misplaced with Wren',lambda v:v['items']['ashmere_missing_child@0.0.26:item/vesper_message']['location']['npc'].update({'key':'wren'})),
]:
 try:
  p=json.loads(original);mutate(p['value']);p['canonical']=json.dumps(p['value'],ensure_ascii=False,sort_keys=True,separators=(',',':'));p['sha256']=hashlib.sha256(p['canonical'].encode()).hexdigest();pin.write_text(json.dumps(p))
  assert run(name+' — prior focused suites',old)==0
  assert run(name+' — D5 behavior',['kernel/ts/test/deep_fen.test.ts'])!=0
 finally:pin.write_bytes(original)
rule=Path('kernel/ts/src/mechanics/readable/rule.ts');before=rule.read_bytes()
try:
 rule.write_text(before.decode().replace("'read', [], [],", "'read', [{ op: 'fact.assign', writer_group: 0 } as never], [],"))
 assert run('Read emits semantic write — existing Read contract',['kernel/ts/test/readable.test.ts'])!=0
finally:rule.write_bytes(before)
shared=Path('kernel/ts/src/mechanics/dialogue/shared.ts');before=shared.read_bytes()
try:
 shared.write_text(before.decode().replace("if (entity.key !== (expected.role === 'npc' ? expected.npc : expected.item).key)", "if (false)"))
 assert run('substitute another original role — prior custody contract',['kernel/ts/test/missing_child_stays.test.ts'])==0
 assert run('substitute another original role — D5 custody control',['kernel/ts/test/deep_fen.test.ts'])!=0
finally:shared.write_bytes(before)
assert run('restored D5 and existing Read/custody/escort green',[*old,'kernel/ts/test/deep_fen.test.ts'])==0
Path(sys.argv[1]).write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
print(json.dumps([{'control':x['control'],'exit':x['exit']} for x in summary],indent=2))
