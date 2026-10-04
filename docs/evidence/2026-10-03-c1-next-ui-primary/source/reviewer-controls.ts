
// Reviewer red control: missing optional prose stays absent; unrelated choices cannot capture Leave.
test('reviewer projected descriptions and matching Leave preserve honest old views', async () => {
  const h = book();
  const { NpcPage } = await import('./Menu.tsx');
  const choice = { continuation_id: 'c-other', speaker_id: 'other', closable: true, prompt: { key: 'prompt' }, choices: [] };
  const view = { ...h.game.view().view, entities: [{ id: 'other', kind: 'npc', name: 'name', actions: [] }], choice };
  const close = { label: 'Close', action_key: 'close_choice', target_ids: [], input: {}, token: 'view:r:17' };
  let local = 0;
  const sent: any[] = [];
  const props = { view, npc: { id: 'bram', kind: 'npc', name: 'name', actions: [] }, text: (key: string) => ({ name: 'Bram', authored: 'Real authored prose.', prompt: 'Pending question.' }[key] ?? key), g: { choice: [close], on: () => [] }, press: (b: any) => sent.push(b), log: [], leave: () => local++ };
  const old = nodes(NpcPage(props as never));
  assert.deepEqual(old.filter(n => n.type === 'Text').map(words), ['Bram', 'Nothing to do here.', 'Leave']);
  old.find(n => n.type === 'Pressable').props.onPress();
  assert.equal(local, 1);
  assert.deepEqual(sent, []);
  assert.equal(view.choice.continuation_id, 'c-other');
  const matching = nodes(NpcPage({ ...props, npc: { ...props.npc, id: 'other', description: 'authored' }, log: ['A real answer.', { text: 'Journal updated', event: true }] } as never));
  assert.deepEqual(matching.filter(n => n.type === 'Text').map(words), ['Bram', 'Real authored prose.', 'A real answer.', 'Journal updated', 'Leave']);
  const leaves = matching.filter(n => n.type === 'Pressable');
  assert.equal(leaves.length, 1);
  leaves[0].props.onPress();
  assert.deepEqual(sent, [{ ...close, label: 'Leave' }]);
  let scrolled: any;
  const scroll = matching.find(n => n.type === 'ScrollView');
  scroll.props.ref.current = { scrollToEnd: (o: any) => scrolled = o };
  scroll.props.onContentSizeChange();
  assert.deepEqual(scrolled, { animated: false });
  h.sql.close();
});
