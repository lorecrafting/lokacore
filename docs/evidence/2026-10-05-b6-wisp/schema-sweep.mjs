import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { DEFS } = await import(pathToFileURL(resolve('kernel/ts/src/contracts.gen.ts')));
const { validate } = await import(pathToFileURL(resolve('kernel/ts/src/foundation/validate.ts')));
const cases = JSON.parse(readFileSync('protocol/fixtures/wisp_contracts.json'));
const branch = (contract, prop, key, value) => DEFS[contract].properties[prop].oneOf.findIndex(b => b.properties[key].const === value);
const attempt = DEFS.DeltaOp.oneOf.findIndex(b => b.properties.op.const === 'choice.attempt');
const topicGrant = DEFS.DialogueChoice.properties.sequence.items.oneOf.findIndex(b => b.properties.op.const === 'topic.grant');
const light = DEFS.Policy.oneOf.findIndex(b => b.properties.op.const === 'light_off');
const roots = [
 ['ChoiceAttempts', []], ['TopicDefinition', []], ['DeltaOp',['oneOf',attempt]],
 ['InspectableDetail',['properties','perception']], ['NpcDefinition',['properties','perception']],
 ['DialogueDefinition',['properties','riddle','properties','wrong_limit']],
 ['DialogueChoice',['properties','sequence','items','oneOf',topicGrant]],
 ['ActionRecipe',['properties','check','oneOf',branch('ActionRecipe','check','kind','attribute_threshold')]],
 ['Policy',['oneOf',light]],
 ['GameView',['properties','topics','items']],
 ['CompiledCartridge',['oneOf',1,'properties','topics']],
];
const mutations=[];
function walk(contract,path,node){
 for(const [key,value] of Object.entries(node)){
  if(key==='required')for(const field of value)mutations.push({contract,path,keyword:key,field});
  else if(['minimum','maximum','minItems','maxItems','pattern','const','additionalProperties'].includes(key))mutations.push({contract,path,keyword:key});
  else if(key==='propertyNames')walk(contract,[...path,key],value);
  else if(key==='properties')for(const [name,v] of Object.entries(value))if(!('$ref' in v))walk(contract,[...path,key,name],v);
 }
}
for(const [contract,path] of roots){let node=DEFS[contract];for(const k of path)node=node[k];walk(contract,path,node);}
const results=[];
for(const m of mutations){
 const defs=structuredClone(DEFS);let node=defs[m.contract];for(const k of m.path)node=node[k];
 if(m.field)node.required=node.required.filter(x=>x!==m.field);else delete node[m.keyword];
 const caught=cases.filter(c=>!c.valid&&validate(c.contract,c.value,defs).length===0).map(c=>c.name);
 results.push({...m,killed:caught.length>0,controls:caught});
}
writeFileSync('docs/evidence/2026-10-05-b6-wisp/b6-schema-mutants.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({guards:results.length,killed:results.filter(r=>r.killed).length,survivors:results.filter(r=>!r.killed)}));
