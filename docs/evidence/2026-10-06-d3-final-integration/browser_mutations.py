import hashlib,json,subprocess,os
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[3])
capture=str(Path(__file__).with_name('capture.py'))
p=Path('protocol/fixtures/missing_child_v033_hash.json');original=p.read_bytes();pin=json.loads(original);v=pin['value'];prefix='ashmere_missing_child@0.0.33'
v['rooms'][prefix+':room/old_mill']['exits']['north']['to']['key']='empty_cottage'
v['npcs'][prefix+':npc/hob']['daily_schedule']['7']=v['npcs'][prefix+':npc/hob']['daily_schedule'].pop('6')
pin['canonical']=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False);pin['sha256']=hashlib.sha256(pin['canonical'].encode()).hexdigest()
try:
 p.write_text(json.dumps(pin,ensure_ascii=False))
 subprocess.run(['python3',capture,'browser-route-schedule-red','cd mobile/app && mise exec -- npm run test:e2e -- tests/western_ashmere.e2e.ts --workers 1 --output .e2e/d3-final --trace off --video off'])
finally:p.write_bytes(original)
subprocess.run(['python3',capture,'browser-final','cd mobile/app && mise exec -- npm run test:e2e -- tests/western_ashmere.e2e.ts --workers 1 --output .e2e/d3-final --trace off --video off'])
