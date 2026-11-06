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
const NEEDS: Record<string, (doc: Obj, world: Obj) => boolean> = {
  'npcs.attack': (doc, world) => doc.hp !== undefined && world.combat !== undefined,
  'quests.repeatable': (doc) => doc.exchange !== undefined, // exchanges.ex:94-95
  'dialogues.entry': (doc) => doc.keyword === undefined, // dialogue_links.ex:205-206; one per npc: the compile's
  'dialogues.keyword': (doc) => doc.entry === undefined && doc.riddle === undefined, // keywords.ex:16
  'dialogues.riddle': (doc) => doc.keyword === undefined, // keywords.ex:16
  // the quest's evidence names the mechanic and it has none of the others: expedition.ex:99-100, patrol.ex:18-19
  'quests.expedition': (doc) =>
    solo(doc, 'expedition', 'offer repeatable deadline exchange patrol'),
  'quests.patrol': (doc) => solo(doc, 'patrol', 'offer repeatable deadline exchange'),
};
const solo = (doc: Obj, by: string, not: string) =>
  (doc.objective as Obj | undefined)?.evidence === by &&
  !not.split(' ').some((f) => Object.hasOwn(doc, f));

/** The menu's fields whose capability `requires.capabilities` (`caps`) declares and whose other needs
 * the definition (`doc`) and cartridge.json's `world` meet; others would not compile. */
export const allowed = (
  kind: string,
  menu: string[],
  caps: object,
  doc: Obj = {},
  world: Obj = {},
) =>
  menu.filter((f) => {
    const owners = OWNERS[`${kind}.${f}`]?.split(' ') ?? [];
    const need = NEEDS[`${kind}.${f}`];
    return owners.every((o) => Object.hasOwn(caps, o)) && (!need || need(doc, world));
  });
