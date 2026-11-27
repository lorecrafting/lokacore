// npm run test:build (loka-hcnlh.33): the author panel's browser cases kept for the in-game builder
// (tools/author-panel/test/panel.test.ts and map.test.ts; the others retire in the 6.6a PR's table).
// It compiles a copy of toolbox_showcase with `bin/loka dev --watch`, serves the author preview on
// free ports, and drives the Book with Build on in stable Chrome at 390 and 1280 px, as phone.ts does
// in WebKit. Each case writes the copy, so the cases run in order and put back what they change.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axe from 'axe-core';
import { book, cart, file, LONG, palette, sheet, undo, until } from './builder.ts';

// Breaks (panel :301): a Build control or sheet losing its accessible name, label or contrast (axe
// serious or critical), at the phone width or the wide one (the notebook a column there).
test('Build on, its strip and a sheet add no serious or critical axe violation', LONG, async () => {
  const found: string[] = [];
  for (const width of [390, 1280]) {
    const p = await book(width);
    await p.getByRole('button', { name: 'Notebook' }).click();
    await p.getByRole('button', { name: 'Edit Crossroads Inn' }).click();
    await p.getByRole('dialog', { name: 'Crossroads Inn' }).waitFor();
    await p.addScriptTag({ content: axe.source });
    const seen = await p.evaluate(() =>
      (globalThis as unknown as { axe: typeof axe }).axe
        .run()
        .then((r) =>
          r.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id} ×${v.nodes.length}`),
        ),
    );
    found.push(...seen.map((v) => `${width}: ${v}`));
    await p.close();
  }
  // Known, open: the Build switch has no aria-checked (loka-hcnlh.90); the room's look button
  // nests one (Book side, for the designer). A new violation, or one more node, fails.
  const known = ['aria-required-attr ×1', 'nested-interactive ×2'];
  assert.deepEqual(
    found,
    [390, 1280].flatMap((w) => known.map((v) => `${w}: ${v}`)),
  );
});

// Breaks (panel :199, on the builder's terms: a bad value is written and the compile refuses it,
// nothing is held): Undo putting back anything but the last good value, or the refusal outliving
// it; a refused write (409) or a failed one (a 500 not JSON) not shown, or clearing the last
// write's Undo; the Undo chip lost by a reload.
test(
  'a refused value is undone to the last good one; a failed write keeps the Undo',
  LONG,
  async () => {
    const p = await book(390);
    const mass = () => file('areas/fell_road/items/oilskin.json').mass_grams;
    await palette(p, 'oilskin');
    await sheet(p).getByRole('button', { name: 'Fields' }).click();
    const field = p.getByRole('textbox', { name: 'mass_grams' });
    const set = async (v: string) => (await field.fill(v), await field.press('Tab'));
    const compiled = p.waitForEvent('load', LONG); // the reload a structural compile brings
    await set('600');
    await until(() => mass() === 600, 'mass 600 written');
    await compiled;
    await undo(p).waitFor(); // kept across that reload
    for (const [status, body, shown, value] of [
      [409, '"refused here"', 'refused here', '700'],
      [500, 'boom', 'a file changed since the map read it', '800'], // mapedit.ts said(): no why
    ] as const) {
      await p.route('**/__author/change', (r) => r.fulfill({ status, body }), { times: 1 });
      await set(value);
      await sheet(p).getByText(shown).waitFor();
      assert.equal(mass(), 600);
      assert.ok(await undo(p).isVisible(), `${status}: the last write's Undo stands`);
    }
    await set('-1');
    const refused = p.getByText(/Checks · 1 refused/);
    await refused.waitFor();
    assert.equal(mass(), -1);
    await undo(p).click();
    await until(() => mass() === 600, 'Undo put back 600');
    await refused.waitFor({ state: 'detached' });
    assert.equal(await undo(p).count(), 0); // an undone write offers no Undo of the undo
    await p.close();
  },
);

// Breaks (panel :276): a nested set read late, after its link moved to another dialogue, shows
// under that one (generic.tsx load() filing the late read under the newest file).
test("a slow read of a link's old target never shows under its new one", LONG, async () => {
  const p = await book(390);
  const rel = 'areas/combat/dialogues/aldous_talk.json';
  const bytes = readFileSync(join(cart, rel), 'utf8');
  let yard!: () => void;
  const asked = new Promise<void>((r) => (yard = r));
  p.on('request', (r) => r.url().includes('aldous_yard') && yard());
  let landed!: () => void;
  const late = new Promise<void>((r) => (landed = r));
  await p.route('**/__author/source?file=*aldous_lesson*', async (r) => {
    const s = await (await r.fetch()).json();
    await asked; // lands after aldous_yard's read
    await new Promise((t) => setTimeout(t, 300));
    const doc = { ...JSON.parse(s.bytes), entry: false }; // a nested set: it would draw a preview
    await r.fulfill({ json: { ...s, bytes: JSON.stringify(doc) } });
    landed();
  });
  try {
    await palette(p, 'aldous_talk', /^aldous_talk · /);
    await sheet(p).getByRole('button', { name: 'choices' }).click();
    await sheet(p).getByRole('button', { name: 'bounty' }).click();
    await sheet(p).getByRole('button', { name: 'then: none' }).click();
    const reread = p.waitForResponse('**/__author/schema/dialogues');
    await sheet(p).getByRole('button', { name: 'aldous_lesson', exact: true }).click();
    await until(() => file(rel).choices.bounty.then === 'aldous_lesson', 'then aldous_lesson');
    await reread; // its `was` read again: a pick before then is refused as changed since
    await sheet(p).getByRole('button', { name: 'aldous_yard', exact: true }).click();
    await until(() => file(rel).choices.bounty.then === 'aldous_yard', 'then aldous_yard');
    await late;
    await p.waitForTimeout(500); // the late read rendered, if it would
    const opened = sheet(p).getByRole('button', { name: /^Open aldous_/ });
    assert.equal(await opened.count(), 0);
  } finally {
    writeFileSync(join(cart, rel), bytes);
  }
  await p.close();
});

// Breaks (panel :331): the warden's Combat or Schedule block not drawn on the showcase's own file
// and schema; Run fights not saying it runs, or offered twice; Add hour not writing the
// first free hour, or Undo not taking it back. The hour field is drawn 0 px wide (loka-hcnlh.89),
// so typing an hour is generic.test.ts:493's alone until that is fixed.
test("the warden's Combat and Schedule blocks run and write on the showcase", LONG, async () => {
  const p = await book(390);
  const rel = 'areas/low_wardle/npcs/warden.json';
  const bytes = readFileSync(join(cart, rel), 'utf8');
  const hours = () => Object.keys(file(rel).daily_schedule);
  try {
    await palette(p, 'warden', /^warden · the Warden · npc$/);
    await sheet(p).getByRole('button', { name: 'Fields' }).click();
    await p.route('**/__author/fights', async (r) => {
      await new Promise((t) => setTimeout(t, 800));
      await r.fulfill({ json: { fights: { why: 'no world' } } });
    });
    const run = sheet(p).getByRole('button', { name: 'Run fights' });
    await run.click();
    await sheet(p).getByText('running the fights…').waitFor();
    assert.equal(await run.count(), 0); // one run at a time
    await sheet(p).getByText('no world').waitFor();
    await sheet(p).getByRole('button', { name: 'daily_schedule' }).click();
    await sheet(p).getByRole('button', { name: 'Add hour' }).click();
    await until(() => hours().length === 3, 'Add hour written');
    assert.deepEqual(hours(), ['0', '13', '14']);
    await undo(p).click();
    await until(() => hours().length === 2, 'Undo took the hour back');
  } finally {
    writeFileSync(join(cart, rel), bytes);
  }
  await p.close();
});

// Breaks (panel :519): One-way writing only one room, or Undo not putting back both legs.
test("a one-way exit's reverse comes back by Undo", LONG, async () => {
  const p = await book(390);
  const south = () => 'south' in file('areas/tidewater/rooms/cliff_top.json').exits;
  const north = () => 'north' in file('areas/tidewater/rooms/cliff_path.json').exits;
  await palette(p, 'cliff_path', /^cliff_path · /);
  await sheet(p).getByRole('button', { name: 'One-way' }).first().click(); // north → Cliff Top
  await until(() => !south(), 'the reverse leg removed');
  assert.ok(north());
  await undo(p).click();
  await until(south, 'Undo put back the reverse leg');
  assert.ok(north());
  await p.close();
});

// Breaks (panel :548): palette New sending a kind the server does not know, or asking for a key;
// Delete sending another file or an unread `was`; any of their refusals hidden.
test(
  'palette New and Delete send the starter and the selected file; refusals show',
  LONG,
  async () => {
    const p = await book(390);
    const sent: unknown[] = [];
    await p.route(/\/__author\/(new|delete)$/, (r) => {
      sent.push([new URL(r.request().url()).pathname, r.request().postDataJSON()]);
      return r.fulfill({ status: 400, json: 'refused here' });
    });
    const rel = 'areas/fell_road/items/oilskin.json';
    await palette(p, 'oilskin');
    const shown = sheet(p).getByRole('alert');
    await palette(p, 'New rooms');
    await shown.filter({ hasText: 'refused here' }).waitFor();
    await palette(p, 'Delete the selected definition');
    await until(() => sent.length === 2, 'Delete sent');
    await shown.filter({ hasText: 'refused here' }).waitFor();
    await p.route('**/__author/source?file=*', (r) => r.fulfill({ status: 404, json: {} }));
    await palette(p, 'Delete the selected definition');
    await shown.filter({ hasText: 'not found' }).waitFor();
    await p.unroute('**/__author/source?file=*');
    await palette(p, 'New outline');
    await until(() => sent.length === 3, 'New outline sent');
    const was = createHash('sha256')
      .update(readFileSync(join(cart, rel)))
      .digest('hex');
    assert.deepEqual(sent, [
      ['/__author/new', { kind: 'rooms', name: 'room_1' }],
      ['/__author/delete', { file: rel, was }],
      ['/__author/new', { kind: 'outline', name: 'outline' }],
    ]);
    await p.close();
  },
);

// Last: it deletes a file. Breaks (panel :592): a Delete put back from nowhere in the GUI, so only
// git brings the file back; a refused put-back (409) not shown, or a second press deleting it again.
// The Build strip's Undo chip after a Delete is loka-hcnlh.88.
test('Recent puts back the file Delete removed, once', LONG, async () => {
  const p = await book(390);
  const rel = 'areas/combat/reactions/boar_gore.json';
  const path = join(cart, rel);
  const bytes = readFileSync(path, 'utf8');
  try {
    await palette(p, 'boar_gore', /^boar_gore · /);
    const compiled = p.waitForEvent('load', LONG);
    await palette(p, 'Delete the selected definition');
    await until(() => !existsSync(path), 'deleted');
    await compiled;
    await p.getByRole('button', { name: 'Notebook' }).click();
    await p.getByRole('button', { name: 'Recent', exact: true }).first().click();
    const back = sheet(p)
      .getByText(/ you · areas\/combat\/reactions\/boar_gore\.json$/)
      .locator('xpath=..') // its row
      .getByRole('button', { name: 'Put back' });
    await p.route('**/__author/undo', (r) => r.fulfill({ status: 409, json: { file: rel } }), {
      times: 1,
    });
    await back.click();
    await sheet(p).getByText(`${rel} changed since; not put back.`).waitFor();
    assert.equal(existsSync(path), false);
    await back.click();
    await until(() => existsSync(path), 'put back');
    assert.equal(readFileSync(path, 'utf8'), bytes);
    await p.keyboard.press('Meta+z');
    await p.waitForTimeout(1500);
    assert.equal(existsSync(path), true, 'a second press deleted it again');
  } finally {
    writeFileSync(path, bytes);
  }
  await p.close();
});
