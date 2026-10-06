import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const { DEFS } = await import(pathToFileURL(root + '/kernel/ts/src/contracts.gen.ts').href);
const { validate } = await import(pathToFileURL(root + '/kernel/ts/src/foundation/validate.ts').href);
const fixture = JSON.parse(readFileSync(root + '/protocol/fixtures/bleed_composition.json', 'utf8'));
const examples = {
  BleedDefinition: DEFS.BleedDefinition.examples[0],
  ItemBandage: DEFS.ItemBandage.examples[0],
  BleedingView: DEFS.BleedingView.examples[0],
  BleedRow: fixture.cases[0].ops[0].value,
};
let total = 0, killed = 0;
const survivors = [];
for (const [contract, original] of Object.entries(examples)) {
  const base = structuredClone(original);
  if (validate(contract, base).length) throw Error('invalid base ' + contract);
  const schema = DEFS[contract];
  function walk(part, schemaPath, valuePath) {
    for (const field of part.required ?? []) {
      if (contract === 'BleedRow' && field === 'active') continue; // oneOf compiler requires this discriminator
      if (!(field in at(base, valuePath))) continue;
      const value = structuredClone(base);
      delete at(value, valuePath)[field];
      probe('required '+field, schemaPath.concat('required'), value, valuePath.concat(field), 'missing_property', field);
    }
    for (const key of ['minimum','maximum']) {
      if (!(key in part)) continue;
      const value = structuredClone(base);
      const bad = key === 'minimum' ? part[key] - 1 : part[key] + 1;
      if (!Number.isSafeInteger(bad)) continue;
      put(value, valuePath, bad);
      probe(key, schemaPath.concat(key), value, valuePath, key === 'minimum' ? 'below_minimum' : 'above_maximum');
    }
    for (const [field, child] of Object.entries(part.properties ?? {})) {
      if (field in at(base, valuePath)) walk(child, schemaPath.concat('properties', field), valuePath.concat(field));
    }
    if (part.oneOf) {
      for (let i=0;i<part.oneOf.length;i++) {
        const branch=part.oneOf[i];
        const d=Object.keys(branch.properties).find(k=>'const' in branch.properties[k]);
        if (base[d] === branch.properties[d].const) walk(branch,schemaPath.concat('oneOf',i),valuePath);
      }
    }
  }
  function probe(label, guardPath, invalid, valuePath, code, requiredField) {
    total++;
    const path='/' + valuePath.join('/');
    const before=validate(contract,invalid);
    if (!before.some(e=>e.path===path && e.code===code)) {survivors.push({contract,label,reason:'no expected baseline',before});return;}
    const defs=structuredClone(DEFS);
    let node=defs[contract]; for (const step of guardPath.slice(0,-1)) node=node[step];
    const last=guardPath.at(-1);
    if (requiredField) node[last]=node[last].filter(x=>x!==requiredField);
    else delete node[last];
    const after=validate(contract,invalid,defs);
    if (after.some(e=>e.path===path && e.code===code)) survivors.push({contract,label,reason:'survived',after});
    else killed++;
  }
  walk(schema,[],[]);
}
function at(o,path){for(const p of path)o=o[p];return o;}
function put(o,path,v){const parent=at(o,path.slice(0,-1));parent[path.at(-1)]=v;}

