// Real SQLite routes on the integrated C3/D1/D4 source artifact. No browser/native/owner-save access.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { foodHost } from '../../../mobile/authority/local-story/__tests__/food-host.ts';
import { entity, prefix, ref } from '../../../kernel/ts/test/food_fixture.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { describe } from '../../../kernel/ts/src/mechanics/description_variant/rule.ts';
function redact(text: string) {
  return text.replaceAll(process.cwd(), '[worktree]').replaceAll(homedir(), '[home]').replaceAll(tmpdir(), '[scratch]')
    .replace(/((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+/gim, '$1[redacted]');
}
const dir = mkdtempSync(join(tmpdir(), 'loka-d4-capture-'));
const results: object[] = [];
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
function setup(name: string, separated = false) {
  const a = foodHost(join(dir, `${name}.db`), (c) => {
    c.entry.key = 'ferry_landing'; c.calendar.start = 64800; c.resources[`${prefix}:resource/mv`].start = 100;
    if (separated) {
      c.npcs[`${prefix}:npc/cellar_rat_1`].room.key = 'elspeth_cottage';
      c.world.death_credit[0].room = ref('room', 'elspeth_cottage');
      c.npcs[`${prefix}:npc/cellar_rat_1`].attack = { chance: 100, damage_min: 20, damage_max: 20 };
    }
  }, `loka-kernel@${source}`);
  const move = (...directions: string[]) => directions.forEach((direction) => a.invoke('move', [], { direction }));
  const choose = (choice_id: string, answer?: string) => a.invoke('choose', [], { choice_id, continuation_id: gameView(a.story.world()).choice!.continuation_id, ...(answer && { answer }) });
  const npc = (action: string, key: string) => a.invoke(action, [entity(a.initial, 'npc', key)]);
  const lead = () => {
    npc('elspeth','elspeth'); choose('accept'); move('north','north'); a.invoke('take',[entity(a.initial,'item','fox_drawing')]);
    move('south','south'); npc('a_elspeth_report','elspeth'); choose('report'); move('south','south'); a.invoke('study_tracks');
  };
  const meet = () => { move('south','south'); npc('a_vesper_meeting','vesper'); choose('meet_wren'); npc('b_vesper_riddle','vesper'); choose('answer','LANTERN'); };
  const visit = (state: string, escort?: string) => {
    const w = a.story.world(), wren = entity(w,'npc','wren'), elspeth = entity(w,'npc','elspeth');
    const original = w.state.containers[wren];
    assert.equal(value(w,w.character,ref('fact','village_child_status')),state);
    move('north','north');
    assert.equal(gameView(a.story.world()).place.description.key,`room.village_green.${state === 'missing' ? 'description' : state}`);
    move('north','west'); a.reopen();
    const now = a.story.world(), cot = Object.values(now.details).find((d) => d.key === 'cot')!;
    assert.equal(gameView(now).place.description.key,`room.elspeth_cottage.${state === 'missing' ? 'description' : state}`);
    assert.equal(describe(now,now.character,cot,{n:0}),`detail.elspeth_cottage.cot.${state === 'missing' ? 'description' : state}`);
    assert.equal(now.state.containers[elspeth],now.roomIds[`${prefix}:room/ferry_landing`]);
    if (!escort) assert.equal(now.state.containers[wren],original);
    else assert.equal(now.state.escorts![now.character].status,escort);
    results.push({ route:name, state, escort:escort ?? null, wren:now.state.containers[wren], cottage_key:gameView(now).place.description.key, cot_key:describe(now,now.character,cot,{n:0}) });
  };
  return { a, move, choose, npc, lead, meet, visit };
}
try {
  for (const refusals of [true, false]) {
    const { a, move } = setup(refusals ? 'food-controls' : 'food-transcript');
    assert.equal(a.b.canonical,read('protocol/fixtures/missing_child_v031_hash.json').canonical);
    move('north','north','west','west');
    const trees = Object.keys(a.initial.details).find((id) => a.initial.details[id].key === 'apple_trees')!;
    for (let i=0;i<3;i++) a.invoke('harvest',[trees]);
    if (refusals) { const empty = a.story.invoke(a.attempt('harvest',[trees])); assert.equal(empty.kind === 'saved' && empty.decision.kind,'rejected'); }
    const apples = [1,2,3].map((n) => entity(a.initial,'item',`apple_0${n}`)).sort();
    a.invoke('eat',[apples[0]]); a.reopen();
    if (refusals) { const full = a.story.invoke(a.attempt('eat',[apples[1]])); assert.equal(full.kind === 'saved' && full.decision.kind,'rejected'); }
    for (const id of apples.slice(1)) { move('east','west'); a.invoke('eat',[id]); a.reopen(); }
    assert.ok(apples.every((id) => a.story.world().state.containers[id] === a.initial.consumed));
    const records = a.sql.prepare('SELECT record FROM trace ORDER BY rowid').all().map((r) => JSON.parse(r.record as string)).filter((r) => r.ids.run_id === a.story.runId());
    if (refusals) writeFileSync(new URL('./final-raw-food-trace.jsonl', import.meta.url), redact(records.map((r) => JSON.stringify(r)).join('\n')+'\n'));
    const headers = records.filter((r) => r.event === 'trace.run');
    assert.ok(headers.length);
    for (const header of headers) assert.deepEqual(header, headers[0]);
    const segment = [headers[0], ...records.filter((r) => r.event === 'trace.command')];
    if (!refusals) writeFileSync(new URL('./final-food.jsonl', import.meta.url),redact(segment.map((r) => JSON.stringify(r)).join('\n')+'\n'));
    results.push({ route:refusals ? 'food-controls' : 'food-transcript', apples, consumed:a.initial.consumed, trace_records:records.length, exact_shipped_cartridge:true }); a.sql.close();
  }
  for (const branch of ['rescued_prior','rescued_fen','stays_prior','stays_fen','lost_prior','following','separated']) {
    const { a, move, choose, npc, lead, meet, visit } = setup(branch,branch === 'separated');
    try {
      lead();
      if (branch.startsWith('rescued') || ['following','separated'].includes(branch)) {
        meet(); npc('a_wren_escort','wren'); choose('rescue'); a.reopen(); move('north','north','north','north');
        if (branch.startsWith('rescued')) { npc('a_elspeth_rescue','elspeth'); choose('rescued'); a.reopen(); visit('rescued'); }
        else {
          visit('missing','following');
          if (branch === 'separated') {
            a.invoke('attack',[entity(a.initial,'npc','cellar_rat_1')]); a.clock.wall+=3000; a.clock.mono+=3000;
            assert.equal(a.story.pulse('active',a.story.runId()).kind,'ready'); a.reopen();
            // The shrine is Chapel Nave; return to the cottage without rejoining the stopped escort.
            move('south','south','west'); a.reopen();
            assert.equal(a.story.world().state.escorts![a.initial.character].status,'separated');
            assert.equal(gameView(a.story.world()).place.description.key,'room.elspeth_cottage.description');
            results.push({ route:branch, state:'missing', escort:'separated', original_wren:entity(a.initial,'npc','wren') });
          }
        }
      } else if (branch.startsWith('stays')) {
        meet(); npc('c_vesper_answered','vesper'); choose('carry_message'); move('north','north','north','north');
        npc('a_elspeth_return','elspeth'); choose('stays'); a.reopen(); visit('stays');
      } else {
        // Q2 remains unresolved when the acknowledged A1 bell records its lost outcome.
        move('north','north','north','north','north','north','north'); npc('a_aldric_offer','aldric'); choose('accept');
        move('up','up');
        const bell = Object.keys(a.initial.details).find((id) => a.initial.details[id].key === 'bell')!;
        a.invoke('ring_bell',[bell]);
        while (gameView(a.story.world()).scene) { const s=gameView(a.story.world()).scene!; a.invoke('continue',[],{scene:s.scene,line:s.index}); a.reopen(); }
        move('down','down','south','south','south','south','south');
        visit('lost');
      }
      if (branch.startsWith('rescued') || branch.startsWith('stays')) {
        move('east','south','south','south');
        move('north','north','north','north','north'); npc('a_aldric_offer','aldric'); choose('accept');
        move('up','up');
        const bell = Object.keys(a.initial.details).find((id) => a.initial.details[id].key === 'bell')!;
        a.invoke(branch.endsWith('fen') ? 'silence_bell' : 'ring_bell',[bell]);
        while (gameView(a.story.world()).scene) { const s=gameView(a.story.world()).scene!; a.invoke('continue',[],{scene:s.scene,line:s.index}); a.reopen(); }
        move('down','down','south','south','south','south','south');
        visit(branch.startsWith('rescued') ? 'rescued' : 'stays');
        assert.equal(value(a.story.world(),a.initial.character,ref('fact','chapel_allegiance')),branch.endsWith('fen') ? 'fox' : 'prior');
      }
    } finally { a.sql.close(); }
  }
  writeFileSync(new URL('./final-routes.json',import.meta.url),redact(JSON.stringify({ source, provisional:false, browser:null, native:null, publication:null, results },null,2)+'\n'));
  console.log(JSON.stringify({ routes:results.length, finite_food:'pass', real_reopen:'pass', publication:null }));
} finally { rmSync(dir,{recursive:true,force:true}); }
