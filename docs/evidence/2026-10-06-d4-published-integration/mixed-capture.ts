// One real current-artifact SQLite route combines spent food, C3 population and D1 ferry/lesson.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { foodHost } from '../../../mobile/authority/local-story/__tests__/food-host.ts';
import { entity, prefix, ref } from '../../../kernel/ts/test/food_fixture.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { resolved } from '../../../kernel/ts/src/commands/actions.ts';
import { level } from '../../../kernel/ts/src/mechanics/resource.ts';
import { membership } from '../../../kernel/ts/src/mechanics/skills.ts';
const source = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
const dir = mkdtempSync(join(tmpdir(), 'loka-d4-mixed-'));
function redact(s: string) { return s.replaceAll(process.cwd(),'[worktree]').replaceAll(homedir(),'[home]').replaceAll(tmpdir(),'[scratch]').replace(/((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+/gim,'$1[redacted]'); }
const a = foodHost(join(dir,'save.db'), c => { c.entry.key='ferry_landing'; c.calendar.start=64800; c.resources[`${prefix}:resource/mv`].start=100; }, `loka-kernel@${source}`);
const move = (...ds: string[]) => ds.forEach(direction => a.invoke('move', [], {direction}));
try {
  assert.equal(Object.keys(a.initial.state.created!).length,8);
  move('north','north','west','west');
  const trees=Object.keys(a.initial.details).find(id=>a.initial.details[id].key==='apple_trees')!;
  a.invoke('harvest',[trees]);
  const apple=Object.keys(a.story.world().state.containers).find(id=>a.story.world().entities[id]?.edible && a.story.world().state.containers[id]===a.initial.body)!;
  a.invoke('eat',[apple]); a.reopen();
  move('east','east','south','south','west');
  const cross=(route: string, action: string, fare: number, room: string) => {
    const endpoint=Object.keys(a.initial.details).find(id=>a.initial.details[id].key==='ferry' && a.initial.details[id].room===a.initial.roomIds[`${prefix}:room/${room}`])!;
    a.invoke(action,[endpoint],{route:ref('transport',route),quoted_fare:fare});a.reopen();
  };
  cross('fen_outbound','board_ferry',2,'boathouse');
  move('east');
  const sedge=entity(a.initial,'npc','sedge');
  const talk=gameView(a.story.world()).entities.find(e=>e.id===sedge)!.actions.find(b=>b.available && resolved(a.story.world(),a.initial.character)[b.action_key]?.command==='talk')!;
  a.invoke(talk.action_key,[sedge]);
  a.invoke('choose',[],{continuation_id:gameView(a.story.world()).choice!.continuation_id,choice_id:'learn'});a.reopen();
  move('west');cross('fen_return','return_ferry',0,'fen_isle_landing');
  const world=a.story.world();
  assert.equal(world.state.containers[apple],a.initial.consumed);
  assert.equal(world.state.containers[a.initial.consumed!],undefined);
  assert.equal(world.state.containers[world.body],world.roomIds[`${prefix}:room/boathouse`]);
  assert.equal(level(world,world.body,ref('resource','pennies')),18);
  assert.equal(membership(world,world.character,ref('skill','swim')),true);
  assert.equal(Object.keys(world.state.created!).length,8);
  writeFileSync(new URL('./mixed-route.json',import.meta.url),redact(JSON.stringify({source, food:'terminal_custody_after_reopen', population_identities:8, paid_fare:2, final_pennies:18, swim:true, return:'boathouse', browser:null,native:null,publication:null},null,2)+'\n'));
  console.log('Current v031 SQLite food/population/paid-ferry/free-lesson/return route PASS');
} finally { a.sql.close();rmSync(dir,{recursive:true,force:true}); }