const id='11111111-2222-4333-8444-555555555555';
const branch=(contract,tag)=>DEFS[contract].oneOf.findIndex(b=>Object.values(b.properties).some(v=>v.const===tag));
function extra(contract,base,guardPath,invalid,path,code,removeField) {
  total++;
  const before=validate(contract,invalid);
  if (!before.some(e=>e.path===path && e.code===code)) { survivors.push({contract,guardPath,reason:'no expected baseline',before}); return; }
  const defs=structuredClone(DEFS);
  let node=defs[contract]; for (const step of guardPath.slice(0,-1)) node=node[step];
  const last=guardPath.at(-1);
  if (removeField && Array.isArray(node[last])) node[last]=node[last].filter(x=>x!==removeField);
  else if (removeField) delete node[last][removeField];
  else delete node[last];
  const after=validate(contract,invalid,defs);
  if (after.some(e=>e.path===path && e.code===code)) survivors.push({contract,guardPath,reason:'survived',after});
  else killed++;
}
function fields(contract,base,prefix,field) {
  const node=at(DEFS[contract],prefix.concat('properties',field));
  for(const key of ['minimum','maximum']){
    if(!(key in node))continue;
    const bad=key==='minimum'?node[key]-1:node[key]+1;
    const invalid=structuredClone(base); invalid[field]=bad;
    extra(contract,base,prefix.concat('properties',field,key),invalid,'/'+field,key==='minimum'?'below_minimum':'above_maximum');
  }
}
const action={effect_generation:1};
fields('ActionInput',action,[],'effect_generation');
const bandage={type:'bandage',actor_id:id,item_id:id,effect_generation:1};
const bandagePath=['oneOf',branch('CommandPayload','bandage')];
fields('CommandPayload',bandage,bandagePath,'effect_generation');
for(const field of ['item_id','effect_generation']){
 const invalid=structuredClone(bandage);delete invalid[field];
 extra('CommandPayload',bandage,bandagePath.concat('required'),invalid,'/'+field,'missing_property',field);
}
const decision={...DEFS.DecisionResult.examples[0],outcome:'bandaged',item_id:id,effect_generation:1};
fields('DecisionResult',decision,['oneOf',branch('DecisionResult','accepted')],'effect_generation');
const bleedOp=fixture.cases[0].ops[0];
const transitionPath=['oneOf',branch('DeltaOp','bleed.transition')];
for(const field of ['body_id','expected','value']){
 const invalid=structuredClone(bleedOp);delete invalid[field];
 extra('DeltaOp',bleedOp,transitionPath.concat('required'),invalid,'/'+field,'missing_property',field);
}
const cancel={op:'job.cancel',writer_group:0,job_id:id,bleed_body_id:id,bleed_generation:1};
const cancelPath=['oneOf',branch('DeltaOp','job.cancel')];
fields('DeltaOp',cancel,cancelPath,'bleed_generation');
const ambiguous={...cancel,sight_member_id:id};
extra('DeltaOp',cancel,cancelPath.concat('exactlyOneRequired'),ambiguous,'','exclusive_properties');
const absent={op:'job.cancel',writer_group:0,job_id:id};
extra('DeltaOp',cancel,cancelPath.concat('requiredUnless'),absent,'/encounter_id','missing_property');
const partial={op:'job.cancel',writer_group:0,job_id:id,bleed_body_id:id};
extra('DeltaOp',cancel,cancelPath.concat('dependentRequired'),partial,'/bleed_generation','missing_property','bleed_body_id');
const orphan={op:'job.cancel',writer_group:0,job_id:id,encounter_id:id,bleed_generation:1};
extra('DeltaOp',cancel,cancelPath.concat('dependentRequired'),orphan,'/bleed_body_id','missing_property','bleed_generation');
const deathPath=['oneOf',branch('EventPayload','entity_died')];
const died={type:'entity_died',victim_id:id,room_id:id,killer_id:null,credited_character_id:null,corpse_id:id,cause:'bleeding'};
total++;
if (validate('EventPayload',died).length) survivors.push({contract:'EventPayload',reason:'bleeding cause not admitted'});
else {
 const defs=structuredClone(DEFS);
 at(defs.EventPayload,deathPath.concat('properties','cause')).enum=['drowning'];
 if (validate('EventPayload',died,defs).some(e=>e.path==='/cause'&&e.code==='not_in_enum')) killed++;
 else survivors.push({contract:'EventPayload',reason:'cause enum mutant survived'});
}
const target={kind:'bleed',body_id:id};
const targetPath=['oneOf',branch('MutationTarget','bleed')];
const missingBody={kind:'bleed'};
extra('MutationTarget',target,targetPath.concat('required'),missingBody,'/body_id','missing_property','body_id');
const profile={...DEFS.AttackProfile.examples[0],on_positive_hit:{effect:DEFS.ItemBandage.examples[0].effect}};
const missingEffect=structuredClone(profile);delete missingEffect.on_positive_hit.effect;
extra('AttackProfile',profile,['properties','on_positive_hit','required'],missingEffect,'/on_positive_hit/effect','missing_property','effect');
console.log(JSON.stringify({ total, killed, survivors }, null, 2));
if(survivors.length) process.exitCode=1;
