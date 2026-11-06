// The add menu's gates: which fields a card offers, as the compiler accepts them (split from card.ts).
type Obj = Record<string, unknown>;

// Each field's owning capabilities, as UNDECLARED_CAPABILITY checks them (content/); a field it omits needs none.
const VARIANT = 'description_variant';
const OWNERS: Record<string, string> = {
  'npcs.ask': 'speech topic',
  'npcs.attack': 'combat', // world.combat needs it (combat.ex requirements); NEEDS has the rest
  'npcs.cues': 'sense_cue',
  'npcs.daily_schedule': 'schedule',
  'npcs.description_variants': VARIANT,
  'npcs.name_variants': VARIANT,
  'npcs.shop': 'commerce',
  'items.affects': 'attribute', // derived.ex owner/2
  'items.bandage': 'bleed combat skill food', // bleed.ex gate/1
  'items.cues': 'sense_cue',
  'items.description_variants': VARIANT,
  'items.edible': 'food',
  'items.fuel': 'light',
  'items.name_variants': VARIANT,
  'items.readable': 'readable',
  'items.room_line_variants': VARIANT,
  'items.slot': 'equipment',
  'items.tags': 'tag',
  'items.weapon': 'skill', // its skill is a skill definition (skills.ex weapon)
  'rooms.cues': 'sense_cue',
  'rooms.dark': 'light',
  'rooms.dark_description': 'light',
  'rooms.details': 'inspectable_detail',
  'rooms.site': 'construction',
  'rooms.tags': 'tag',
  'rooms.variants': VARIANT,
  'quests.expedition': 'expedition movement quest fact combat death population', // expedition.ex:29-32
  'quests.patrol': 'patrol movement quest dialogue fact death', // patrol.ex:31-33
  'dialogues.keyword': 'speech', // keywords.ex:15: speech@1 owns `spoken`
};

// Beyond capabilities: an NPC's attack needs world.combat and the NPC's hp (combat.ex npc_profiles).
const NEEDS: Record<string, (doc: Obj, world: Obj, hidden: string[]) => boolean> = {
  'npcs.attack': (doc, world) => doc.hp !== undefined && world.combat !== undefined,
  'npcs.daily_schedule': (doc) => doc.spawn_template !== true, // calendar.ex template_schedules
  'items.weapon': (doc) => doc.slot === 'wield', // skills.ex weapon
  'quests.repeatable': (doc) => doc.exchange !== undefined && !run(doc), // exchanges.ex:94-95
  'quests.offer': (doc) => !run(doc),
  'quests.deadline': (doc) => !run(doc),
  'quests.exchange': (doc) => !run(doc),
  'dialogues.entry': (doc) => doc.keyword === undefined, // dialogue_links.ex:205-206; one per npc: the compile's
  'dialogues.keyword': (doc) => doc.entry === undefined && doc.riddle === undefined, // keywords.ex:16
  'dialogues.name': (doc, _, hidden) => !teaches(doc, hidden), // skills.ex:157
  // keywords.ex:16; skills.ex:158; a quest or riddle ends the talk, so no then leaves it (dialogue_links.ex:394)
  'dialogues.riddle': (doc, _, hidden) =>
    doc.keyword === undefined && !teaches(doc, hidden) && !linked(doc),
  'dialogues.quest': (doc) => !linked(doc), // dialogue_links.ex:394
  // the quest's evidence names the mechanic and it has none of the others: expedition.ex:99-100, patrol.ex:18-19
  'quests.expedition': (doc) =>
    solo(doc, 'expedition', 'offer repeatable deadline exchange patrol'),
  'quests.patrol': (doc) => solo(doc, 'patrol', 'offer repeatable deadline exchange'),
};
const solo = (doc: Obj, by: string, not: string) =>
  (doc.objective as Obj | undefined)?.evidence === by &&
  !not.split(' ').some((f) => Object.hasOwn(doc, f));
// a patrol or expedition quest takes no offer, repeatable, deadline or exchange (the same lines, the other way)
const run = (doc: Obj) => Object.hasOwn(doc, 'patrol') || Object.hasOwn(doc, 'expedition');
const choicesOf = (doc: Obj) => Object.values((doc.choices ?? {}) as Record<string, Obj>);
// skills.ex:166-170 teaches?: a choice's top-level step acquires a hidden skill (`hidden` are its keys)
const teaches = (doc: Obj, hidden: string[]) =>
  choicesOf(doc).some((c) =>
    ((c.steps ?? []) as Obj[]).some((s) => hidden.includes(s.skill as string)),
  );
// a then or then_failed to a dialogue; `end` is never checked (dialogue_links.ex:402-404)
const linked = (doc: Obj) =>
  choicesOf(doc).some((c) => ['then', 'then_failed'].some((f) => c[f] && c[f] !== 'end'));

/** The menu's fields whose capability `requires.capabilities` (`caps`) declares and whose other needs
 * the definition (`doc`), cartridge.json's `world` and the hidden skills' keys meet; others would not compile. */
export const allowed = (
  kind: string,
  menu: string[],
  caps: object,
  doc: Obj = {},
  world: Obj = {},
  hidden: string[] = [],
) =>
  menu.filter((f) => {
    const owners = OWNERS[`${kind}.${f}`]?.split(' ') ?? [];
    const need = NEEDS[`${kind}.${f}`];
    return owners.every((o) => Object.hasOwn(caps, o)) && (!need || need(doc, world, hidden));
  });
