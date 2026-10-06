// Red controls remove each new schema guard and rerun literal valid/invalid inputs.
import {readFileSync} from 'node:fs';
import {DEFS} from '../../../kernel/ts/src/contracts.gen.ts';
import {validate} from '../../../kernel/ts/src/foundation/validate.ts';
const fixture=JSON.parse(readFileSync(new URL('../../../protocol/fixtures/water_contracts.json',import.meta.url),'utf8'));
const cases=fixture.cases.map((c:any)=>{
 const b=fixture.bases[c.base],v=structuredClone(b.value);let at=v;
 if(c.path){for(const field of c.path.slice(0,-1))at=at[field];const last=c.path.at(-1);if(c.omit)delete at[last];else at[last]=c.value;}
 return {name:c.name,contract:b.contract,value:v,valid:c.valid};
});
const guards:any[]=[];
function walk(schema:any,path:(string|number)[],contract:string){
 if(!schema||typeof schema!=='object')return;
 for(const [k,v]of Object.entries(schema)){
  if(k==='required')for(const name of v as string[])guards.push({contract,path:[...path,k],name});
  else if(['minimum','maximum','minItems','maxItems','enum','additionalProperties'].includes(k))guards.push({contract,path:[...path,k]});
  else if(typeof v==='object')walk(v,[...path,k],contract);
 }
}
for(const contract of ['WaterSettings','WaterOccupancy','WaterJob','WaterView','CorpseRecoveryView'])walk(DEFS[contract as keyof typeof DEFS],[],contract);
for (const [contract, field, value] of [['DeltaOp','op','water.transition'], ['MutationTarget','kind','water'], ['CommandPayload','type','recover_corpse']]) {
  const index=(DEFS[contract as keyof typeof DEFS] as any).oneOf.findIndex((b:any)=>b.properties[field]?.const===value);
  walk((DEFS[contract as keyof typeof DEFS] as any).oneOf[index],['oneOf',index],contract);
}
const event=(DEFS.EventPayload as any).oneOf.findIndex((s:any)=>s.properties.type.const==='entity_died');
guards.push({contract:'EventPayload',path:['oneOf',event,'properties','cause','enum']});
for(const op of ['job.schedule','job.cancel']){
 const index=(DEFS.DeltaOp as any).oneOf.findIndex((s:any)=>s.properties.op.const===op);
 for(const keyword of ['minimum'])guards.push({contract:'DeltaOp',path:['oneOf',index,'properties','water_generation',keyword]});
}
const survivors=[];
for(const g of guards){
 const defs=structuredClone(DEFS) as any;let at=defs[g.contract];for(const k of g.path.slice(0,-1))at=at[k];const k=g.path.at(-1);
 if(g.name)at[k]=at[k].filter((x:string)=>x!==g.name);else delete at[k];
 if(!cases.some((c:any)=>(validate(c.contract,c.value,defs).length===0)!==c.valid))survivors.push(g);
}
process.stdout.write(JSON.stringify({guards:guards.length,killed:guards.length-survivors.length,survivors},null,2)+'\n');
if(survivors.length)process.exitCode=1;
