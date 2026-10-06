// Controlled valid template metadata and post-loot custody isolate derived immutable admission.
import { fresh, entity, prefix, command } from '../../../kernel/ts/test/food_fixture.ts';
import { gameView, step } from '../../../kernel/ts/src/index.ts';
const w=fresh(c=>{c.items[`${prefix}:item/hound_pelt`].edible=c.items[`${prefix}:item/apple_01`].edible;});
const item=Object.keys(w.state.created!).find(id=>w.state.created![id].origin.kind==='spawned' && w.state.created![id].origin.role==='pelt')!;
const held={...w,state:{...w.state,containers:{...w.state.containers,[item]:w.body}}};
const offer=gameView(held).inventory.find(i=>i.id===item)?.actions.find(a=>a.action_key==='eat');
console.log(JSON.stringify({scenario:'valid opted created item in direct post-loot custody',known_edible:w.knownEntities[item].edible??null,offered:offer?.available,decision:step(held,command(held,1,{type:'eat',item_id:item}),0).decision}));
